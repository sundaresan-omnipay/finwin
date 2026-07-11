"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Loader2, Pencil, Trash2, CheckCircle2, PlusCircle, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Goal } from "@/types";
import { BlurAmount } from "@/components/ui/BlurAmount";
import { formatCurrency } from "@/lib/utils";

interface Props {
  goals: Goal[];
  userId: string;
}

const GOAL_ICONS = ["🏠", "🚗", "✈️", "📚", "💍", "🏖️", "💻", "🎯", "💰", "🌟"];

const emptyForm = {
  goal_name: "",
  target_amount: "",
  current_amount: "0",
  target_date: "",
  notes: "",
};

const addForm = { amount: "" };

export default function GoalsClient({ goals, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [addAmountForm, setAddAmountForm] = useState(addForm);
  const [addLoading, setAddLoading] = useState(false);

  const activeGoals = goals.filter((g) => !g.is_completed);
  const completedGoals = goals.filter((g) => g.is_completed);
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0);
  const totalSaved = activeGoals.reduce((s, g) => s + g.current_amount, 0);

  function openAdd() {
    setEditingGoal(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal);
    setForm({
      goal_name: goal.goal_name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      target_date: goal.target_date ?? "",
      notes: goal.notes ?? "",
    });
    setError("");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      user_id: userId,
      goal_name: form.goal_name.trim(),
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount) || 0,
      target_date: form.target_date || null,
      notes: form.notes.trim() || null,
    };
    if (editingGoal) {
      const { error: err } = await supabase.from("goals").update(payload).eq("id", editingGoal.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from("goals").insert({ ...payload, is_completed: false });
      if (err) { setError(err.message); setLoading(false); return; }
    }
    setOpen(false);
    router.refresh();
    setLoading(false);
  }

  async function handleAddAmount(goal: Goal) {
    const amount = parseFloat(addAmountForm.amount);
    if (!amount || amount <= 0) return;
    setAddLoading(true);
    const newAmount = goal.current_amount + amount;
    const isNowComplete = newAmount >= goal.target_amount;
    await supabase.from("goals").update({
      current_amount: newAmount,
      is_completed: isNowComplete,
    }).eq("id", goal.id);
    setAddingToId(null);
    setAddAmountForm(addForm);
    router.refresh();
    setAddLoading(false);
  }

  async function handleToggleComplete(goal: Goal) {
    await supabase.from("goals").update({ is_completed: !goal.is_completed }).eq("id", goal.id);
    router.refresh();
  }

  async function handleDelete(goal: Goal) {
    if (!confirm(`Delete goal "${goal.goal_name}"?`)) return;
    await supabase.from("goals").delete().eq("id", goal.id);
    router.refresh();
  }

  function getIcon(name: string | undefined | null) {
    if (!name) return "🎯";
    const map: Record<string, string> = {
      home: "🏠", house: "🏠", car: "🚗", vehicle: "🚗",
      travel: "✈️", vacation: "🏖️", trip: "✈️",
      education: "📚", college: "📚", study: "📚",
      wedding: "💍", marriage: "💍",
      laptop: "💻", computer: "💻", phone: "📱",
      emergency: "🛡️", fund: "💰",
    };
    const lower = name.toLowerCase();
    for (const [key, icon] of Object.entries(map)) {
      if (lower.includes(key)) return icon;
    }
    return GOAL_ICONS[name.charCodeAt(0) % GOAL_ICONS.length];
  }

  function daysLeft(targetDate: string) {
    const diff = Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return "Overdue";
    if (diff === 0) return "Due today";
    if (diff < 30) return `${diff}d left`;
    const months = Math.round(diff / 30);
    return `${months}mo left`;
  }

  function monthlyNeeded(goal: Goal): { amount: number; months: number } | null {
    if (!goal.target_date) return null;
    const remaining = goal.target_amount - goal.current_amount;
    if (remaining <= 0) return null;
    const months = Math.max(1, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)));
    return { amount: Math.ceil(remaining / months), months };
  }

  function projectedCompletion(goal: Goal): string | null {
    if (goal.current_amount <= 0) return null;
    const createdAt = new Date(goal.created_at);
    const elapsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (elapsed <= 0) return null;
    const monthlyRate = goal.current_amount / elapsed;
    if (monthlyRate <= 0) return null;
    const remaining = goal.target_amount - goal.current_amount;
    if (remaining <= 0) return null;
    const monthsLeft = Math.ceil(remaining / monthlyRate);
    const completionDate = new Date();
    completionDate.setMonth(completionDate.getMonth() + monthsLeft);
    return completionDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-700">Savings Goals</h1>
          <p className="text-muted-foreground text-sm mt-1">Track progress toward your financial goals</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Add goal
        </button>
      </div>

      {/* Summary cards */}
      {activeGoals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Active goals", value: <span className="number-font text-2xl font-700 text-white">{activeGoals.length}</span>, sub: `${completedGoals.length} completed`, icon: "🎯", color: "from-violet-500 to-purple-600" },
            { label: "Total target", value: <BlurAmount value={totalTarget} className="number-font text-2xl font-700 text-white" />, sub: "Across all active goals", icon: "🏆", color: "from-amber-500 to-orange-600" },
            { label: "Total saved", value: <BlurAmount value={totalSaved} className="number-font text-2xl font-700 text-white" />, sub: `${Math.round((totalSaved / totalTarget) * 100) || 0}% of total target`, icon: "💰", color: "from-emerald-500 to-teal-600" },
          ].map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`rounded-2xl p-5 bg-gradient-to-br ${card.color} text-white relative overflow-hidden`}>
              <div className="absolute -top-3 -right-3 text-5xl opacity-20">{card.icon}</div>
              <div className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">{card.label}</div>
              <div className="mb-1">{card.value}</div>
              <div className="text-white/60 text-xs">{card.sub}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Target className="w-12 h-12 text-muted-foreground/30" />
          <p className="font-display text-lg font-600">No goals yet</p>
          <p className="text-muted-foreground text-sm">Set a savings goal — vacation, emergency fund, new car, anything</p>
          <button onClick={openAdd} className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Add your first goal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active goals */}
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              {activeGoals.map((goal, i) => {
                const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
                const remaining = goal.target_amount - goal.current_amount;
                const isAdding = addingToId === goal.id;
                const needed = monthlyNeeded(goal);
                const projected = !goal.target_date ? projectedCompletion(goal) : null;
                return (
                  <motion.div key={goal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-card border border-border/50 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-lg flex-shrink-0">
                          {getIcon(goal.goal_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{goal.goal_name}</span>
                            {goal.target_date && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                daysLeft(goal.target_date) === "Overdue"
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                                  : "bg-secondary text-muted-foreground"
                              }`}>
                                {daysLeft(goal.target_date)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <BlurAmount value={goal.current_amount} className="font-medium" />
                            {" "}saved of{" "}
                            <BlurAmount value={goal.target_amount} className="font-medium" />
                            {remaining > 0 && (
                              <> · <BlurAmount value={remaining} className="text-muted-foreground" /> to go</>
                            )}
                          </div>
                          {needed && (
                            <div className="text-xs mt-1 font-medium text-violet-600 dark:text-violet-400">
                              Save {formatCurrency(needed.amount)}/month to reach by target date
                            </div>
                          )}
                          {projected && !needed && (
                            <div className="text-xs mt-1 text-muted-foreground">
                              At current pace → {projected}
                            </div>
                          )}
                          {goal.notes && <div className="text-xs text-muted-foreground/70 italic mt-0.5">{goal.notes}</div>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => { setAddingToId(isAdding ? null : goal.id); setAddAmountForm(addForm); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-all">
                          <PlusCircle className="w-3 h-3" />
                          Add
                        </button>
                        <button onClick={() => handleToggleComplete(goal)} className="p-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-colors" title="Mark complete">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openEdit(goal)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(goal)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                        <span>{pct}% saved</span>
                        {goal.target_date && (
                          <span>Target: {new Date(goal.target_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
                        )}
                      </div>
                      <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={`h-full rounded-full ${pct >= 100 ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gradient-to-r from-violet-500 to-purple-500"}`}
                        />
                      </div>
                    </div>

                    {/* Add amount inline */}
                    <AnimatePresence>
                      {isAdding && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border/50">
                            <input
                              type="number" min="1" step="0.01" autoFocus
                              value={addAmountForm.amount}
                              onChange={(e) => setAddAmountForm({ amount: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAmount(goal); } }}
                              className="flex-1 h-9 px-3 rounded-lg border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                              placeholder="Amount to add (₹)"
                            />
                            <button onClick={() => handleAddAmount(goal)} disabled={addLoading}
                              className="h-9 px-4 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-60 transition-colors">
                              {addLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                            </button>
                            <button onClick={() => setAddingToId(null)} className="h-9 px-3 rounded-lg border border-border text-xs hover:bg-secondary transition-colors">
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Completed goals */}
          {completedGoals.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Completed 🎉</h2>
              {completedGoals.map((goal) => (
                <div key={goal.id} className="bg-card border border-border/30 rounded-2xl p-4 opacity-60">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-base">
                        {getIcon(goal.goal_name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm line-through text-muted-foreground">{goal.goal_name}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Done ✓</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          <BlurAmount value={goal.target_amount} className="font-medium" /> saved
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleToggleComplete(goal)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary transition-colors">Reopen</button>
                      <button onClick={() => handleDelete(goal)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-600">{editingGoal ? "Edit goal" : "Add goal"}</h2>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Goal name</label>
                <input type="text" required value={form.goal_name} onChange={(e) => setForm({ ...form, goal_name: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="e.g. Emergency Fund, Europe Trip, New Car" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Target amount (₹)</label>
                  <input type="number" required min="1" step="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="100000" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Already saved (₹)</label>
                  <input type="number" min="0" step="0.01" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Target date (optional)</label>
                <input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Notes (optional)</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="e.g. 6 months of expenses" />
              </div>
              {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingGoal ? "Save changes" : "Add goal"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
