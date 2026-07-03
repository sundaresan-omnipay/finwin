"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Trash2, TrendingUp, Wallet, ArrowUpRight } from "lucide-react";
import { IncomeEntry, IncomeType, UserSettings } from "@/types";
import { formatCurrency, getSalaryCycleBounds } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props { entries: IncomeEntry[]; userSettings: UserSettings | null }

const INCOME_TYPES: { value: IncomeType; label: string; icon: string; color: string }[] = [
  { value: "freelance", label: "Freelance", icon: "💻", color: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" },
  { value: "rental", label: "Rental", icon: "🏠", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  { value: "dividend", label: "Dividend", icon: "📈", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  { value: "bonus", label: "Bonus", icon: "🎯", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  { value: "gift", label: "Gift", icon: "🎁", color: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400" },
  { value: "other", label: "Other", icon: "💰", color: "bg-gray-100 text-gray-700 dark:bg-gray-950/40 dark:text-gray-400" },
];

const BLANK = { source: "", amount: "", date: new Date().toISOString().split("T")[0], income_type: "freelance" as IncomeType, notes: "" };

function getTypeMeta(type: IncomeType) {
  return INCOME_TYPES.find(t => t.value === type) ?? INCOME_TYPES[INCOME_TYPES.length - 1];
}

export default function IncomeClient({ entries, userSettings }: Props) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const salaryDay = userSettings?.salary_day ?? 1;
  const monthlySalary = userSettings?.monthly_salary ?? 0;
  const cycle = useMemo(() => getSalaryCycleBounds(salaryDay), [salaryDay]);

  const cycleEntries = useMemo(() => entries.filter(e => e.date >= cycle.start && e.date <= cycle.end), [entries, cycle]);
  const cycleTotal = useMemo(() => cycleEntries.reduce((s, e) => s + e.amount, 0), [cycleEntries]);
  const totalIncome = (monthlySalary ?? 0) + cycleTotal;

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => { map[e.income_type] = (map[e.income_type] || 0) + e.amount; });
    return map;
  }, [entries]);

  async function handleSave() {
    if (!form.source.trim() || !form.amount) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("income_entries").insert({
      user_id: user!.id,
      source: form.source.trim(),
      amount: parseFloat(form.amount),
      date: form.date,
      income_type: form.income_type,
      notes: form.notes.trim() || null,
    });
    setForm(BLANK);
    setShowForm(false);
    router.refresh();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    setDeleting(id);
    await supabase.from("income_entries").delete().eq("id", id);
    router.refresh();
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Income Tracker</h1>
          <p className="text-muted-foreground text-sm">Freelance, rental, dividends, bonuses — all your income sources</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Log income
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-violet-500" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Salary</span>
          </div>
          <BlurAmount value={monthlySalary} className="number-font text-xl font-700" />
          <div className="text-xs text-muted-foreground mt-1">This cycle</div>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Extra</span>
          </div>
          <BlurAmount value={cycleTotal} className="number-font text-xl font-700 text-emerald-600 dark:text-emerald-400" />
          <div className="text-xs text-muted-foreground mt-1">{cycleEntries.length} entries this cycle</div>
        </div>
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary/70 font-medium uppercase tracking-wide">Total</span>
          </div>
          <BlurAmount value={totalIncome} className="number-font text-xl font-700 text-primary" />
          <div className="text-xs text-muted-foreground mt-1">Combined this cycle</div>
        </div>
      </div>

      {/* Income type breakdown */}
      {Object.keys(byType).length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-5">
          <h3 className="font-display text-sm font-600 mb-3">By type (last 6 months)</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, amt]) => {
              const meta = getTypeMeta(type as IncomeType);
              return (
                <div key={type} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${meta.color}`}>
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  <BlurAmount value={amt} className="number-font font-700" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
          <h3 className="font-display text-sm font-600">Log income</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Source</label>
              <input
                type="text"
                value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value })}
                placeholder="e.g. Upwork project, Rent from tenant"
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Amount (₹)</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Type</label>
              <div className="flex flex-wrap gap-2">
                {INCOME_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setForm({ ...form, income_type: t.value })}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${form.income_type === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.source.trim() || !form.amount} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save income"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Entries list */}
      {entries.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <div className="divide-y divide-border/40">
            {entries.map((e, i) => {
              const meta = getTypeMeta(e.income_type);
              return (
                <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/30 group">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${meta.color.split(" ").slice(0, 2).join(" ")}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.source}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta.label} · {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <BlurAmount value={e.amount} className="number-font text-sm font-700 text-emerald-600 dark:text-emerald-400" />
                  <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {entries.length === 0 && !showForm && (
        <div className="bg-card border border-border/50 rounded-2xl text-center py-16 text-muted-foreground">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No extra income logged</p>
          <p className="text-xs mt-1">Track freelance projects, rental income, dividends, bonuses.</p>
        </div>
      )}
    </div>
  );
}
