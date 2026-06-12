import { createClient } from "@/lib/supabase/server";
import SavingsClient from "./SavingsClient";

export default async function SavingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const [{ data: sips }, { data: transactions }] = await Promise.all([
    supabase
      .from("sips")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("id, description, amount, date, category")
      .eq("user_id", user!.id)
      .eq("category", "savings")
      .gte("date", currentMonth + "-01")
      .lte("date", currentMonth + "-31"),
  ]);

  return (
    <SavingsClient
      sips={sips || []}
      currentMonthTxns={transactions || []}
      userId={user!.id}
    />
  );
}
