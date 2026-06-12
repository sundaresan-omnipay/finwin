import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  return <SettingsClient user={user!} userSettings={userSettings || null} />;
}
