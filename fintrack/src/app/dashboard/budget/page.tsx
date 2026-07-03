import { createClient } from "@/lib/supabase/server";
import { getMonthKey, getSalaryCycleBounds, getLast6Months } from "@/lib/utils";
import BudgetClient from "./BudgetClient";

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: settingsData } = await supabase
    .from("user_settings")
    .select("salary_day, monthly_salary")
    .eq("user_id", user!.id)
    .maybeSingle();

  const salaryDay = settingsData?.salary_day ?? 1;
  const cycle = getSalaryCycleBounds(salaryDay);

  // Historical start: 6 months back, for budget suggestions
  const last6 = getLast6Months();
  const historyStart = `${last6[0]}-01`;

  const [{ data: transactions }, { data: budgets }, { data: historicalTxns }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .gte("date", cycle.start)
      .lte("date", cycle.end)
      .order("date", { ascending: false }),
    supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user!.id)
      .eq("month", cycle.monthKey),
    // Fetch transactions BEFORE current cycle for suggestions
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .gte("date", historyStart)
      .lt("date", cycle.start)
      .order("date", { ascending: false }),
  ]);

  return (
    <BudgetClient
      transactions={transactions || []}
      budgets={budgets || []}
      historicalTransactions={historicalTxns || []}
      currentMonth={cycle.monthKey}
      cycleLabel={cycle.label}
      userId={user!.id}
      monthlySalary={settingsData?.monthly_salary ?? null}
    />
  );
}
