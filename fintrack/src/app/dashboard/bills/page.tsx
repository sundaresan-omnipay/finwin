import { createClient } from "@/lib/supabase/server";
import { Bill } from "@/types";
import BillsClient from "./BillsClient";

export default async function BillsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let bills: Bill[] = [];
  try {
    const { data } = await supabase.from("bills").select("*").eq("user_id", user!.id).order("due_day", { ascending: true });
    bills = (data || []) as Bill[];
  } catch {}

  return <BillsClient bills={bills} />;
}
