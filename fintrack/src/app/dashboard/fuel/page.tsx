import { createClient } from "@/lib/supabase/server";
import { FuelLog } from "@/types";
import FuelClient from "./FuelClient";

export default async function FuelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let logs: FuelLog[] = [];
  try {
    const { data } = await supabase
      .from("fuel_logs")
      .select("*")
      .eq("user_id", user!.id)
      .order("odometer", { ascending: false });
    logs = (data || []) as FuelLog[];
  } catch {}

  return <FuelClient logs={logs} />;
}
