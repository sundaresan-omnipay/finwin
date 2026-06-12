import { createClient } from "@/lib/supabase/server";
import LoanClient from "./LoanClient";

export default async function LoansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const currentMonth = new Date().toISOString().slice(0, 7);

  const [{ data: loans }, { data: transactions }] = await Promise.all([
    supabase
      .from("loans")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, description, amount, date, category")
      .eq("user_id", user!.id)
      .eq("category", "emi")
      .gte("date", currentMonth + "-01")
      .lte("date", currentMonth + "-31"),
  ]);

  return (
    <LoanClient
      loans={loans || []}
      currentMonthTxns={transactions || []}
      userId={user!.id}
    />
  );
}
