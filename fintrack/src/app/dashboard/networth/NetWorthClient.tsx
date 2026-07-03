"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Trash2, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import { NetWorthEntry, ASSET_CATEGORIES, LIABILITY_CATEGORIES } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props { entries: NetWorthEntry[] }

const BLANK = { name: "", amount: "", type: "asset" as "asset" | "liability", category: "cash_savings", notes: "" };

const ALL_CATS = {
  asset: ASSET_CATEGORIES,
  liability: LIABILITY_CATEGORIES,
};

function getCatMeta(type: "asset" | "liability", category: string) {
  const list = type === "asset" ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;
  return list.find(c => c.value === category) ?? { value: category, label: category, icon: "💼" };
}

export default function NetWorthClient({ entries }: Props) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const assets = useMemo(() => entries.filter(e => e.type === "asset"), [entries]);
  const liabilities = useMemo(() => entries.filter(e => e.type === "liability"), [entries]);
  const totalAssets = useMemo(() => assets.reduce((s, e) => s + e.amount, 0), [assets]);
  const totalLiabilities = useMemo(() => liabilities.reduce((s, e) => s + e.amount, 0), [liabilities]);
  const netWorth = totalAssets - totalLiabilities;

  async function handleSave() {
    if (!form.name.trim() || !form.amount) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("net_worth_entries").insert({
      user_id: user!.id,
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      type: form.type,
      category: form.category,
      notes: form.notes.trim() || null,
    });
    setForm(BLANK);
    setShowForm(false);
    router.refresh();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this entry?")) return;
    setDeleting(id);
    await supabase.from("net_worth_entries").delete().eq("id", id);
    router.refresh();
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Net Worth</h1>
          <p className="text-muted-foreground text-sm">Assets minus liabilities — your true financial picture</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Add entry
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Total Assets</span>
          </div>
          <BlurAmount value={totalAssets} className="number-font text-2xl font-700 text-emerald-700 dark:text-emerald-400" />
          <div className="text-xs text-emerald-600/70 dark:text-emerald-500 mt-1">{assets.length} entries</div>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Liabilities</span>
          </div>
          <BlurAmount value={totalLiabilities} className="number-font text-2xl font-700 text-red-600 dark:text-red-400" />
          <div className="text-xs text-red-500/70 dark:text-red-500 mt-1">{liabilities.length} entries</div>
        </div>
        <div className={`rounded-2xl p-5 border ${netWorth >= 0 ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40"}`}>
          <div className="flex items-center gap-2 mb-3">
            <PieChart className={`w-4 h-4 ${netWorth >= 0 ? "text-blue-600" : "text-amber-600"}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${netWorth >= 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"}`}>Net Worth</span>
          </div>
          <BlurAmount value={Math.abs(netWorth)} className={`number-font text-2xl font-700 ${netWorth >= 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"}`} />
          <div className={`text-xs mt-1 ${netWorth >= 0 ? "text-blue-600/70 dark:text-blue-500" : "text-amber-600/70 dark:text-amber-500"}`}>
            {netWorth >= 0 ? "Assets exceed liabilities" : "Liabilities exceed assets"}
          </div>
        </div>
      </div>

      {/* Asset bar */}
      {(totalAssets + totalLiabilities) > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Assets {totalAssets + totalLiabilities > 0 ? ((totalAssets / (totalAssets + totalLiabilities)) * 100).toFixed(0) : 0}%</span>
            <span>Liabilities {totalAssets + totalLiabilities > 0 ? ((totalLiabilities / (totalAssets + totalLiabilities)) * 100).toFixed(0) : 0}%</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 rounded-l-full transition-all" style={{ width: `${totalAssets + totalLiabilities > 0 ? (totalAssets / (totalAssets + totalLiabilities)) * 100 : 0}%` }} />
            <div className="h-full bg-red-400 rounded-r-full transition-all" style={{ width: `${totalAssets + totalLiabilities > 0 ? (totalLiabilities / (totalAssets + totalLiabilities)) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-display text-sm font-600">New entry</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. HDFC FD, Home Loan"
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Type</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as "asset" | "liability", category: e.target.value === "asset" ? "cash_savings" : "home_loan" })}
                className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none"
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">Amount (₹)</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
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
                {ALL_CATS[form.type].map(c => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.amount}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save entry"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Assets list */}
      {assets.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50 bg-emerald-50/50 dark:bg-emerald-950/10 flex items-center justify-between">
            <span className="text-xs font-700 text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Assets</span>
            <BlurAmount value={totalAssets} className="number-font text-sm font-700 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="divide-y divide-border/40">
            {assets.map((e, i) => {
              const cat = getCatMeta("asset", e.category);
              return (
                <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/30 group">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-base flex-shrink-0">{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{cat.label}</div>
                  </div>
                  <BlurAmount value={e.amount} className="number-font text-sm font-600 text-emerald-600 dark:text-emerald-400" />
                  <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all ml-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liabilities list */}
      {liabilities.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50 bg-red-50/50 dark:bg-red-950/10 flex items-center justify-between">
            <span className="text-xs font-700 text-red-600 dark:text-red-400 uppercase tracking-wide">Liabilities</span>
            <BlurAmount value={totalLiabilities} className="number-font text-sm font-700 text-red-600 dark:text-red-400" />
          </div>
          <div className="divide-y divide-border/40">
            {liabilities.map((e, i) => {
              const cat = getCatMeta("liability", e.category);
              return (
                <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/30 group">
                  <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-base flex-shrink-0">{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{cat.label}</div>
                  </div>
                  <BlurAmount value={e.amount} className="number-font text-sm font-600 text-red-600 dark:text-red-400" />
                  <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all ml-1">
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
          <PieChart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No entries yet</p>
          <p className="text-xs mt-1">Add your bank balance, FDs, mutual funds, property — and loans.</p>
        </div>
      )}
    </div>
  );
}
