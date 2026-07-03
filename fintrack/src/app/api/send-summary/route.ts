import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getSalaryCycleBounds, formatCurrency, isSipOrEmiTx } from "@/lib/utils";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

export async function POST(_req: NextRequest) {
  // Auth: only the logged-in user can trigger their own summary
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user settings (WhatsApp number, salary info)
  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!settings?.whatsapp_phone) {
    return NextResponse.json({ error: "No WhatsApp number saved. Add it in Settings first." }, { status: 400 });
  }

  const salaryDay = settings.salary_day ?? 1;
  const monthlySalary = settings.monthly_salary ?? 0;
  const cycle = getSalaryCycleBounds(salaryDay);

  // Fetch current cycle transactions
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: transactions }, { data: budgets }, { data: bills }] = await Promise.all([
    service.from("transactions")
      .select("amount,category,description,date,is_recurring")
      .eq("user_id", user.id)
      .gte("date", cycle.start)
      .lte("date", cycle.end),
    service.from("budgets")
      .select("amount,category,month")
      .eq("user_id", user.id)
      .eq("month", cycle.monthKey),
    service.from("bills")
      .select("name,amount,due_day")
      .eq("user_id", user.id)
      .eq("is_active", true),
  ]);

  const txns = (transactions || []).filter(t => !isSipOrEmiTx(t as { category: string; description: string; is_recurring?: boolean }));
  const totalSpent = txns.reduce((s: number, t: { amount: number }) => s + t.amount, 0);
  const totalBudget = (budgets || []).reduce((s: number, b: { amount: number }) => s + b.amount, 0);
  const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : null;

  // Top 3 categories
  const catMap: Record<string, number> = {};
  txns.forEach((t: { category: string; amount: number }) => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const top3 = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => `  • ${cat}: ₹${fmt(amt)}`);

  // Upcoming bills (next 7 days)
  const todayDate = new Date();
  const todayDay = todayDate.getDate();
  const dueSoon = (bills || [])
    .map((b: { name: string; amount: number | null; due_day: number }) => {
      let due = new Date(todayDate.getFullYear(), todayDate.getMonth(), b.due_day);
      if (due < todayDate) due = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, b.due_day);
      const daysLeft = Math.ceil((due.getTime() - new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDay).getTime()) / 86400000);
      return { name: b.name, amount: b.amount, daysLeft };
    })
    .filter((b: { daysLeft: number }) => b.daysLeft >= 0 && b.daysLeft <= 7)
    .map((b: { name: string; amount: number | null; daysLeft: number }) =>
      `  • ${b.name}${b.amount ? ` ₹${fmt(b.amount)}` : ""} (${b.daysLeft === 0 ? "today" : b.daysLeft === 1 ? "tomorrow" : `${b.daysLeft}d`})`
    );

  // Savings rate
  let savingsLine = "";
  if (monthlySalary > 0) {
    const { data: sips } = await service
      .from("sips")
      .select("monthly_amount")
      .eq("user_id", user.id)
      .eq("is_active", true);
    const totalSip = (sips || []).reduce((s: number, r: { monthly_amount: number }) => s + r.monthly_amount, 0);
    const rate = Math.round((totalSip / monthlySalary) * 100);
    savingsLine = `\n💰 *SIP Savings:* ₹${fmt(totalSip)}/mo (${rate}% of salary)`;
  }

  // Build message
  const today = todayDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const lines: string[] = [
    `📊 *FinWin Report* — ${today}`,
    `📅 Cycle: ${cycle.label}`,
    "",
    `💸 *Spent this cycle:* ₹${fmt(totalSpent)}`,
    totalBudget > 0
      ? `🎯 *Budget:* ₹${fmt(totalSpent)} / ₹${fmt(totalBudget)} (${budgetPct}% used)`
      : "",
    savingsLine,
    "",
    `*Top spending:*`,
    ...top3,
  ];

  if (dueSoon.length > 0) {
    lines.push("", `🔔 *Bills due soon:*`, ...dueSoon);
  }

  lines.push("", `_Sent from FinWin · ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}_`);

  const message = lines.filter(l => l !== "").join("\n");

  // Send via Twilio
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: "Twilio not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars." }, { status: 500 });
  }

  const toNumber = `whatsapp:${settings.whatsapp_phone.startsWith("+") ? settings.whatsapp_phone : "+" + settings.whatsapp_phone}`;

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: message,
      }).toString(),
    }
  );

  const twilioData = await twilioRes.json();

  if (!twilioRes.ok) {
    return NextResponse.json(
      { error: `Twilio error: ${twilioData.message ?? twilioRes.statusText}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message, sid: twilioData.sid });
}
