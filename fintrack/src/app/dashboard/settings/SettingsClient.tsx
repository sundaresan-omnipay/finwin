"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Shield, Bell, Trash2, LogOut, Loader2, CheckCircle2 } from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface Props {
  user: SupabaseUser;
}

export default function SettingsClient({ user }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get("password") as string;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage("Error: " + error.message);
    } else {
      setMessage("Password updated successfully!");
      (e.target as HTMLFormElement).reset();
    }
    setLoading(false);
    setTimeout(() => setMessage(""), 4000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  async function handleDeleteAccount() {
    if (!confirm("Are you sure you want to delete your account? All your data will be lost permanently.")) return;
    if (!confirm("This is irreversible. Are you absolutely sure?")) return;
    setLoading(true);
    // Delete all user data first
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      await supabase.from("transactions").delete().eq("user_id", u.id);
      await supabase.from("budgets").delete().eq("user_id", u.id);
    }
    await supabase.auth.signOut();
    router.push("/auth");
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-700 mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <User className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-display text-base font-600">Profile</h3>
        </div>

        <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-lg font-600 text-primary">
              {user.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-medium text-sm">{user.email}</div>
            <div className="text-xs text-muted-foreground">
              Member since {new Date(user.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Security */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-display text-base font-600">Security</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block text-muted-foreground">New password</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Min. 6 characters"
            />
          </div>
          {message && (
            <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl ${message.startsWith("Error") ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-400"}`}>
              {!message.startsWith("Error") && <CheckCircle2 className="w-4 h-4" />}
              {message}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
          </button>
        </form>
      </motion.div>

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="bg-card border border-destructive/20 rounded-2xl p-6"
      >
        <h3 className="font-display text-base font-600 text-destructive mb-1">Danger zone</h3>
        <p className="text-xs text-muted-foreground mb-5">Irreversible and destructive actions</p>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <div>
              <div className="text-sm font-medium">Sign out</div>
              <div className="text-xs text-muted-foreground">Sign out of your account</div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium text-destructive">Delete account</div>
              <div className="text-xs text-muted-foreground">Permanently delete your account and all data</div>
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
