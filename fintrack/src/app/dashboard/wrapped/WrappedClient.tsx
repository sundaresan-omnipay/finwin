"use client";

import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Download, Trophy, TrendingDown, Star, Sparkles, Flame } from "lucide-react";
import { Transaction, Budget, CATEGORY_META } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props {
  transactions: Transaction[];
  budgets: Budget[];
  year: number;
  userEmail: string;
}

export default function WrappedClient({ transactions, budgets, year, userEmail }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    if (!transactions.length) return null;

    const totalSpent = transactions.reduce((s, t) => s + t.amount, 0);

    // Top category
    const catTotals: Record<string, number> = {};
    transactions.forEach((t) => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
    const [topCat, topCatAmt] = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0] || [];

    // Biggest single splurge
    const biggest = transactions.reduce((a, b) => (b.amount > a.amount ? b : a), transactions[0]);

    // Monthly totals
    const monthTotals: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      monthTotals[key] = transactions
        .filter((t) => t.date.startsWith(key))
        .reduce((s, t) => s + t.amount, 0);
    }

    // Most disciplined month = lowest non-zero spending month
    const nonZeroMonths = Object.entries(monthTotals).filter(([, v]) => v > 0);
    const disciplinedEntry = nonZeroMonths.sort((a, b) => a[1] - b[1])[0];
    const disciplinedMonth = disciplinedEntry ? { key: disciplinedEntry[0], total: disciplinedEntry[1] } : null;

    // Most splurge month
    const mostSpentEntry = Object.entries(monthTotals).sort((a, b) => b[1] - a[1])[0];
    const mostSpentMonth = mostSpentEntry ? { key: mostSpentEntry[0], total: mostSpentEntry[1] } : null;

    // Saved vs budget
    const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
    const totalSaved = Math.max(0, totalBudgeted - totalSpent);

    // Average transaction amount
    const avgTx = totalSpent / transactions.length;

    // Busiest day
    const dayTotals: Record<string, number> = {};
    transactions.forEach((t) => { dayTotals[t.date] = (dayTotals[t.date] || 0) + t.amount; });
    const busiestDayEntry = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];

    // Unique merchants
    const uniqueMerchants = new Set(transactions.map((t) => t.description.toLowerCase().trim())).size;

    return {
      totalSpent,
      totalBudgeted,
      totalSaved,
      topCat,
      topCatAmt,
      biggest,
      disciplinedMonth,
      mostSpentMonth,
      avgTx,
      busiestDayEntry,
      uniqueMerchants,
      txCount: transactions.length,
    };
  }, [transactions, budgets, year]);

  const firstName = userEmail.split("@")[0];

  async function handleDownload() {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null });
      const link = document.createElement("a");
      link.download = `finwin-wrapped-${year}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      alert("To save, take a screenshot of this page.");
    }
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 text-center space-y-4">
        <Sparkles className="w-12 h-12 text-muted-foreground/30" />
        <h2 className="font-display text-2xl font-700">No data for {year} yet</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Start logging transactions and come back to see your year in review.
        </p>
      </div>
    );
  }

  const cards = [
    {
      icon: "💸",
      label: "Total spent in " + year,
      value: <BlurAmount value={stats.totalSpent} className="number-font text-4xl font-700 text-white" />,
      sub: `Across ${stats.txCount} transactions`,
      gradient: "from-violet-600 to-purple-700",
    },
    {
      icon: stats.topCat ? CATEGORY_META[stats.topCat as keyof typeof CATEGORY_META]?.icon : "🏷️",
      label: "Top spending category",
      value: <span className="text-4xl font-700 text-white">{stats.topCat ? CATEGORY_META[stats.topCat as keyof typeof CATEGORY_META]?.label : "—"}</span>,
      sub: stats.topCatAmt ? formatCurrency(stats.topCatAmt) + " total" : "",
      gradient: "from-orange-500 to-rose-600",
    },
    {
      icon: "🏆",
      label: "Biggest single splurge",
      value: <BlurAmount value={stats.biggest.amount} className="number-font text-4xl font-700 text-white" />,
      sub: stats.biggest.description,
      gradient: "from-red-500 to-pink-600",
    },
    {
      icon: "🧘",
      label: "Most disciplined month",
      value: <span className="number-font text-4xl font-700 text-white">{stats.disciplinedMonth ? new Date(stats.disciplinedMonth.key + "-01").toLocaleDateString("en-IN", { month: "long" }) : "—"}</span>,
      sub: stats.disciplinedMonth ? "Only " + formatCurrency(stats.disciplinedMonth.total) + " spent" : "",
      gradient: "from-emerald-500 to-teal-600",
    },
    {
      icon: "🔥",
      label: "Biggest spending month",
      value: <span className="number-font text-4xl font-700 text-white">{stats.mostSpentMonth ? new Date(stats.mostSpentMonth.key + "-01").toLocaleDateString("en-IN", { month: "long" }) : "—"}</span>,
      sub: stats.mostSpentMonth ? formatCurrency(stats.mostSpentMonth.total) + " spent" : "",
      gradient: "from-amber-500 to-orange-600",
    },
    {
      icon: "💰",
      label: "Saved vs budget",
      value: stats.totalBudgeted > 0
        ? <BlurAmount value={stats.totalSaved} className="number-font text-4xl font-700 text-white" />
        : <span className="number-font text-4xl font-700 text-white">—</span>,
      sub: stats.totalBudgeted > 0 ? "Out of " + formatCurrency(stats.totalBudgeted) + " budgeted" : "Set a budget to track savings",
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      icon: "🛒",
      label: "Unique merchants",
      value: <span className="number-font text-4xl font-700 text-white">{stats.uniqueMerchants}</span>,
      sub: "Different places you spent at",
      gradient: "from-cyan-500 to-sky-600",
    },
    {
      icon: "📊",
      label: "Average transaction",
      value: <BlurAmount value={stats.avgTx} className="number-font text-4xl font-700 text-white" />,
      sub: "Per transaction",
      gradient: "from-slate-600 to-gray-700",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-700 mb-1">
            <span className="gradient-text">{firstName}&apos;s {year} Wrapped</span> 🎁
          </h1>
          <p className="text-muted-foreground text-sm">Your year in money — the good, the bad, the biryani.</p>
        </motion.div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Download className="w-4 h-4" />
          Save as image
        </button>
      </div>

      {/* Wrapped card grid — this is the shareable bit */}
      <div ref={cardRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-gradient-to-br from-background to-secondary/30 rounded-3xl border border-border/50">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            className={`rounded-2xl p-5 bg-gradient-to-br ${card.gradient} relative overflow-hidden`}
          >
            <div className="absolute -top-3 -right-3 text-5xl opacity-20 rotate-12">{card.icon}</div>
            <div className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mb-3">{card.label}</div>
            <div className="mb-2">{card.value}</div>
            {card.sub && <div className="text-white/60 text-xs leading-relaxed">{card.sub}</div>}
          </motion.div>
        ))}

        {/* FinWin branding strip */}
        <div className="col-span-2 lg:col-span-4 flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
          <Sparkles className="w-3 h-3" />
          FinWin · {year} Wrapped
        </div>
      </div>

      {/* Fun facts */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-card border border-border/50 rounded-2xl p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <Star className="w-4 h-4 text-violet-500" />
          <h3 className="font-display text-base font-600">Fun facts from your {year}</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          {stats.busiestDayEntry && (
            <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
              <Flame className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Busiest spending day</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {new Date(stats.busiestDayEntry[0]).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} —{" "}
                  {formatCurrency(stats.busiestDayEntry[1])} in one day
                </div>
              </div>
            </div>
          )}
          {stats.totalSaved > 0 && (
            <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
              <Trophy className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">You stayed under budget!</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  Saved <span className="font-semibold">{formatCurrency(stats.totalSaved)}</span> across your budgeted categories.
                </div>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
            <TrendingDown className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Average spend per transaction</div>
              <div className="text-muted-foreground text-xs mt-0.5">
                {formatCurrency(stats.avgTx)} per transaction × {stats.txCount} transactions
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-xl">
            <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Spending diversity</div>
              <div className="text-muted-foreground text-xs mt-0.5">
                {stats.uniqueMerchants} unique merchants across {Object.keys(CATEGORY_META).filter((c) => transactions.some((t) => t.category === c)).length} categories.
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
