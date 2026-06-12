import { createClient } from "@/lib/supabase/server";
import WrappedClient from "./WrappedClient";

export default async function WrappedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const year = new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const [{ data: transactions }, { data: budgets }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user!.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true }),
    supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user!.id)
      .gte("month", `${year}-01`)
      .lte("month", `${year}-12`),
  ]);

  return (
    <WrappedClient
      transactions={transactions || []}
      budgets={budgets || []}
      year={year}
      userEmail={user!.email || ""}
    />
  );
}
