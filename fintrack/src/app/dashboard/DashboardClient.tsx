"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight,
  Flame, Target, Sparkles, ChevronRight, Zap,
  ShieldCheck, Clock, Coins, AlertTriangle,
} from "lucide-react";
import { Transaction, Budget, UserSettings, CashWithdrawal, CATEGORY_META } from "@/types";
import { formatCurrency, getSalaryCycleBounds, getPrevSalaryCycleBounds, computeNoSpendStreak, computeWorkHours } from "@/lib/utils";
import SpendingDonut from "@/components/charts/SpendingDonut";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import DailySpendChart from "@/components/charts/DailySpendChart";
import AddTransactionButton from "@/components/ui/AddTransactionButton";
import { BlurAmount } from "@/components/ui/BlurAmount";
import Link from "next/link";

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  userEmail: string;
  userSettings: UserSettings | null;
  cashWithdrawals: CashWithdrawal[];
}

export default function DashboardClient({
  transactions,
  budgets,
  currentMonth,
  userEmail,
  userSettings,
  cashWithdrawals,
}: Props) {
  const salaryDay = userSettings?.salary_day ?? 1;
  const monthlySalary = userSettings?.monthly_salary ?? null;

  // --- Salary cycle bounds ---
  const cycle = useMemo(() => getSalaryCycleBounds(salaryDay), [salaryDay]);
  const prevCycle = useMemo(() => getPrevSalaryCycleBounds(salaryDay), [salaryDay]);

  const monthTxs = useMemo(
    () => transactions.filter((t) => t.date >= cycle.start && t.date <= cycle.end),
    [transactions, cycle]
  );

  const prevMonthTxs = useMemo(
    () => transactions.filter((t) => t.date >= prevCycle.start && t.date <= prevCycle.end),
    [transactions, prevCycle]
  );

  const totalSpent = useMemo(() => monthTxs.reduce((s, t) => s + t.amount, 0), [monthTxs]);
  const prevMonthTotal = useMemo(() => prevMonthTxs.reduce((s, t) => s + t.amount, 0), [prevMonthTxs]);

  const budgetForCycle = useMemo(
    () => budgets.filter((b) => b.month === cycle.monthKey),
    [budgets, cycle]
  );
  const totalBudget = useMemo(() => budgetForCycle.reduce((s, b) => s + b.amount, 0), [budgetForCycle]);
  const remaining = totalBudget - totalSpent;
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const today = new Date().toISOString().split("T")[0];
  const todaySpent = useMemo(
    () => transactions.filter((t) => t.date === today).reduce((s, t) => s + t.amount, 0),
    [transactions, today]
  );

  const monthChange =
    prevMonthTotal > 0 ? ((totalSpent - prevMonthTotal) / prevMonthTotal) * 100 : 0;

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxs.forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [monthTxs]);

  const topCategory = useMemo(() => {
    const entries = Object.entries(categoryTotals);
    if (!entries.length) return null;
    const [cat, amt] = entries.sort((a, b) => b[1] - a[1])[0];
    return { cat, amt, meta: CATEGORY_META[cat as keyof typeof CATEGORY_META] };
  }, [categoryTotals]);

  // --- Safe to spend today (Feature 4) ---
  const safeToSpend = useMemo(() => {
    if (totalBudget <= 0 || remaining <= 0) return null;
    return remaining / cycle.daysLeft;
  }, [totalBudget, remaining, cycle.daysLeft]);

  // --- No-spend streak (Feature 7) ---
  const streak = useMemo(() => computeNoSpendStreak(transactions), [transactions]);

  // --- Cash wallet (Feature 2) ---
  const cashBalance = useMemo(() => {
    const withdrawn = cashWithdrawals.reduce((s, w) => s + w.amount, 0);
    const cashSpent = transactions.filter((t) => t.is_cash).reduce((s, t) => s + t.amount, 0);
    return withdrawn - cashSpent;
  }, [cashWithdrawals, transactions]);

  // --- Money leaks (Feature 5) ---
  const moneyLeaks = useMemo(() => {
    const smallThreshold = 200;
    const smallSpends = monthTxs.filter((t) => t.amount < smallThreshold);
    const smallTotal = smallSpends.reduce((s, t) => s + t.amount, 0);

    // Subscription creep: same description in multiple months, consistent amount
    const descMap: Record<string, Transaction[]> = {};
    transactions.forEach((t) => {
      const key = t.description.toLowerCase().trim();
      descMap[key] = [...(descMap[key] || []), t];
    });

    const subscriptions = Object.values(descMap)
      .filter((txs) => {
        const months = new Set(txs.map((t) => t.date.slice(0, 7)));
        if (months.size < 2) return false;
        const amounts = txs.map((t) => t.amount);
        const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const maxDiff = Math.max(...amounts.map((a) => Math.abs(a - avg)));
        return avg > 0 && maxDiff / avg < 0.15;
      })
      .map((txs) => ({
        description: txs[0].description,
        monthlyAmount: txs[txs.length - 1].amount,
        months: new Set(txs.map((t) => t.date.slice(0, 7))).size,
      }))
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
      .slice(0, 4);

    const subscriptionTotal = subscriptions.reduce((s, sub) => s + sub.monthlyAmount, 0);

    return { smallSpends, smallTotal, subscriptions, subscriptionTotal };
  }, [monthTxs, transactions]);

  // --- Smart suggestions ---
  const suggestions = useMemo(() => {
    const tips: Array<{ title: string; description: string; type: "warning" | "success" | "info" }> = [];

    if (budgetPct > 90) {
      tips.push({
        title: "Almost at your budget limit!",
        description: `You've used ${budgetPct.toFixed(0)}% of your budget. ${cycle.daysLeft} days left in this pay cycle.`,
        type: "warning",
      });
    }

    if (topCategory) {
      const catBudget = budgetForCycle.find((b) => b.category === topCategory.cat);
      if (catBudget && topCategory.amt > catBudget.amount) {
        tips.push({
          title: `${topCategory.meta?.label} budget exceeded`,
          description: `Spent ${formatCurrency(topCategory.amt)} — ${formatCurrency(topCategory.amt - catBudget.amount)} over the ${formatCurrency(catBudget.amount)} limit.`,
          type: "warning",
        });
      }
    }

    if (moneyLeaks.smallTotal > 1000) {
      tips.push({
        title: `${moneyLeaks.smallSpends.length} small spends = ${formatCurrency(moneyLeaks.smallTotal)}`,
        description: "Individually invisible, collectively brutal. Chai, auto, quick buys under ₹200.",
        type: "info",
      });
    }

    if (moneyLeaks.subscriptions.length > 0) {
      tips.push({
        title: `${moneyLeaks.subscriptions.length} recurring subscriptions detected`,
        description: `${moneyLeaks.subscriptions.map((s) => s.description).join(", ")} — ${formatCurrency(moneyLeaks.subscriptionTotal)}/mo total.`,
        type: "info",
      });
    }

    if (monthChange > 15) {
      tips.push({
        title: `Spending up ${monthChange.toFixed(0)}% vs last cycle`,
        description: `${formatCurrency(totalSpent)} this cycle vs ${formatCurrency(prevMonthTotal)} last cycle.`,
        type: "info",
      });
    }

    if (monthChange < -10 && totalSpent > 0) {
      tips.push({
        title: "Great job cutting spending!",
        description: `Spending ${Math.abs(monthChange).toFixed(0)}% less than last cycle. Saved ${formatCurrency(prevMonthTotal - totalSpent)}.`,
        type: "success",
      });
    }

    if (streak.current >= 3) {
      tips.push({
        title: `${streak.current}-day no-spend streak! 🔥`,
        description: `Zero discretionary spending for the last ${streak.current} days. Keep it up!`,
        type: "success",
      });
    }

    if (!tips.length && totalSpent > 0) {
      tips.push({
        title: "Looking good this cycle",
        description: "Your spending is within normal range. Keep tracking to build better habits.",
        type: "success",
      });
    }

    return tips.slice(0, 3);
  }, [budgetPct, topCategory, monthChange, totalSpent, prevMonthTotal, budgetForCycle, cycle, moneyLeaks, streak]);

  const daysInCycle = useMemo(() => {
    const start = new Date(cycle.start);
    const end = new Date(cycle.end);
    return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  }, [cycle]);

  const daysElapsed = daysInCycle - cycle.daysLeft;
  const dailyAvg = daysElapsed > 0 ? totalSpent / daysElapsed : 0;

  const firstName = userEmail.split("@")[0];

  const metrics = [
    {
      label: "Spent this cycle",
      value: <BlurAmount value={totalSpent} className="number-font text-2xl font-600" />,
      sub: cycle.label,
      icon: Wallet,
      color: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      trend: monthChange !== 0 ? { value: Math.abs(monthChange).toFixed(1) + "%", up: monthChange > 0 } : null,
    },
    {
      label: "Budget remaining",
      value: totalBudget > 0
        ? <BlurAmount value={Math.abs(remaining)} className={`number-font text-2xl font-600 ${remaining < 0 ? "text-red-500" : ""}`} />
        : <span className="number-font text-2xl font-600">—</span>,
      sub: totalBudget > 0 ? `${budgetPct.toFixed(0)}% used of ${formatCurrency(totalBudget)}` : "No budget set",
      icon: Target,
      color: remaining < 0 ? "text-red-500" : "text-emerald-600",
      bg: remaining < 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30",
      trend: null,
    },
    {
      label: "Today",
      value: <BlurAmount value={todaySpent} className="number-font text-2xl font-600" />,
      sub: `Daily avg: ${formatCurrency(dailyAvg)}`,
      icon: Flame,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      trend: null,
    },
    {
      label: "No-spend streak",
      value: <span className="number-font text-2xl font-600">{streak.current} {streak.current > 0 ? "🔥" : "—"}</span>,
      sub: `Best this month: ${streak.bestThisMonth} days`,
      icon: Zap,
      color: streak.current >= 3 ? "text-amber-500" : "text-slate-400",
      bg: streak.current >= 3 ? "bg-amber-50 dark:bg-amber-950/30" : "bg-slate-50 dark:bg-slate-950/30",
      trend: null,
    },
    {
      label: "Transactions",
      value: <span className="number-font text-2xl font-600">{monthTxs.length}</span>,
      sub: `${transactions.length} total recorded`,
      icon: ArrowUpRight,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      trend: null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-700 mb-1">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
            <span className="gradient-text">{firstName}</span> 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            Pay cycle: {cycle.label} · {cycle.daysLeft} days left
          </p>
        </motion.div>
        <AddTransactionButton userSettings={userSettings} />
      </div>

      {/* Safe to spend today — hero (Feature 4) */}
      {safeToSpend !== null && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-4 right-4">
            <ShieldCheck className="w-5 h-5 text-primary/40" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-2">Safe to spend today</p>
          <div className="flex items-end gap-4 flex-wrap">
            <BlurAmount value={safeToSpend} className="number-font text-5xl font-700 text-primary leading-none" />
            <div className="mb-1 text-sm text-muted-foreground leading-snug">
              per day · <span className="font-medium text-foreground">{cycle.daysLeft} days</span> left<br />
              {totalBudget > 0 && (
                <span>Based on <span className="font-medium">{formatCurrency(totalBudget)}</span> budget</span>
              )}
            </div>
          </div>
          {safeToSpend > 0 && todaySpent > 0 && (
            <p className={`mt-3 text-sm font-medium ${todaySpent <= safeToSpend ? "text-emerald-600" : "text-red-500"}`}>
              {todaySpent <= safeToSpend
                ? `✓ You've spent ${formatCurrency(todaySpent)} today — within your daily limit.`
                : `⚠ You've spent ${formatCurrency(todaySpent)} today — ${formatCurrency(todaySpent - safeToSpend)} over the daily safe limit.`}
            </p>
          )}
        </motion.div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-card border border-border/50 rounded-2xl p-5 card-hover"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center`}>
                <m.icon className={`w-5 h-5 ${m.color}`} />
              </div>
              {m.trend && (
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${m.trend.up ? "bg-red-50 text-red-600 dark:bg-red-950/40" : "bg-green-50 text-green-600 dark:bg-green-950/40"}`}>
                  {m.trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {m.trend.value}
                </div>
              )}
            </div>
            <div className="mb-1">{m.value}</div>
            <div className="text-xs text-muted-foreground">{m.sub}</div>
            <div className="text-[11px] text-muted-foreground/70 mt-0.5 font-medium uppercase tracking-wide">{m.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Cash wallet banner (Feature 2) */}
      {cashWithdrawals.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4 bg-card border border-border/50 rounded-2xl px-6 py-4"
        >
          <div className="w-10 h-10 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center flex-shrink-0">
            <Coins className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <div className="text-sm font-medium">Cash in hand</div>
            <div className="text-xs text-muted-foreground">From ATM withdrawals minus logged cash spends</div>
          </div>
          <div className="ml-auto text-right">
            <BlurAmount value={cashBalance} className={`number-font text-xl font-600 ${cashBalance < 0 ? "text-red-500" : "text-emerald-600"}`} />
            {cashBalance < 0 && (
              <div className="text-xs text-red-400 mt-0.5">More spent than withdrawn — log missing cash spends</div>
            )}
          </div>
        </motion.div>
      )}

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-base font-600">Daily spending</h3>
              <p className="text-xs text-muted-foreground">Last 14 days</p>
            </div>
          </div>
          <DailySpendChart transactions={transactions} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <div className="mb-6">
            <h3 className="font-display text-base font-600">By category</h3>
            <p className="text-xs text-muted-foreground">This cycle</p>
          </div>
          <SpendingDonut categoryTotals={categoryTotals} />
        </motion.div>
      </div>

      {/* Trend + Insights */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-base font-600">Monthly trend</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
          </div>
          <MonthlyTrendChart transactions={transactions} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <h3 className="font-display text-base font-600">Smart insights</h3>
          </div>
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border text-sm ${
                  s.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                    : s.type === "success"
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50"
                    : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                }`}
              >
                <div className={`font-medium mb-0.5 text-xs ${
                  s.type === "warning" ? "text-amber-700 dark:text-amber-400" :
                  s.type === "success" ? "text-green-700 dark:text-green-400" :
                  "text-blue-700 dark:text-blue-400"
                }`}>
                  {s.title}
                </div>
                <div className="text-muted-foreground text-xs leading-relaxed">{s.description}</div>
              </div>
            ))}
          </div>

          {/* Money leaks summary (Feature 5) */}
          {(moneyLeaks.smallTotal > 500 || moneyLeaks.subscriptions.length > 0) && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-semibold text-orange-600">Money leaks</span>
              </div>
              {moneyLeaks.smallTotal > 500 && (
                <div className="text-xs text-muted-foreground mb-2">
                  <span className="font-medium text-foreground">{moneyLeaks.smallSpends.length} micro-spends</span> under ₹200 = <span className="font-medium">{formatCurrency(moneyLeaks.smallTotal)}</span> this cycle
                </div>
              )}
              {moneyLeaks.subscriptions.map((sub, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1">
                  <span className="text-muted-foreground truncate max-w-[120px]">{sub.description}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(sub.monthlyAmount)}/mo</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent transactions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-base font-600">Recent transactions</h3>
            <p className="text-xs text-muted-foreground">Latest activity</p>
          </div>
          <Link
            href="/dashboard/transactions"
            className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No transactions yet. Add your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 6).map((tx) => {
              const meta = CATEGORY_META[tx.category];
              const workHours = monthlySalary ? computeWorkHours(tx.amount, monthlySalary) : null;
              return (
                <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors group">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 relative"
                    style={{ background: meta?.lightColor }}
                  >
                    {meta?.icon}
                    {tx.is_cash && (
                      <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-400 text-yellow-900 rounded-full px-1 font-bold">₹</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{tx.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta?.label} · {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <div className="text-right">
                    <BlurAmount value={tx.amount} className="number-font text-sm font-600" />
                    {workHours !== null && (
                      <div className="flex items-center justify-end gap-0.5 text-[10px] text-muted-foreground mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {workHours}h work
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
