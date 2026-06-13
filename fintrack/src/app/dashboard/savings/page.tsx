import { createClient } from "@/lib/supabase/server";
import SavingsClient from "./SavingsClient";

export default async function SavingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: sips } = await supabase
    .from("sips")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return <SavingsClient sips={sips || []} userId={user!.id} />;
}
