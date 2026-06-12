"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Target, CheckCircle2, AlertTriangle, Loader2, Clock } from "lucide-react";
import { Transaction, Budget, CATEGORY_META, CATEGORIES, Category } from "@/types";
import { formatCurrency, computeWorkHours } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  cycleLabel: string;
  userId: string;
  monthlySalary: number | null;
}

export default function BudgetClient({ transactions, budgets, currentMonth, cycleLabel, userId, monthlySalary }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [localBudgets, setLocalBudgets] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    budgets.forEach((b) => { map[b.category] = String(b.amount); });
    return map;
  });

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [transactions]);

  const totalSpent = useMemo(() => Object.values(categoryTotals).reduce((s, v) => s + v, 0), [categoryTotals]);
  const totalBudget = useMemo(
    () => Object.values(localBudgets).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [localBudgets]
  );

  async function saveBudget(category: string) {
    const amount = parseFloat(localBudgets[category] || "0");
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

  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-700 mb-1">Budget</h1>
        <p className="text-muted-foreground text-sm">{cycleLabel}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total budget", value: totalBudget, color: "text-violet-600" },
          { label: "Spent so far", value: totalSpent, color: totalSpent > totalBudget ? "text-red-500" : "text-foreground" },
          { label: "Remaining", value: Math.max(0, totalBudget - totalSpent), color: totalSpent > totalBudget ? "text-red-500" : "text-emerald-600" },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card border border-border/50 rounded-2xl p-5"
          >
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">{m.label}</div>
            <BlurAmount value={m.value} className={`number-font text-2xl font-600 ${m.color}`} />
          </motion.div>
        ))}
      </div>

      {/* Overall progress */}
      {totalBudget > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Overall budget</span>
            <span className="text-sm number-font font-medium">{overallPct.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: overallPct > 90 ? "#ef4444" : overallPct > 70 ? "#f97316" : "#7c3aed",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{formatCurrency(totalSpent)} spent</span>
            <span>{formatCurrency(totalBudget)} budget</span>
          </div>
        </div>
      )}

      {/* Category budgets */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50">
          <h3 className="font-display text-base font-600">Category budgets</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Set limits and track spending per category</p>
        </div>

        <div className="divide-y divide-border/50">
          {CATEGORIES.map((cat, i) => {
            const meta = CATEGORY_META[cat];
            const spent = categoryTotals[cat] || 0;
            const budgetAmt = parseFloat(localBudgets[cat] || "0");
            const pct = budgetAmt > 0 ? Math.min(100, (spent / budgetAmt) * 100) : 0;
            const isOver = budgetAmt > 0 && spent > budgetAmt;
            const barColor = isOver ? "#ef4444" : pct > 70 ? "#f97316" : meta.color;
            const workHours = monthlySalary && budgetAmt > 0 ? computeWorkHours(budgetAmt, monthlySalary) : null;

            return (
              <motion.div
                key={cat}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-6"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                    style={{ background: meta.lightColor }}
                  >
                    {meta.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-sm font-medium">{meta.label}</span>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(spent)} spent
                          {budgetAmt > 0 && ` of ${formatCurrency(budgetAmt)}`}
                        </div>
                        {workHours !== null && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {workHours}h of work
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isOver && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        {budgetAmt > 0 && !isOver && pct === 100 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={localBudgets[cat] || ""}
                            onChange={(e) => setLocalBudgets({ ...localBudgets, [cat]: e.target.value })}
                            onBlur={() => saveBudget(cat)}
                            onKeyDown={(e) => e.key === "Enter" && saveBudget(cat)}
                            placeholder="0"
                            className="w-24 h-9 px-3 rounded-lg border border-border bg-secondary/50 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary number-font"
                          />
                          {saving === cat && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                        </div>
                      </div>
                    </div>

                    {budgetAmt > 0 ? (
                      <>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.04 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: barColor }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                          <span>{pct.toFixed(0)}% used</span>
                          {isOver && <span className="text-red-500 font-medium">{formatCurrency(spent - budgetAmt)} over</span>}
                          {!isOver && budgetAmt > 0 && <span className="text-emerald-600">{formatCurrency(budgetAmt - spent)} left</span>}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">Enter a budget amount to track</div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
