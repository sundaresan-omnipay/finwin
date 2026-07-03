import { createClient } from "@/lib/supabase/server";
import { getMonthKey, getLast6Months } from "@/lib/utils";
import { Credit, NetWorthEntry, Bill, IncomeEntry } from "@/types";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentMonth = getMonthKey();
  const last6 = getLast6Months();
  const startDate = `${last6[0]}-01`;

  const [txResult, budgetResult, settingsResult, withdrawalResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .gte("date", startDate)
      .order("date", { ascending: false }),
    supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user!.id)
      .in("month", [currentMonth, getMonthKey(new Date(new Date().setMonth(new Date().getMonth() + 1)))]),
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("cash_withdrawals")
      .select("*")
      .eq("user_id", user!.id)
      .gte("date", startDate)
      .order("date", { ascending: false }),
  ]);

  let credits: Credit[] = [];
  try {
    const { data: creditsData } = await supabase
      .from("credits")
      .select("*")
      .eq("user_id", user!.id)
      .gte("date", startDate)
      .order("date", { ascending: false });
    credits = (creditsData || []) as Credit[];
  } catch {}

  let netWorthEntries: NetWorthEntry[] = [];
  try {
    const { data } = await supabase.from("net_worth_entries").select("*").eq("user_id", user!.id);
    netWorthEntries = (data || []) as NetWorthEntry[];
  } catch {}

  let bills: Bill[] = [];
  try {
    const { data } = await supabase.from("bills").select("*").eq("user_id", user!.id).eq("is_active", true);
    bills = (data || []) as Bill[];
  } catch {}

  let incomeEntries: IncomeEntry[] = [];
  try {
    const { data } = await supabase.from("income_entries").select("*").eq("user_id", user!.id).gte("date", startDate).order("date", { ascending: false });
    incomeEntries = (data || []) as IncomeEntry[];
  } catch {}

  let totalSipMonthly = 0;
  let totalEmiMonthly = 0;

  try {
    const { data: sips } = await supabase
      .from("sips")
      .select("monthly_amount")
      .eq("user_id", user!.id)
      .eq("is_active", true);
    totalSipMonthly = (sips || []).reduce((s, sip) => s + sip.monthly_amount, 0);
  } catch {}

  try {
    const { data: loans } = await supabase
      .from("loans")
      .select("emi_amount")
      .eq("user_id", user!.id)
      .eq("is_active", true);
    totalEmiMonthly = (loans || []).reduce((s, l) => s + (l.emi_amount || 0), 0);
  } catch {}

  return (
    <DashboardClient
      transactions={txResult.data || []}
      budgets={budgetResult.data || []}
      currentMonth={currentMonth}
      userEmail={user!.email || ""}
      userSettings={settingsResult.data || null}
      cashWithdrawals={withdrawalResult.data || []}
      credits={credits}
      totalSipMonthly={totalSipMonthly}
      totalEmiMonthly={totalEmiMonthly}
      netWorthEntries={netWorthEntries}
      bills={bills}
      incomeEntries={incomeEntries}
    />
  );
}
