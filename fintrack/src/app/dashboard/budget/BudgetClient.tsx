"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Loader2, Clock, Sparkles, Plus, ChevronDown, Copy } from "lucide-react";
import { Transaction, Budget, CATEGORY_META, CATEGORY_GROUPS, Category } from "@/types";
import { formatCurrency, computeWorkHours, isSipOrEmiTx } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props {
  transactions: Transaction[];
  historicalTransactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  cycleLabel: string;
  userId: string;
  monthlySalary: number | null;
}

export default function BudgetClient({ transactions, historicalTransactions, budgets, currentMonth, cycleLabel, userId, monthlySalary }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [copyingLast, setCopyingLast] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [localBudgets, setLocalBudgets] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    budgets.forEach((b) => { map[b.category] = String(b.amount); });
    return map;
  });

  const dayToDay = useMemo(
    () => transactions.filter(t => !isSipOrEmiTx(t)),
    [transactions]
  );

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    dayToDay.forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [dayToDay]);

  const totalSpent = useMemo(() => Object.values(categoryTotals).reduce((s, v) => s + v, 0), [categoryTotals]);
  const totalBudget = useMemo(
    () => Object.values(localBudgets).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [localBudgets]
  );

  const suggestions = useMemo(() => {
    const hist = historicalTransactions.filter(t => !isSipOrEmiTx(t));
    if (!hist.length) return {} as Record<string, number>;

    const byMonth: Record<string, Record<string, number>> = {};
    hist.forEach(t => {
      const m = t.date.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = {};
      byMonth[m][t.category] = (byMonth[m][t.category] || 0) + t.amount;
    });

    const months = Object.keys(byMonth);
    const result: Record<string, number> = {};

    CATEGORY_GROUPS.forEach(group => {
      group.categories.forEach(cat => {
        const totals = months.map(m => byMonth[m][cat] || 0);
        const nonZero = totals.filter(v => v > 0);
        if (!nonZero.length) return;
        const avg = nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
        result[cat] = Math.ceil((avg * 1.1) / 100) * 100;
      });
    });

    return result;
  }, [historicalTransactions]);

  const hasSuggestions = Object.keys(suggestions).length > 0;

  async function saveBudget(category: string, overrideAmount?: number) {
    const amount = overrideAmount ?? parseFloat(localBudgets[category] || "0");
    if (isNaN(amount) || amount < 0) return;
    setSaving(category);

    const existing = budgets.find((b) => b.category === category);
    if (existing) {
      await supabase.from("budgets").update({ amount }).eq("id", existing.id);
    } else {
      await supabase.from("budgets").insert({ user_id: userId, category, amount, month: currentMonth });
    }
    router.refresh();
    setSaving(null);
  }

  async function applyAllSuggestions() {
    if (!hasSuggestions) return;
    setApplyingAll(true);

    const updates = Object.entries(suggestions);
    const newBudgets = { ...localBudgets };
    updates.forEach(([cat, val]) => { newBudgets[cat] = String(val); });
    setLocalBudgets(newBudgets);

    for (const [cat, val] of updates) {
      const existing = budgets.find((b) => b.category === cat);
      if (existing) {
        await supabase.from("budgets").update({ amount: val }).eq("id", existing.id);
      } else {
        await supabase.from("budgets").insert({ user_id: userId, category: cat, amount: val, month: currentMonth });
      }
    }

    router.refresh();
    setApplyingAll(false);
  }

  async function copyFromLastMonth() {
    setCopyingLast(true);
    const [year, month] = currentMonth.split("-").map(Number);
    const prevMonth = month === 1
      ? `${year - 1}-12`
      : `${year}-${String(month - 1).padStart(2, "0")}`;

    const { data: prevBudgets } = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .eq("month", prevMonth);

    if (!prevBudgets?.length) {
      setCopyingLast(false);
      return;
    }

    const newBudgets = { ...localBudgets };
    prevBudgets.forEach((b) => { newBudgets[b.category] = String(b.amount); });
    setLocalBudgets(newBudgets);

    for (const b of prevBudgets) {
      const existing = budgets.find((ex) => ex.category === b.category);
      if (existing) {
        await supabase.from("budgets").update({ amount: b.amount }).eq("id", existing.id);
      } else {
        await supabase.from("budgets").insert({ user_id: userId, category: b.category, amount: b.amount, month: currentMonth });
      }
    }

    router.refresh();
    setCopyingLast(false);
  }

  function isActive(cat: Category): boolean {
    return (categoryTotals[cat] || 0) > 0
      || parseFloat(localBudgets[cat] || "0") > 0
      || expanded.has(cat);
  }

  function toggleExpand(cat: Category) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  // Categories approaching (80–99%) or over (100%+) their budget
  const alertCategories = useMemo(() => {
    return Object.entries(categoryTotals)
      .map(([cat, spent]) => {
        const budget = parseFloat(localBudgets[cat] || "0");
        if (!budget) return null;
        const pct = (spent / budget) * 100;
        if (pct < 80) return null;
        const meta = CATEGORY_META[cat as keyof typeof CATEGORY_META];
        return { cat, spent, budget, pct, meta, isOver: pct >= 100 };
      })
      .filter(Boolean)
      .sort((a, b) => b!.pct - a!.pct) as Array<{ cat: string; spent: number; budget: number; pct: number; meta: typeof CATEGORY_META[keyof typeof CATEGORY_META]; isOver: boolean }>;
  }, [categoryTotals, localBudgets]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Budget</h1>
          <p className="text-muted-foreground text-sm">{cycleLabel}</p>
        </div>
        <button
          onClick={copyFromLastMonth}
          disabled={copyingLast}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-secondary/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          title="Copy last month's budget to this cycle"
        >
          {copyingLast ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Copy last month</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Budget", value: totalBudget, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/20" },
          { label: "Spent", value: totalSpent, color: totalSpent > totalBudget && totalBudget > 0 ? "text-red-500" : "text-foreground", bg: "bg-card" },
          { label: "Left", value: Math.max(0, totalBudget - totalSpent), color: totalSpent > totalBudget && totalBudget > 0 ? "text-red-500" : "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`${m.bg} border border-border/50 rounded-2xl p-4`}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">{m.label}</div>
            <BlurAmount value={m.value} className={`number-font text-xl font-700 ${m.color} leading-none`} />
          </motion.div>
        ))}
      </div>

      {/* Overall progress */}
      {totalBudget > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border/50 rounded-2xl px-5 py-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall</span>
            <span className={`text-sm number-font font-semibold ${overallPct > 90 ? "text-red-500" : overallPct > 70 ? "text-orange-500" : "text-foreground"}`}>
              {overallPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: overallPct > 90 ? "#ef4444" : overallPct > 70 ? "#f97316" : "#7c3aed" }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
            <span>{formatCurrency(totalSpent)} spent</span>
            <span>{formatCurrency(totalBudget)} total budget</span>
          </div>
        </motion.div>
      )}

      {/* 80% / over-budget alert banner */}
      {alertCategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`border rounded-2xl px-5 py-4 ${
            alertCategories.some(a => a.isOver)
              ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
              : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${alertCategories.some(a => a.isOver) ? "text-red-500" : "text-amber-500"}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold mb-2 ${alertCategories.some(a => a.isOver) ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                {alertCategories.some(a => a.isOver) ? "Over budget in some categories" : "Approaching budget limit"}
              </div>
              <div className="flex flex-wrap gap-2">
                {alertCategories.map(a => (
                  <div key={a.cat} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium ${
                    a.isOver
                      ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                      : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                  }`}>
                    <span>{a.meta?.icon}</span>
                    <span>{a.meta?.label}</span>
                    <span className="font-700">{a.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Smart suggestion banner */}
      {hasSuggestions && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-200 dark:border-violet-900/50 rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-violet-800 dark:text-violet-300">Smart suggestions ready</div>
              <div className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-0.5">
                Based on last month · rounded up with 10% buffer
              </div>
            </div>
          </div>
          <button
            onClick={applyAllSuggestions}
            disabled={applyingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-all disabled:opacity-60 whitespace-nowrap flex-shrink-0"
          >
            {applyingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Apply all
          </button>
        </motion.div>
      )}

      {/* Category groups */}
      <div className="space-y-6">
        {CATEGORY_GROUPS.map((group) => {
          const groupCats = group.categories;
          const activeCats = groupCats.filter(cat => isActive(cat));
          const inactiveCats = groupCats.filter(cat => !isActive(cat));
          const groupHasSuggestion = inactiveCats.some(cat => suggestions[cat]);

          return (
            <div key={group.label}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-700 uppercase tracking-widest text-muted-foreground">{group.label}</span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              <div className="space-y-2">
                {/* Active category cards */}
                {activeCats.map((cat, i) => {
                  const meta = CATEGORY_META[cat];
                  const spent = categoryTotals[cat] || 0;
                  const budgetAmt = parseFloat(localBudgets[cat] || "0");
                  const suggested = suggestions[cat];
                  const pct = budgetAmt > 0 ? Math.min(100, (spent / budgetAmt) * 100) : 0;
                  const isOver = budgetAmt > 0 && spent > budgetAmt;
                  const barColor = isOver ? "#ef4444" : pct > 80 ? "#f97316" : meta.color;
                  const workHours = monthlySalary && budgetAmt > 0 ? computeWorkHours(budgetAmt, monthlySalary) : null;

                  return (
                    <motion.div
                      key={cat}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card border border-border/50 rounded-2xl p-4"
                    >
                      {/* Top row: icon + name + status */}
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: meta.lightColor }}
                        >
                          {meta.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-600">{meta.label}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isOver && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                              {budgetAmt > 0 && !isOver && pct >= 100 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                              {pct > 0 && pct < 100 && (
                                <span className={`text-[11px] font-semibold number-font ${pct > 80 ? "text-orange-500" : "text-muted-foreground"}`}>
                                  {pct.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>
                              {formatCurrency(spent)} spent
                              {budgetAmt > 0 && !isOver && ` · ${formatCurrency(budgetAmt - spent)} left`}
                              {isOver && <span className="text-red-500 ml-1">· {formatCurrency(spent - budgetAmt)} over!</span>}
                            </span>
                            {workHours !== null && (
                              <span className="flex items-center gap-1 text-muted-foreground/70">
                                <Clock className="w-2.5 h-2.5" />{workHours}h work
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {budgetAmt > 0 && (
                        <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.05 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: barColor }}
                          />
                        </div>
                      )}

                      {/* Budget input row */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground flex-shrink-0">Budget</span>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <span className="text-sm text-muted-foreground">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={localBudgets[cat] || ""}
                            onChange={(e) => setLocalBudgets({ ...localBudgets, [cat]: e.target.value })}
                            onBlur={() => saveBudget(cat)}
                            onKeyDown={(e) => e.key === "Enter" && saveBudget(cat)}
                            placeholder="0"
                            className="flex-1 min-w-0 h-9 px-3 rounded-xl border border-border bg-secondary/50 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary number-font transition-all"
                          />
                          {saving === cat && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />}
                        </div>
                        {suggested && (
                          <button
                            onClick={() => {
                              setLocalBudgets({ ...localBudgets, [cat]: String(suggested) });
                              saveBudget(cat, suggested);
                            }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 px-2.5 py-1.5 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors whitespace-nowrap flex-shrink-0"
                            title="Based on last month average + 10% buffer"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            {formatCurrency(suggested)}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {/* Inactive categories as compact chips */}
                {inactiveCats.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {inactiveCats.map((cat) => {
                      const meta = CATEGORY_META[cat];
                      const hasSuggest = !!suggestions[cat];
                      return (
                        <button
                          key={cat}
                          onClick={() => toggleExpand(cat)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border/70 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-secondary/50 transition-all"
                        >
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                          {hasSuggest && <Sparkles className="w-2.5 h-2.5 text-violet-400" />}
                          <Plus className="w-3 h-3 opacity-50" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
