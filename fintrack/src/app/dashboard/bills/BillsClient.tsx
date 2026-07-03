"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Trash2, Bell, CheckCircle2, AlertCircle } from "lucide-react";
import { Bill, CATEGORY_META, CATEGORIES } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props { bills: Bill[] }

const BLANK = { name: "", amount: "", due_day: "1", category: "bills", notes: "" };

function getDaysLeft(dueDay: number): number {
  const today = new Date();
  const todayDay = today.getDate();
  let dueThisMonth = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (dueThisMonth < today) {
    dueThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
  }
  return Math.ceil((dueThisMonth.getTime() - new Date(today.getFullYear(), today.getMonth(), todayDay).getTime()) / 86400000);
}

export default function BillsClient({ bills }: Props) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const billsWithDays = useMemo(() =>
    bills.map(b => ({ ...b, daysLeft: getDaysLeft(b.due_day) }))
      .sort((a, b) => a.daysLeft - b.daysLeft),
    [bills]
  );

  const totalMonthlyBills = useMemo(() =>
    bills.filter(b => b.amount).reduce((s, b) => s + (b.amount ?? 0), 0),
    [bills]
  );

  async function handleSave() {
    if (!form.name.trim() || !form.due_day) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("bills").insert({
      user_id: user!.id,
      name: form.name.trim(),
      amount: form.amount ? parseFloat(form.amount) : null,
      due_day: parseInt(form.due_day),
      category: form.category,
      notes: form.notes.trim() || null,
    });
    setForm(BLANK);
    setShowForm(false);
    router.refresh();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this bill?")) return;
    setDeleting(id);
    await supabase.from("bills").delete().eq("id", id);
    router.refresh();
    setDeleting(null);
  }

  async function handleToggle(bill: Bill) {
    await supabase.from("bills").update({ is_active: !bill.is_active }).eq("id", bill.id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Bill Reminders</h1>
          <p className="text-muted-foreground text-sm">Never miss a due date or pay a late fee</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Add bill
        </button>
      </div>

      {/* Summary */}
      {bills.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-4">
            <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">Due in 7 days</div>
            <div className="number-font text-2xl font-700 text-amber-700 dark:text-amber-400">
              {billsWithDays.filter(b => b.daysLeft <= 7 && b.is_active).length}
            </div>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">Total bills</div>
            <div className="number-font text-2xl font-700">{bills.filter(b => b.is_active).length}</div>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">Monthly total</div>
            <BlurAmount value={totalMonthlyBills} className="number-font text-xl font-700" />
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
          <h3 className="font-display text-sm font-600">New bill</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Bill name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Electricity, Credit Card, Netflix"
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Due on (day of month)</label>
              <input
                type="number"
                min={1} max={31}
                value={form.due_day}
                onChange={e => setForm({ ...form, due_day: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Amount (₹, optional)</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="Leave blank if variable"
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save bill"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Bills list */}
      {billsWithDays.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <div className="divide-y divide-border/40">
            {billsWithDays.map((bill, i) => {
              const meta = CATEGORY_META[bill.category as keyof typeof CATEGORY_META];
              const isUrgent = bill.daysLeft <= 3 && bill.is_active;
              const isDueToday = bill.daysLeft === 0;
              return (
                <motion.div key={bill.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-3 px-5 py-3.5 group ${!bill.is_active ? "opacity-50" : ""} hover:bg-secondary/30 transition-colors`}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: meta?.lightColor }}>
                    {meta?.icon ?? "📄"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{bill.name}</div>
                    <div className="text-xs text-muted-foreground">Due on {bill.due_day}{bill.due_day === 1 ? "st" : bill.due_day === 2 ? "nd" : bill.due_day === 3 ? "rd" : "th"} of every month</div>
                  </div>
                  {bill.amount && <BlurAmount value={bill.amount} className="number-font text-sm font-600 text-muted-foreground" />}
                  <div className={`flex items-center gap-1 text-xs font-medium flex-shrink-0 ${isDueToday ? "text-red-500" : isUrgent ? "text-amber-500" : "text-muted-foreground"}`}>
                    {isDueToday ? <AlertCircle className="w-3.5 h-3.5" /> : isUrgent ? <Bell className="w-3.5 h-3.5" /> : null}
                    {isDueToday ? "Due today" : bill.daysLeft === 1 ? "Tomorrow" : `${bill.daysLeft}d`}
                  </div>
                  <button onClick={() => handleToggle(bill)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title={bill.is_active ? "Pause" : "Activate"}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${bill.is_active ? "text-emerald-500" : ""}`} />
                  </button>
                  <button onClick={() => handleDelete(bill.id)} disabled={deleting === bill.id} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {bills.length === 0 && !showForm && (
        <div className="bg-card border border-border/50 rounded-2xl text-center py-16 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No bills set up yet</p>
          <p className="text-xs mt-1">Add electricity, rent, credit card, subscriptions — anything with a monthly due date.</p>
        </div>
      )}
    </div>
  );
}
