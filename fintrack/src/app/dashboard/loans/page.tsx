import { createClient } from "@/lib/supabase/server";
import LoanClient from "./LoanClient";

export default async function LoansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: loans }, { data: settings }] = await Promise.all([
    supabase.from("loans").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("user_settings").select("monthly_salary").eq("user_id", user!.id).maybeSingle(),
  ]);

  return (
    <LoanClient
      loans={loans || []}
      userId={user!.id}
      monthlySalary={settings?.monthly_salary ?? null}
    />
  );
}
