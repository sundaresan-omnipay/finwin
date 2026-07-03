"use client";

import { useMemo } from "react";
import { Transaction } from "@/types";
import { formatCurrency, isSipOrEmiTx } from "@/lib/utils";

interface Props {
  transactions: Transaction[];
  weeks?: number; // default 6
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getColorClass(pct: number): string {
  if (pct === 0) return "bg-slate-100 dark:bg-slate-800";
  if (pct <= 0.25) return "bg-emerald-100 dark:bg-emerald-900/50";
  if (pct <= 0.5) return "bg-yellow-200 dark:bg-yellow-700/50";
  if (pct <= 0.75) return "bg-orange-300 dark:bg-orange-700/60";
  return "bg-red-400 dark:bg-red-700/70";
}

function getTextColorClass(pct: number): string {
  if (pct === 0) return "text-slate-400";
  if (pct <= 0.5) return "text-slate-600 dark:text-slate-300";
  return "text-white";
}

export default function SpendingHeatmap({ transactions, weeks = 6 }: Props) {
  const { cells, maxSpend, dailyAvg } = useMemo(() => {
    const dayMap: Record<string, number> = {};
    transactions
      .filter((t) => !isSipOrEmiTx(t))
      .forEach((t) => {
        dayMap[t.date] = (dayMap[t.date] || 0) + t.amount;
      });

    // Build grid: go back (weeks*7) days from today, starting from last Sunday
    const today = new Date();
    // Find the last Sunday on or before today
    const dayOfWeek = today.getDay(); // 0=Sun
    const gridEnd = new Date(today);
    gridEnd.setDate(today.getDate() - dayOfWeek + 6); // end on Saturday of current week
    const gridStart = new Date(gridEnd);
    gridStart.setDate(gridEnd.getDate() - weeks * 7 + 1);

    const cells: Array<{ date: string; label: string; amount: number; isToday: boolean; isFuture: boolean }> = [];
    const cursor = new Date(gridStart);
    const todayStr = today.toISOString().split("T")[0];

    while (cursor <= gridEnd) {
      const dateStr = cursor.toISOString().split("T")[0];
      const isFuture = dateStr > todayStr;
      cells.push({
        date: dateStr,
        label: cursor.getDate().toString(),
        amount: isFuture ? 0 : (dayMap[dateStr] ?? 0),
        isToday: dateStr === todayStr,
        isFuture,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const amounts = cells.filter((c) => !c.isFuture && c.amount > 0).map((c) => c.amount);
    const maxSpend = amounts.length ? Math.max(...amounts) : 1;
    const totalSpend = amounts.reduce((s, a) => s + a, 0);
    const dailyAvg = amounts.length ? totalSpend / amounts.length : 0;

    return { cells, maxSpend, dailyAvg };
  }, [transactions, weeks]);

  const weeksArray = useMemo(() => {
    const result: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [cells]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          Daily avg (spend days): {formatCurrency(dailyAvg)}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Low</span>
          <div className="flex gap-0.5">
            {["bg-slate-100 dark:bg-slate-800", "bg-emerald-100 dark:bg-emerald-900/50", "bg-yellow-200 dark:bg-yellow-700/50", "bg-orange-300 dark:bg-orange-700/60", "bg-red-400 dark:bg-red-700/70"].map((cls, i) => (
              <div key={i} className={`w-4 h-4 rounded-sm ${cls}`} />
            ))}
          </div>
          <span>High</span>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs text-muted-foreground font-medium">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-1">
        {weeksArray.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((cell) => {
              const pct = cell.isFuture || maxSpend === 0 ? 0 : cell.amount / maxSpend;
              const colorClass = cell.isFuture
                ? "bg-slate-50 dark:bg-slate-900/30 opacity-30"
                : getColorClass(pct);
              const textColor = cell.isFuture ? "text-slate-300" : getTextColorClass(pct);

              return (
                <div
                  key={cell.date}
                  title={cell.isFuture ? "" : cell.amount > 0 ? `${cell.date}: ${formatCurrency(cell.amount)}` : `${cell.date}: No spend`}
                  className={`relative aspect-square rounded-md flex flex-col items-center justify-center cursor-default transition-opacity ${colorClass} ${cell.isToday ? "ring-2 ring-violet-500 ring-offset-1" : ""}`}
                >
                  <span className={`text-xs font-semibold leading-none ${textColor}`}>
                    {cell.label}
                  </span>
                  {cell.amount > 0 && !cell.isFuture && (
                    <span className={`text-[9px] leading-none mt-0.5 ${textColor} opacity-80`}>
                      {cell.amount >= 1000 ? `${(cell.amount / 1000).toFixed(1)}k` : cell.amount.toFixed(0)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm ring-2 ring-violet-500 ring-offset-1 bg-slate-100 dark:bg-slate-800 inline-block" />
          Today
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800 inline-block" />
          No spend
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-700/70 inline-block" />
          Highest: {formatCurrency(maxSpend)}
        </span>
      </div>
    </div>
  );
}
