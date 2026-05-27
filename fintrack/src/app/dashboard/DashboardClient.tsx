"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight,
  Flame, Target, Sparkles, ChevronRight
} from "lucide-react";
import { Transaction, Budget, CATEGORY_META, CATEGORIES } from "@/types";
import { formatCurrency, getMonthLabel, getLast6Months } from "@/lib/utils";
import SpendingDonut from "@/components/charts/SpendingDonut";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import DailySpendChart from "@/components/charts/DailySpendChart";
import AddTransactionButton from "@/components/ui/AddTransactionButton";
import Link from "next/link";

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  userEmail: string;
}

export default function DashboardClient({ transactions, budgets, currentMonth, userEmail }: Props) {
  const monthTxs = useMemo(
    () => transactions.filter((t) => t.date.startsWith(currentMonth)),
    [transactions, currentMonth]
  );

  const totalSpent = useMemo(() => monthTxs.reduce((s, t) => s + t.amount, 0), [monthTxs]);
  const totalBudget = useMemo(() => budgets.reduce((s, b) => s + b.amount, 0), [budgets]);
  const remaining = totalBudget - totalSpent;
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const today = new Date().toISOString().split("T")[0];
  const todaySpent = useMemo(
    () => transactions.filter((t) => t.date === today).reduce((s, t) => s + t.amount, 0),
    [transactions, today]
  );

  const prevMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const prevMonthTotal = useMemo(
    () =>
      transactions
        .filter((t) => t.date.startsWith(prevMonth))
        .reduce((s, t) => s + t.amount, 0),
    [transactions, prevMonth]
  );

  const monthChange =
    prevMonthTotal > 0
      ? ((totalSpent - prevMonthTotal) / prevMonthTotal) * 100
      : 0;

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxs.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }, [monthTxs]);

  const topCategory = useMemo(() => {
    const entries = Object.entries(categoryTotals);
    if (!entries.length) return null;
    const [cat, amt] = entries.sort((a, b) => b[1] - a[1])[0];
    return { cat, amt, meta: CATEGORY_META[cat as keyof typeof CATEGORY_META] };
  }, [categoryTotals]);

  // Suggestions
  const suggestions = useMemo(() => {
    const tips: Array<{ title: string; description: string; type: "warning" | "success" | "info" }> = [];

    if (budgetPct > 90) {
      tips.push({
        title: "You're almost at your monthly budget!",
        description: `You've used ${budgetPct.toFixed(0)}% of your budget. Consider cutting back on discretionary spending.`,
        type: "warning",
      });
    }

    if (topCategory) {
      const catBudget = budgets.find((b) => b.category === topCategory.cat);
      if (catBudget && topCategory.amt > catBudget.amount) {
        tips.push({
          title: `${topCategory.meta?.label} budget exceeded`,
          description: `You've spent ${formatCurrency(topCategory.amt)} — ${formatCurrency(topCategory.amt - catBudget.amount)} over the ${formatCurrency(catBudget.amount)} budget.`,
          type: "warning",
        });
      }
    }

    if (monthChange > 15) {
      tips.push({
        title: `Spending up ${monthChange.toFixed(0)}% vs last month`,
        description: `You spent ${formatCurrency(totalSpent)} this month vs ${formatCurrency(prevMonthTotal)} last month. Review your transactions.`,
        type: "info",
      });
    }

    if (monthChange < -10 && totalSpent > 0) {
      tips.push({
        title: "Great job cutting spending!",
        description: `You're spending ${Math.abs(monthChange).toFixed(0)}% less than last month. You saved ${formatCurrency(prevMonthTotal - totalSpent)}.`,
        type: "success",
      });
    }

    if (!tips.length && totalSpent > 0) {
      tips.push({
        title: "Looking good this month",
        description: "Your spending is within normal range. Keep tracking to build better habits.",
        type: "success",
      });
    }

    return tips.slice(0, 3);
  }, [budgetPct, topCategory, monthChange, totalSpent, prevMonthTotal, budgets]);

  const daysInMonth = new Date().getDate();
  const dailyAvg = daysInMonth > 0 ? totalSpent / daysInMonth : 0;

  const metrics = [
    {
      label: "Spent this month",
      value: formatCurrency(totalSpent),
      sub: `${getMonthLabel(currentMonth)}`,
      icon: Wallet,
      color: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      trend: monthChange !== 0 ? { value: Math.abs(monthChange).toFixed(1) + "%", up: monthChange > 0 } : null,
    },
    {
      label: "Budget remaining",
      value: totalBudget > 0 ? formatCurrency(Math.abs(remaining)) : "—",
      sub: totalBudget > 0 ? `${budgetPct.toFixed(0)}% used of ${formatCurrency(totalBudget)}` : "No budget set",
      icon: Target,
      color: remaining < 0 ? "text-red-500" : "text-emerald-600",
      bg: remaining < 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30",
      trend: null,
    },
    {
      label: "Today",
      value: todaySpent > 0 ? formatCurrency(todaySpent) : "₹0",
      sub: `Daily avg: ${formatCurrency(dailyAvg)}`,
      icon: Flame,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      trend: null,
    },
    {
      label: "Transactions",
      value: monthTxs.length.toString(),
      sub: `${transactions.length} total recorded`,
      icon: ArrowUpRight,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      trend: null,
    },
  ];

  const firstName = userEmail.split("@")[0];

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
            Here&apos;s your financial overview for {getMonthLabel(currentMonth)}
          </p>
        </motion.div>
        <AddTransactionButton />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div className="number-font text-2xl font-600 mb-1">{m.value}</div>
            <div className="text-xs text-muted-foreground">{m.sub}</div>
            <div className="text-[11px] text-muted-foreground/70 mt-0.5 font-medium uppercase tracking-wide">{m.label}</div>
          </motion.div>
        ))}
      </div>

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
            <p className="text-xs text-muted-foreground">This month</p>
          </div>
          <SpendingDonut categoryTotals={categoryTotals} />
        </motion.div>
      </div>

      {/* Trend + Suggestions */}
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
          <div className="space-y-4">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border text-sm ${
                  s.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                    : s.type === "success"
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50"
                    : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                }`}
              >
                <div className={`font-medium mb-1 text-xs ${
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
              return (
                <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/50 transition-colors group">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: meta?.lightColor }}
                  >
                    {meta?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{tx.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {meta?.label} · {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <div className="number-font text-sm font-600 text-foreground">
                    {formatCurrency(tx.amount)}
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
