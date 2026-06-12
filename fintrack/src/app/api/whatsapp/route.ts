/**
 * WhatsApp Quick-Entry (Feature 8 — Phase 5)
 *
 * Setup:
 *   1. Create a Twilio account, get a WhatsApp sandbox number
 *   2. Set webhook URL to: https://your-domain.com/api/whatsapp
 *   3. Add env vars: TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID
 *   4. User registers their WhatsApp number in Settings → whatsapp_phone field
 *
 * Message format (from user's registered WhatsApp number):
 *   "250 swiggy food"      → ₹250, description "swiggy", category food
 *   "500 auto transport"   → ₹500, description "auto", category transport
 *   "1200 electricity bills" → ₹1200, description "electricity", category bills
 *   "250 chai"             → ₹250, description "chai", category other (default)
 *   "help"                 → lists valid categories
 *
 * Category keywords recognised:
 *   food, transport, shopping, bills, health, entertainment, travel, education, other
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_CATEGORIES = ["food", "transport", "shopping", "bills", "health", "entertainment", "travel", "education", "other"] as const;
type Category = typeof VALID_CATEGORIES[number];

function twimlResponse(body: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body}</Message></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function parseMessage(text: string): { amount: number; description: string; category: Category } | null {
  const clean = text.trim().toLowerCase();

  if (clean === "help") return null;

  // Expected: "AMOUNT DESCRIPTION [CATEGORY]"
  const parts = clean.split(/\s+/);
  if (parts.length < 2) return null;

  const amount = parseFloat(parts[0]);
  if (isNaN(amount) || amount <= 0) return null;

  // Last word might be a category
  const lastWord = parts[parts.length - 1];
  let category: Category = "other";
  let descriptionParts = parts.slice(1);

  if (VALID_CATEGORIES.includes(lastWord as Category) && parts.length > 2) {
    category = lastWord as Category;
    descriptionParts = parts.slice(1, -1);
  }

  const description = descriptionParts.join(" ");
  if (!description) return null;

  // Capitalise first letter
  const formattedDesc = description.charAt(0).toUpperCase() + description.slice(1);

  return { amount, description: formattedDesc, category };
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const from = formData.get("From") as string | null;
  const body = (formData.get("Body") as string | null)?.trim() ?? "";

  if (!from || !body) {
    return twimlResponse("Could not process your message. Send 'help' for usage.");
  }

  // Normalise phone: WhatsApp prefixes "whatsapp:+91..."
  const phone = from.replace("whatsapp:", "").trim();

  if (body.toLowerCase() === "help") {
    return twimlResponse(
      "FinWin Quick-Entry\n\nFormat: AMOUNT DESCRIPTION [CATEGORY]\n\nExamples:\n250 swiggy food\n500 auto transport\n1200 electricity bills\n\nCategories: food, transport, shopping, bills, health, entertainment, travel, education, other"
    );
  }

  const parsed = parseMessage(body);
  if (!parsed) {
    return twimlResponse("Could not parse that. Try: '250 swiggy food' or send 'help'.");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Look up user by registered WhatsApp number
  const { data: settings, error: settingsErr } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("whatsapp_phone", phone)
    .maybeSingle();

  if (settingsErr || !settings) {
    return twimlResponse(
      "Your number is not registered with FinWin. Go to Settings → WhatsApp and add your number."
    );
  }

  const today = new Date().toISOString().split("T")[0];

  const { error: insertErr } = await supabase.from("transactions").insert({
    user_id: settings.user_id,
    amount: parsed.amount,
    description: parsed.description,
    category: parsed.category,
    date: today,
    notes: "via WhatsApp",
  });

  if (insertErr) {
    return twimlResponse("Something went wrong logging your transaction. Please try again.");
  }

  return twimlResponse(
    `✅ Logged!\n₹${parsed.amount} · ${parsed.description} · ${parsed.category}\n${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
  );
}
