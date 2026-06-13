"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { PiggyBank, TrendingUp } from "lucide-react";
import { Transaction, CATEGORY_META, CATEGORIES } from "@/types";
import { formatCurrency, getLast6Months, getLast12Months, getMonthLabel, isSipOrEmiTx } from "@/lib/utils";
import SpendingDonut from "@/components/charts/SpendingDonut";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props {
  transactions: Transaction[];
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AnalyticsClient({ transactions }: Props) {
  const months6 = getLast6Months();
  const months12 = getLast12Months();

  const currentMonthKey = months6[months6.length - 1];

  // Exclude SIP and loan EMI — fixed commitments, not discretionary spending
  const txns = useMemo(
    () => transactions.filter(t => !isSipOrEmiTx(t)),
    [transactions]
  );

  const monthlyByCategory = useMemo(() => {
    return months6.map((m) => {
      const mtxs = txns.filter((t) => t.date.startsWith(m));
      const label = new Date(m + "-01").toLocaleDateString("en-IN", { month: "short" });
      const row: Record<string, string | number> = { month: label };
      CATEGORIES.forEach((c) => {
        row[c] = mtxs.filter((t) => t.category === c).reduce((s, t) => s + t.amount, 0);
      });
      row.total = mtxs.reduce((s, t) => s + t.amount, 0);
      return row;
    });
  }, [txns, months6]);

  const currentTotals = useMemo(() => {
    const map: Record<string, number> = {};
    txns.filter((t) => t.date.startsWith(currentMonthKey))
      .forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [txns, currentMonthKey]);

  const radarData = useMemo(() =>
    CATEGORIES.filter((c) => currentTotals[c] > 0).map((c) => ({
      category: CATEGORY_META[c].label.split(" ")[0],
      amount: currentTotals[c],
    })),
    [currentTotals]
  );

  const avgByCategory = useMemo(() => {
    return CATEGORIES.filter(c => c !== "savings" && c !== "emi").map((c) => {
      const catTxs = txns.filter((t) => t.category === c);
      const total = catTxs.reduce((s, t) => s + t.amount, 0);
      const count = catTxs.length;
      return {
        category: CATEGORY_META[c].label,
        icon: CATEGORY_META[c].icon,
        total,
        count,
        avg: count > 0 ? total / count : 0,
        color: CATEGORY_META[c].color,
        lightColor: CATEGORY_META[c].lightColor,
      };
    }).filter((d) => d.count > 0).sort((a, b) => b.total - a.total);
  }, [txns]);

  const topSpendDays = useMemo(() => {
    const dayMap: Record<string, number> = {};
    txns.forEach((t) => { dayMap[t.date] = (dayMap[t.date] || 0) + t.amount; });
    return Object.entries(dayMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([date, amount]) => ({ date, amount }));
  }, [txns]);

  // --- Festival sinking funds (Feature 3 / Phase 4) ---
  const festivalSuggestions = useMemo(() => {
    const today = new Date();
    const currentMonthIdx = today.getMonth(); // 0-based

    // Monthly totals for all 12 months
    const monthlyTotals = months12.map((m) => ({
      month: m,
      total: txns.filter((t) => t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0),
      monthIdx: new Date(m + "-01").getMonth(),
    }));

    // Average of recent 6 months (exclude last 6 "prior year" months)
    const recent6Totals = monthlyTotals.slice(6).map((m) => m.total);
    const recentAvg = recent6Totals.length > 0
      ? recent6Totals.reduce((s, v) => s + v, 0) / recent6Totals.length
      : 0;

    if (recentAvg === 0) return [];

    // Prior 6 months = months 0-5 in our 12-month window (same months last year)
    const priorYear = monthlyTotals.slice(0, 6);
    const spikes = priorYear.filter((m) => m.total > recentAvg * 1.35 && m.total > 0);

    return spikes.map((spike) => {
      const extra = spike.total - recentAvg;
      // Find how many months until this calendar month comes around again
      let monthsUntil = ((spike.monthIdx - currentMonthIdx + 12) % 12);
      if (monthsUntil === 0) monthsUntil = 12; // same month next year
      const monthlySave = monthsUntil > 0 ? extra / monthsUntil : extra;
      const monthName = MONTH_NAMES[spike.monthIdx];

      return {
        monthName,
        monthIdx: spike.monthIdx,
        lastYearSpend: spike.total,
        extra,
        monthsUntil,
        monthlySave: Math.ceil(monthlySave / 100) * 100, // round to nearest ₹100
      };
    }).sort((a, b) => a.monthsUntil - b.monthsUntil);
  }, [txns, months12]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-700 mb-1">Analytics</h1>
        <p className="text-muted-foreground text-sm">Deep dive into your spending patterns</p>
      </div>

      {/* Festival sinking funds (Feature 3 — Phase 4) */}
      {festivalSuggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="w-5 h-5 text-amber-600" />
            <h3 className="font-display text-base font-600 text-amber-800 dark:text-amber-300">Festival & seasonal sinking funds</h3>
          </div>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mb-5">
            Based on your spending last year, these months had big spikes. Start saving now so the bump doesn&apos;t hit your budget.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {festivalSuggestions.map((s) => (
              <div key={s.monthName} className="bg-white/60 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-100 dark:border-amber-900/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-amber-800 dark:text-amber-200">{s.monthName}</span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                    {s.monthsUntil} months away
                  </span>
                </div>
                <div className="text-xs text-amber-700/70 dark:text-amber-400/70 mb-3">
                  Last {s.monthName} you spent <span className="font-semibold">{formatCurrency(s.lastYearSpend)}</span> — <span className="font-semibold">{formatCurrency(s.extra)}</span> above average
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Save <BlurAmount value={s.monthlySave} className="inline" />/month from now
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Monthly stacked */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <h3 className="font-display text-base font-600 mb-1">Month-by-month breakdown</h3>
        <p className="text-xs text-muted-foreground mb-5">Stacked by category over 6 months</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyByCategory} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), CATEGORY_META[name as keyof typeof CATEGORY_META]?.label || name]}
              contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", fontSize: "12px" }}
            />
            {CATEGORIES.map((c) => (
              <Bar key={c} dataKey={c} stackId="a" fill={CATEGORY_META[c].color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Donut + Radar */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <h3 className="font-display text-base font-600 mb-1">This month</h3>
          <p className="text-xs text-muted-foreground mb-4">{getMonthLabel(currentMonthKey)}</p>
          <SpendingDonut categoryTotals={currentTotals} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <h3 className="font-display text-base font-600 mb-1">Spending shape</h3>
          <p className="text-xs text-muted-foreground mb-4">Radar view of this month</p>
          {radarData.length > 2 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Radar dataKey="amount" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Need 3+ categories for radar chart
            </div>
          )}
        </motion.div>
      </div>

      {/* Category breakdown table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border/50 rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border/50">
          <h3 className="font-display text-base font-600">Category breakdown</h3>
          <p className="text-xs text-muted-foreground mt-0.5">All time totals and averages</p>
        </div>
        <div className="divide-y divide-border/50">
          {avgByCategory.map((d, i) => {
            const totalAll = avgByCategory.reduce((s, x) => s + x.total, 0);
            const pct = totalAll > 0 ? (d.total / totalAll) * 100 : 0;
            return (
              <div key={d.category} className="px-6 py-4 flex items-center gap-4">
                <div className="text-lg w-8 text-center flex-shrink-0">{d.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{d.category}</span>
                    <BlurAmount value={d.total} className="number-font text-sm font-600" />
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.05, duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0 text-xs text-muted-foreground">
                  <div>{d.count} txns</div>
                  <div className="number-font">avg {formatCurrency(d.avg)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Top spend days */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <h3 className="font-display text-base font-600 mb-1">Biggest spending days</h3>
        <p className="text-xs text-muted-foreground mb-5">All time top 5</p>
        <div className="space-y-3">
          {topSpendDays.map((d, i) => (
            <div key={d.date} className="flex items-center gap-4">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-600 text-muted-foreground flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {new Date(d.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <BlurAmount value={d.amount} className="number-font font-600 text-sm" />
            </div>
          ))}
          {topSpendDays.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
