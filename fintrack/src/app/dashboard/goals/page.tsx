import { createClient } from "@/lib/supabase/server";
import GoalsClient from "./GoalsClient";
import { Goal } from "@/types";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let goals: Goal[] = [];
  try {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    goals = data || [];
  } catch {
    goals = [];
  }

  return <GoalsClient goals={goals} userId={user!.id} />;
}
