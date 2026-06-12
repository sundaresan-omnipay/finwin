import { createClient } from "@/lib/supabase/server";
import { getMonthKey, getLast6Months, getSalaryCycleBounds } from "@/lib/utils";
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

  return (
    <DashboardClient
      transactions={txResult.data || []}
      budgets={budgetResult.data || []}
      currentMonth={currentMonth}
      userEmail={user!.email || ""}
      userSettings={settingsResult.data || null}
      cashWithdrawals={withdrawalResult.data || []}
    />
  );
}
