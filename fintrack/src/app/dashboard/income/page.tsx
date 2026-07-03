import { createClient } from "@/lib/supabase/server";
import { IncomeEntry, UserSettings } from "@/types";
import { getLast6Months } from "@/lib/utils";
import IncomeClient from "./IncomeClient";

export default async function IncomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const last6 = getLast6Months();
  const startDate = `${last6[0]}-01`;

  let entries: IncomeEntry[] = [];
  let userSettings: UserSettings | null = null;
  try {
    const [{ data: incData }, { data: settings }] = await Promise.all([
      supabase.from("income_entries").select("*").eq("user_id", user!.id).gte("date", startDate).order("date", { ascending: false }),
      supabase.from("user_settings").select("*").eq("user_id", user!.id).maybeSingle(),
    ]);
    entries = (incData || []) as IncomeEntry[];
    userSettings = settings as UserSettings | null;
  } catch {}

  return <IncomeClient entries={entries} userSettings={userSettings} />;
}
