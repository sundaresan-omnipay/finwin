import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CATEGORIES = [
  { key: "food",          label: "Food / Dining" },
  { key: "transport",     label: "Transport" },
  { key: "groceries",     label: "Groceries" },
  { key: "shopping",      label: "Shopping" },
  { key: "bills",         label: "Bills / Utilities" },
  { key: "health",        label: "Health" },
  { key: "entertainment", label: "Entertainment" },
  { key: "travel",        label: "Travel" },
  { key: "education",     label: "Education" },
  { key: "other",         label: "Other" },
] as const;

type Category = typeof CATEGORIES[number]["key"];
const CATEGORY_KEYS = CATEGORIES.map(c => c.key) as unknown as Category[];

function twimlResponse(body: string): NextResponse {
  const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
  return new NextResponse(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

function categoryMenu(amount: number, description: string): string {
  const lines = [`What category for ₹${amount} ${description}?\n`];
  CATEGORIES.forEach((c, i) => lines.push(`${i + 1}. ${c.label}`));
  lines.push("\nReply with a number");
  return lines.join("\n");
}

function parseAmountAndDesc(text: string): { amount: number; description: string } | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const amount = parseFloat(parts[0]);
  if (isNaN(amount) || amount <= 0) return null;
  const description = parts.slice(1).join(" ");
  const formatted = description.charAt(0).toUpperCase() + description.slice(1);
  return { amount, description: formatted };
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const from = formData.get("From") as string | null;
  const body = (formData.get("Body") as string | null)?.trim() ?? "";

  if (!from || !body) {
    return twimlResponse("Could not process your message. Send 'help' for usage.");
  }

  const phone = from.replace("whatsapp:", "").trim();
  const last10 = phone.replace(/^\+?(\d+)/, (_, d) => d).slice(-10);

  if (body.toLowerCase() === "help") {
    return twimlResponse(
      "FinWin Quick-Entry\n\nSend: AMOUNT DESCRIPTION\nExample: 250 swiggy\n\nI'll ask you to pick a category.\nOr include it directly: 250 swiggy food"
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Resolve user from phone number
  const { data: byOwn } = await supabase
    .from("user_settings")
    .select("user_id, partner_name")
    .ilike("whatsapp_phone", `%${last10}`)
    .maybeSingle();

  const { data: byPartner } = byOwn
    ? { data: null }
    : await supabase
        .from("user_settings")
        .select("user_id, partner_name")
        .ilike("partner_whatsapp_phone", `%${last10}`)
        .maybeSingle();

  const settings = byOwn || byPartner;
  const isPartner = !byOwn && !!byPartner;

  if (!settings) {
    return twimlResponse(
      "Your number is not registered with FinWin. Go to Settings → WhatsApp and add your number."
    );
  }

  // ── Step 2: user is picking a category from the menu ──────────────────
  const pick = parseInt(body.trim());
  if (!isNaN(pick) && pick >= 1 && pick <= CATEGORIES.length) {
    const { data: pending } = await supabase
      .from("whatsapp_pending")
      .select("*")
      .eq("phone", last10)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!pending) {
      return twimlResponse("No pending transaction. Send AMOUNT DESCRIPTION first.\nExample: 250 swiggy");
    }

    const category = CATEGORIES[pick - 1].key as Category;
    const today = new Date().toISOString().split("T")[0];
    const notesTag = isPartner
      ? `via WhatsApp (${settings.partner_name || "partner"})`
      : "via WhatsApp";

    const [{ error: insertErr }] = await Promise.all([
      supabase.from("transactions").insert({
        user_id: settings.user_id,
        amount: pending.amount,
        description: pending.description,
        category,
        date: today,
        notes: notesTag,
        member: isPartner ? (settings.partner_name || "partner") : null,
      }),
      supabase.from("whatsapp_pending").delete().eq("phone", last10),
    ]);

    if (insertErr) {
      return twimlResponse("Something went wrong. Please try again.");
    }

    const whoTag = isPartner ? ` · ${settings.partner_name || "partner"}` : "";
    const catLabel = CATEGORIES[pick - 1].label;
    return twimlResponse(
      `✅ Logged!\n₹${pending.amount} · ${pending.description} · ${catLabel}${whoTag}\n${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    );
  }

  // ── Step 1: parse amount + description ────────────────────────────────
  const parts = body.trim().split(/\s+/);
  const amount = parseFloat(parts[0]);

  if (isNaN(amount) || amount <= 0 || parts.length < 2) {
    return twimlResponse("Could not parse that.\n\nSend: AMOUNT DESCRIPTION\nExample: 250 swiggy");
  }

  // Check if last word is a known category keyword (power-user shortcut)
  const lastWord = parts[parts.length - 1].toLowerCase();
  const inlineCategory = CATEGORY_KEYS.find(k => k === lastWord);

  if (inlineCategory && parts.length > 2) {
    const description = parts.slice(1, -1).join(" ");
    const formatted = description.charAt(0).toUpperCase() + description.slice(1);
    const today = new Date().toISOString().split("T")[0];
    const notesTag = isPartner
      ? `via WhatsApp (${settings.partner_name || "partner"})`
      : "via WhatsApp";

    const { error: insertErr } = await supabase.from("transactions").insert({
      user_id: settings.user_id,
      amount,
      description: formatted,
      category: inlineCategory,
      date: today,
      notes: notesTag,
      member: isPartner ? (settings.partner_name || "partner") : null,
    });

    if (insertErr) return twimlResponse("Something went wrong. Please try again.");

    const whoTag = isPartner ? ` · ${settings.partner_name || "partner"}` : "";
    return twimlResponse(
      `✅ Logged!\n₹${amount} · ${formatted} · ${inlineCategory}${whoTag}\n${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    );
  }

  // No inline category — save pending and ask
  const description = parts.slice(1).join(" ");
  const formatted = description.charAt(0).toUpperCase() + description.slice(1);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min TTL

  await supabase.from("whatsapp_pending").upsert(
    { phone: last10, user_id: settings.user_id, amount, description: formatted, expires_at: expiresAt },
    { onConflict: "phone" }
  );

  return twimlResponse(categoryMenu(amount, formatted));
}
