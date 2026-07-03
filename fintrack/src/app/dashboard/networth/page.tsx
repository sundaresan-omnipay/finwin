import { createClient } from "@/lib/supabase/server";
import { NetWorthEntry } from "@/types";
import NetWorthClient from "./NetWorthClient";

export default async function NetWorthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let entries: NetWorthEntry[] = [];
  try {
    const { data } = await supabase.from("net_worth_entries").select("*").eq("user_id", user!.id).order("created_at", { ascending: true });
    entries = (data || []) as NetWorthEntry[];
  } catch {}

  return <NetWorthClient entries={entries} />;
}
