import { createClient } from "@/lib/supabase/server";
import LoanClient from "./LoanClient";

export default async function LoansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: loans } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return <LoanClient loans={loans || []} userId={user!.id} />;
}
