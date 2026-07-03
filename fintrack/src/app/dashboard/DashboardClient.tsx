"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight,
  Flame, Target, Sparkles, ChevronRight, Zap,
  ShieldCheck, Clock, Coins, AlertTriangle, Users, Settings,
  Bell, PieChart, Plus, TrendingDown as TrendDownIcon, Activity, Calculator,
} from "lucide-react";
import { Transaction, Budget, UserSettings, CashWithdrawal, Credit, CATEGORY_META, NetWorthEntry, Bill, IncomeEntry } from "@/types";
import { formatCurrency, getSalaryCycleBounds, getPrevSalaryCycleBounds, computeNoSpendStreak, computeWorkHours, isSipOrEmiTx } from "@/lib/utils";
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
  credits: Credit[];
  totalSipMonthly: number;
  totalEmiMonthly: number;
  netWorthEntries: NetWorthEntry[];
  bills: Bill[];
  incomeEntries: IncomeEntry[];
}

export default function DashboardClient({
  transactions,
  budgets,
  currentMonth,
  userEmail,
  userSettings,
  cashWithdrawals,
  credits,
  totalSipMonthly,
  totalEmiMonthly,
  netWorthEntries,
  bills,
  incomeEntries,
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

  // Exclude SIP/EMI transactions from day-to-day spending (they're tracked separately)
  const dayToDaySpent = useMemo(
    () => monthTxs.filter((t) => !isSipOrEmiTx(t)).reduce((s, t) => s + t.amount, 0),
    [monthTxs]
  );

  const prevDayToDaySpent = useMemo(
    () => prevMonthTxs.filter((t) => !isSipOrEmiTx(t)).reduce((s, t) => s + t.amount, 0),
    [prevMonthTxs]
  );

  const budgetForCycle = useMemo(
    () => budgets.filter((b) => b.month === cycle.monthKey),
    [budgets, cycle]
  );
  const totalBudget = useMemo(() => budgetForCycle.reduce((s, b) => s + b.amount, 0), [budgetForCycle]);
  const remaining = totalBudget - dayToDaySpent;
  const budgetPct = totalBudget > 0 ? (dayToDaySpent / totalBudget) * 100 : 0;

  const today = new Date().toISOString().split("T")[0];
  const todaySpent = useMemo(
    () => transactions.filter((t) => t.date === today && !isSipOrEmiTx(t)).reduce((s, t) => s + t.amount, 0),
    [transactions, today]
  );

  const monthChange =
    prevDayToDaySpent > 0 ? ((dayToDaySpent - prevDayToDaySpent) / prevDayToDaySpent) * 100 : 0;

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxs.filter((t) => !isSipOrEmiTx(t)).forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [monthTxs]);

  const prevCategoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    prevMonthTxs.filter((t) => !isSipOrEmiTx(t)).forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [prevMonthTxs]);

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

  // --- Fixed/recurring expenses (rent, insurance, school fees) ---
  const cycleRecurringSpent = useMemo(
    () => monthTxs.filter((t) => t.is_recurring && t.category !== "savings" && t.category !== "emi").reduce((s, t) => s + t.amount, 0),
    [monthTxs]
  );

  // --- Credits (reimbursements, Pluxee, etc.) ---
  const cycleCredits = useMemo(
    () => credits.filter((c) => c.date >= cycle.start && c.date <= cycle.end).reduce((s, c) => s + c.amount, 0),
    [credits, cycle]
  );

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

  const daysInCycle = useMemo(() => {
    const start = new Date(cycle.start);
    const end = new Date(cycle.end);
    return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  }, [cycle]);

  const daysElapsed = daysInCycle - cycle.daysLeft;
  const dailyAvg = daysElapsed > 0 ? dayToDaySpent / daysElapsed : 0;

  // --- Smart insights (finance-grade) ---
  const suggestions = useMemo(() => {
    const tips: Array<{ title: string; description: string; type: "warning" | "success" | "info" }> = [];

    // 1. Spending projection vs budget
    if (totalBudget > 0 && daysElapsed > 0) {
      const projected = (dayToDaySpent / daysElapsed) * daysInCycle;
      if (projected > totalBudget * 1.05) {
        tips.push({
          title: "On track to overspend",
          description: `At ₹${formatCurrency(dailyAvg)}/day avg, you'll hit ${formatCurrency(projected)} by cycle end — ${formatCurrency(projected - totalBudget)} over your ${formatCurrency(totalBudget)} budget.`,
          type: "warning",
        });
      } else if (projected < totalBudget * 0.85 && dayToDaySpent > 0) {
        tips.push({
          title: "Well within budget",
          description: `Projected ${formatCurrency(projected)} by month end — ${formatCurrency(totalBudget - projected)} under your ${formatCurrency(totalBudget)} budget. Good discipline.`,
          type: "success",
        });
      }
    }

    // 2. EMI burden (only if salary known)
    if (monthlySalary && totalEmiMonthly > 0) {
      const emiBurden = (totalEmiMonthly / monthlySalary) * 100;
      if (emiBurden > 50) {
        tips.push({
          title: `High EMI burden: ${emiBurden.toFixed(0)}% of salary`,
          description: `${formatCurrency(totalEmiMonthly)}/month on loan EMIs. Above 50% is financially stressful — consider prepayment when you have surplus.`,
          type: "warning",
        });
      } else {
        tips.push({
          title: `EMI load: ${emiBurden.toFixed(0)}% of salary`,
          description: `${formatCurrency(totalEmiMonthly)}/month on loans — within healthy range (ideal: under 40%). Keep EMIs prioritised.`,
          type: "info",
        });
      }
    }

    // 3. Savings rate
    if (monthlySalary && totalSipMonthly > 0) {
      const rate = (totalSipMonthly / monthlySalary) * 100;
      if (rate >= 20) {
        tips.push({
          title: `Strong savings: ${rate.toFixed(0)}% of salary`,
          description: `${formatCurrency(totalSipMonthly)}/month into SIPs. You're in the top tier — most people invest under 10%.`,
          type: "success",
        });
      } else if (rate >= 10) {
        tips.push({
          title: `Savings rate: ${rate.toFixed(0)}% of salary`,
          description: `${formatCurrency(totalSipMonthly)}/month in SIPs — solid start. Target 20%+ to build real long-term wealth.`,
          type: "info",
        });
      } else {
        tips.push({
          title: `Low savings rate: ${rate.toFixed(0)}%`,
          description: `Only ${formatCurrency(totalSipMonthly)}/month in SIPs. Financial planners recommend 20-30% of income for wealth creation.`,
          type: "warning",
        });
      }
    }

    // 4. Budget category exceeded
    if (topCategory) {
      const catBudget = budgetForCycle.find((b) => b.category === topCategory.cat);
      if (catBudget && topCategory.amt > catBudget.amount) {
        tips.push({
          title: `${topCategory.meta?.label} over budget`,
          description: `Spent ${formatCurrency(topCategory.amt)} vs ${formatCurrency(catBudget.amount)} limit — ${formatCurrency(topCategory.amt - catBudget.amount)} over. Tighten up for the rest of the cycle.`,
          type: "warning",
        });
      }
    }

    // 5. No-spend streak
    if (streak.current >= 3) {
      tips.push({
        title: `${streak.current}-day no-spend streak`,
        description: `No discretionary spending for ${streak.current} consecutive days. Every such day compounds your savings.`,
        type: "success",
      });
    }

    // 6. Small spends leakage
    if (moneyLeaks.smallTotal > 500) {
      tips.push({
        title: `${moneyLeaks.smallSpends.length} micro-spends = ${formatCurrency(moneyLeaks.smallTotal)}`,
        description: "Small transactions under ₹200 add up silently. Cutting 3-4 of these daily can free ₹1,500+ a month.",
        type: "info",
      });
    }

    // 7. Month-over-month
    if (monthChange > 20 && dayToDaySpent > 0) {
      tips.push({
        title: `Spending up ${monthChange.toFixed(0)}% vs last cycle`,
        description: `${formatCurrency(dayToDaySpent)} this cycle vs ${formatCurrency(prevDayToDaySpent)} last cycle. Review what changed.`,
        type: "warning",
      });
    }

    // 8. Income diversity
    if (incomeEntries.length > 0) {
      const cycleExtra = incomeEntries.filter(e => e.date >= cycle.start && e.date <= cycle.end).reduce((s, e) => s + e.amount, 0);
      if (cycleExtra > 0) {
        tips.push({
          title: `+${formatCurrency(cycleExtra)} extra income this cycle`,
          description: "Non-salary income logged. Consider routing this directly to SIP or emergency fund.",
          type: "success",
        });
      }
    }

    if (!tips.length) {
      tips.push({
        title: "Tracking is working",
        description: "Add more transactions to get personalised financial insights here.",
        type: "info",
      });
    }

    return tips.slice(0, 3);
  }, [budgetPct, topCategory, monthChange, dayToDaySpent, prevDayToDaySpent, budgetForCycle, cycle, moneyLeaks, streak, monthlySalary, totalEmiMonthly, totalSipMonthly, totalBudget, daysElapsed, daysInCycle, dailyAvg, incomeEntries]);

  const firstName = userEmail.split("@")[0];

  // --- Net worth ---
  const totalAssets = useMemo(() => netWorthEntries.filter(e => e.type === "asset").reduce((s, e) => s + e.amount, 0), [netWorthEntries]);
  const totalLiabilities = useMemo(() => netWorthEntries.filter(e => e.type === "liability").reduce((s, e) => s + e.amount, 0), [netWorthEntries]);
  const netWorth = totalAssets - totalLiabilities;

  // --- 80C Tax savings tracker ---
  const tax80c = useMemo(() => {
    const limit = 150000;
    const today = new Date();
    // Indian financial year: Apr 1 - Mar 31
    const fyStart = today.getMonth() >= 3
      ? new Date(today.getFullYear(), 3, 1)  // Apr of current year
      : new Date(today.getFullYear() - 1, 3, 1); // Apr of prev year
    const fyEnd = new Date(fyStart.getFullYear() + 1, 2, 31);
    const fyStartStr = fyStart.toISOString().split("T")[0];
    const fyEndStr = fyEnd.toISOString().split("T")[0];

    // SIP contributions in this FY (savings category transactions tagged as recurring)
    const fySipContributions = transactions
      .filter(t => t.date >= fyStartStr && t.date <= fyEndStr && t.category === "savings" && t.is_recurring)
      .reduce((s, t) => s + t.amount, 0);

    // Annual SIP from active SIPs (approximate FY amount = monthly × months elapsed in FY)
    const today2 = new Date();
    const monthsElapsedInFY = (today2.getFullYear() - fyStart.getFullYear()) * 12 + (today2.getMonth() - fyStart.getMonth()) + 1;
    const estimatedAnnualSip = totalSipMonthly * Math.min(monthsElapsedInFY, 12);

    // EPF/PPF from networth entries
    const ppfEntries = netWorthEntries.filter(e => e.category === "pf_ppf");
    const ppfAmount = ppfEntries.reduce((s, e) => s + e.amount, 0);

    // Best estimate: use max of SIP contributions or estimated annual SIP
    const sipUsed = Math.max(fySipContributions, estimatedAnnualSip);
    // PPF contribution cap at ₹1.5L (show separately, don't double count with SIP)
    const totalUsed = Math.min(sipUsed, limit);
    const remaining = Math.max(0, limit - totalUsed);
    const pct = Math.min((totalUsed / limit) * 100, 100);

    const fyLabel = `FY ${fyStart.getFullYear()}-${String(fyEnd.getFullYear()).slice(2)}`;

    return { limit, totalUsed, remaining, pct, fyLabel, ppfAmount, sipUsed, monthsElapsedInFY };
  }, [transactions, totalSipMonthly, netWorthEntries]);

  // --- Income this cycle ---
  const cycleIncome = useMemo(
    () => incomeEntries.filter(e => e.date >= cycle.start && e.date <= cycle.end).reduce((s, e) => s + e.amount, 0),
    [incomeEntries, cycle]
  );
  const totalIncomeCycle = (monthlySalary ?? 0) + cycleIncome;

  // --- Upcoming bills (next 30 days) ---
  const upcomingBills = useMemo(() => {
    const todayDate = new Date();
    const todayDay = todayDate.getDate();
    return bills
      .map(bill => {
        let dueThisMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), bill.due_day);
        if (dueThisMonth < todayDate) {
          dueThisMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, bill.due_day);
        }
        const daysLeft = Math.ceil((dueThisMonth.getTime() - new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDay).getTime()) / 86400000);
        return { ...bill, daysLeft, dueDate: dueThisMonth.toISOString().split("T")[0] };
      })
      .filter(b => b.daysLeft >= 0 && b.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [bills]);

  // --- Spending anomaly detection (vs prev cycle by category) ---
  const anomalies = useMemo(() => {
    const prevTotals: Record<string, number> = {};
    prevMonthTxs.filter(t => !isSipOrEmiTx(t)).forEach(t => {
      prevTotals[t.category] = (prevTotals[t.category] || 0) + t.amount;
    });
    return Object.entries(categoryTotals)
      .filter(([cat, curr]) => {
        const prev = prevTotals[cat] || 0;
        return prev > 300 && curr > prev * 1.5;
      })
      .map(([cat, curr]) => ({
        category: cat,
        current: curr,
        prev: prevTotals[cat],
        ratio: curr / prevTotals[cat],
        meta: CATEGORY_META[cat as keyof typeof CATEGORY_META],
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 2);
  }, [categoryTotals, prevMonthTxs]);

  // --- Financial health score (0–100) ---
  const healthScore = useMemo(() => {
    if (!monthlySalary) return null;
    const breakdown: Array<{ label: string; pts: number; max: number; tip: string; good: boolean }> = [];
    let score = 0;

    // Savings rate (0-25)
    const savingsRate = totalSipMonthly / monthlySalary;
    const savingsPts = savingsRate >= 0.20 ? 25 : savingsRate >= 0.15 ? 20 : savingsRate >= 0.10 ? 15 : savingsRate >= 0.05 ? 8 : 0;
    breakdown.push({ label: "Savings", pts: savingsPts, max: 25, tip: `${(savingsRate * 100).toFixed(0)}% of salary`, good: savingsPts >= 15 });
    score += savingsPts;

    // EMI burden (0-20)
    const emiBurden = totalEmiMonthly / monthlySalary;
    const emiPts = emiBurden === 0 ? 20 : emiBurden <= 0.20 ? 20 : emiBurden <= 0.30 ? 15 : emiBurden <= 0.40 ? 10 : emiBurden <= 0.50 ? 5 : 0;
    breakdown.push({ label: "EMI load", pts: emiPts, max: 20, tip: emiBurden === 0 ? "No loans" : `${(emiBurden * 100).toFixed(0)}% of salary`, good: emiPts >= 15 });
    score += emiPts;

    // Budget control (0-20)
    let budgetPts = 10;
    let budgetTip = "No budget set";
    if (totalBudget > 0) {
      const overBy = (dayToDaySpent - totalBudget) / totalBudget;
      budgetPts = dayToDaySpent <= totalBudget ? 20 : overBy <= 0.05 ? 12 : overBy <= 0.15 ? 6 : 0;
      budgetTip = dayToDaySpent <= totalBudget ? "Within budget" : `${(overBy * 100).toFixed(0)}% over`;
    }
    breakdown.push({ label: "Budget", pts: budgetPts, max: 20, tip: budgetTip, good: budgetPts >= 15 });
    score += budgetPts;

    // No-spend streak (0-15)
    const streakPts = streak.current >= 7 ? 15 : streak.current >= 3 ? 10 : streak.current >= 1 ? 5 : 0;
    breakdown.push({ label: "Streak", pts: streakPts, max: 15, tip: streak.current === 0 ? "Start a streak" : `${streak.current} days`, good: streakPts >= 10 });
    score += streakPts;

    // Emergency fund (0-20)
    const emergencyAmt = userSettings?.emergency_fund_amount;
    let emergencyPts = 10;
    let emergencyTip = "Set in Settings";
    if (emergencyAmt && emergencyAmt > 0) {
      const refSpend = (prevDayToDaySpent > 0 ? prevDayToDaySpent : dayToDaySpent) || 1;
      const months = emergencyAmt / refSpend;
      emergencyPts = months >= 6 ? 20 : months >= 3 ? 15 : months >= 1 ? 8 : 2;
      emergencyTip = `${months.toFixed(1)} months covered`;
    }
    breakdown.push({ label: "Emergency", pts: emergencyPts, max: 20, tip: emergencyTip, good: emergencyPts >= 15 });
    score += emergencyPts;

    const grade = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs work";
    const gradeColor = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-blue-600" : score >= 40 ? "text-amber-600" : "text-red-500";
    const ringColor = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
    return { score, breakdown, grade, gradeColor, ringColor };
  }, [monthlySalary, totalSipMonthly, totalEmiMonthly, totalBudget, dayToDaySpent, streak, userSettings, prevDayToDaySpent]);

  // --- Partner sub-account ---
  const partnerName = userSettings?.partner_name ?? null;
  const partnerStartingBalance = userSettings?.partner_account_balance ?? null;
  const partnerCycleSpent = useMemo(
    () => monthTxs.filter((t) => t.member === "partner" && t.category !== "savings" && t.category !== "emi").reduce((s, t) => s + t.amount, 0),
    [monthTxs]
  );
  const partnerAllTimeSpent = useMemo(
    () => transactions.filter((t) => t.member === "partner" && t.category !== "savings" && t.category !== "emi").reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const partnerRunningBalance = partnerStartingBalance !== null ? partnerStartingBalance - partnerAllTimeSpent : null;

  const metrics = [
    {
      label: "Spent this cycle",
      value: <BlurAmount value={dayToDaySpent} className="number-font text-2xl font-600" />,
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

      {/* Financial Health Score */}
      {healthScore !== null && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border/50 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-500" />
              <h3 className="font-display text-base font-600">Financial Health Score</h3>
            </div>
            <span className={`text-sm font-700 ${healthScore.gradeColor}`}>{healthScore.grade}</span>
          </div>
          <div className="flex items-center gap-6">
            {/* Score ring */}
            <div className="relative flex-shrink-0 w-20 h-20">
              <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
                <circle
                  cx="40" cy="40" r="32" fill="none"
                  stroke={healthScore.ringColor} strokeWidth="8"
                  strokeDasharray={`${(healthScore.score / 100) * 201} 201`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="number-font text-xl font-700 leading-none">{healthScore.score}</span>
                <span className="text-[9px] text-muted-foreground font-medium">/100</span>
              </div>
            </div>
            {/* Breakdown bars */}
            <div className="flex-1 space-y-2">
              {healthScore.breakdown.map((b) => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-16 flex-shrink-0">{b.label}</span>
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${b.good ? "bg-emerald-500" : b.pts > 0 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${(b.pts / b.max) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground w-24 text-right flex-shrink-0 truncate">{b.tip}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Anomaly alerts inline */}
          {anomalies.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50 space-y-1.5">
              {anomalies.map(a => (
                <div key={a.category} className="flex items-center gap-2 text-xs">
                  <span className="text-amber-500">⚠</span>
                  <span className="font-medium">{a.meta?.label}</span>
                  <span className="text-muted-foreground">is {a.ratio.toFixed(1)}× last cycle — {formatCurrency(a.current)} vs {formatCurrency(a.prev)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Net Worth preview */}
      {netWorthEntries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="grid grid-cols-3 gap-3"
        >
          <Link href="/dashboard/networth" className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl p-4 hover:bg-emerald-100/60 transition-colors">
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">Total Assets</div>
            <BlurAmount value={totalAssets} className="number-font text-lg font-700 text-emerald-700 dark:text-emerald-400" />
          </Link>
          <Link href="/dashboard/networth" className="bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-2xl p-4 hover:bg-red-100/60 transition-colors">
            <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Liabilities</div>
            <BlurAmount value={totalLiabilities} className="number-font text-lg font-700 text-red-600 dark:text-red-400" />
          </Link>
          <Link href="/dashboard/networth" className={`border rounded-2xl p-4 hover:opacity-90 transition-opacity ${netWorth >= 0 ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40"}`}>
            <div className={`text-xs font-medium mb-1 ${netWorth >= 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"}`}>Net Worth</div>
            <BlurAmount value={Math.abs(netWorth)} className={`number-font text-lg font-700 ${netWorth >= 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"}`} />
          </Link>
        </motion.div>
      )}

      {/* 80C Tax Savings Tracker */}
      {monthlySalary && totalSipMonthly > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.162 }}
          className="bg-gradient-to-br from-indigo-50 via-indigo-50/60 to-transparent dark:from-indigo-950/20 dark:via-indigo-950/10 border border-indigo-200/60 dark:border-indigo-900/40 rounded-2xl p-5"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="font-display text-sm font-600 text-indigo-800 dark:text-indigo-300">80C Tax Savings</h3>
                <p className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70">{tax80c.fyLabel} · Limit ₹1,50,000</p>
              </div>
            </div>
            <div className="text-right">
              <BlurAmount
                value={tax80c.totalUsed}
                className="number-font text-lg font-700 text-indigo-700 dark:text-indigo-300"
              />
              <div className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70">invested so far</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all ${tax80c.pct >= 100 ? "bg-emerald-500" : tax80c.pct >= 60 ? "bg-indigo-500" : "bg-indigo-400"}`}
              style={{ width: `${tax80c.pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium ${tax80c.pct >= 100 ? "text-emerald-600" : "text-indigo-700 dark:text-indigo-300"}`}>
              {tax80c.pct >= 100
                ? "✓ Limit maxed — max tax benefit claimed!"
                : `${tax80c.pct.toFixed(0)}% used · ${formatCurrency(tax80c.remaining)} more to save ₹${((tax80c.remaining * 0.30) / 1000).toFixed(0)}k+ tax`}
            </span>
            <Link href="/dashboard/savings" className="flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              SIPs <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {tax80c.ppfAmount > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-indigo-200/50 dark:border-indigo-800/30 text-[11px] text-indigo-600/70 dark:text-indigo-400/70">
              EPF/PPF balance: <BlurAmount value={tax80c.ppfAmount} className="inline font-semibold" /> (tracked in Net Worth)
            </div>
          )}
          <div className="mt-1 text-[10px] text-indigo-500/60 dark:text-indigo-500/50">
            Estimate based on active SIPs × {tax80c.monthsElapsedInFY} months in FY. Includes ELSS, PPF contributions.
          </div>
        </motion.div>
      )}

      {/* Upcoming bills */}
      {upcomingBills.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.165 }}
          className="bg-card border border-border/50 rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <h3 className="font-display text-sm font-600">Upcoming Bills</h3>
            </div>
            <Link href="/dashboard/bills" className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingBills.slice(0, 4).map(bill => (
              <div key={bill.id} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${bill.daysLeft === 0 ? "bg-red-500" : bill.daysLeft <= 3 ? "bg-amber-500" : "bg-blue-400"}`} />
                <span className="text-sm flex-1 truncate">{bill.name}</span>
                {bill.amount && <BlurAmount value={bill.amount} className="number-font text-sm font-600 text-muted-foreground" />}
                <span className={`text-xs font-medium flex-shrink-0 ${bill.daysLeft === 0 ? "text-red-500" : bill.daysLeft <= 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {bill.daysLeft === 0 ? "Due today" : bill.daysLeft === 1 ? "Tomorrow" : `${bill.daysLeft}d`}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* No bills set yet — prompt */}
      {bills.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.165 }}
          className="flex items-center gap-4 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl px-5 py-3.5"
        >
          <Bell className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1 text-sm text-muted-foreground">Track bill due dates — never pay a late fee again.</div>
          <Link href="/dashboard/bills" className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline flex-shrink-0">
            <Plus className="w-3 h-3" /> Add bills
          </Link>
        </motion.div>
      )}

      {/* Partner sub-account card */}
      {(partnerName || partnerStartingBalance !== null || transactions.some(t => t.member === "partner")) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17 }}
          className="bg-gradient-to-br from-pink-50 via-rose-50/60 to-transparent dark:from-pink-950/20 dark:via-rose-950/10 border border-pink-200/70 dark:border-pink-900/40 rounded-2xl p-5"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            {/* Left: identity + balance */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center text-xl flex-shrink-0">
                👫
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-700">{partnerName || "Partner"}</span>
                  <span className="text-[10px] font-semibold bg-pink-100 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full">Sub-account</span>
                </div>
                {partnerRunningBalance !== null ? (
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">Balance</span>
                    <BlurAmount
                      value={partnerRunningBalance}
                      className={`number-font text-lg font-700 leading-none ${partnerRunningBalance < 0 ? "text-red-500" : "text-pink-600 dark:text-pink-400"}`}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Set balance in Settings to track account</p>
                )}
              </div>
            </div>

            {/* Right: this cycle stats */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">This cycle</div>
                <BlurAmount value={partnerCycleSpent} className="number-font text-lg font-600 text-pink-600 dark:text-pink-400" />
              </div>
              <Link
                href="/dashboard/transactions"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-pink-200 dark:border-pink-800 text-xs font-medium text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-950/40 transition-colors"
              >
                View<ChevronRight className="w-3.5 h-3.5" />
              </Link>
              {!partnerName && (
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <Settings className="w-3 h-3" />Set up
                </Link>
              )}
            </div>
          </div>

          {/* Mini progress bar: partner cycle spending vs your cycle spending */}
          {(partnerCycleSpent > 0 || dayToDaySpent > 0) && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>You</span>
                <span><BlurAmount value={dayToDaySpent} className="number-font inline" /> · {partnerCycleSpent + dayToDaySpent > 0 ? ((dayToDaySpent / (partnerCycleSpent + dayToDaySpent)) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-violet-400 rounded-l-full transition-all"
                  style={{ width: `${partnerCycleSpent + dayToDaySpent > 0 ? (dayToDaySpent / (partnerCycleSpent + dayToDaySpent)) * 100 : 0}%` }}
                />
                <div
                  className="h-full bg-pink-400 rounded-r-full transition-all"
                  style={{ width: `${partnerCycleSpent + dayToDaySpent > 0 ? (partnerCycleSpent / (partnerCycleSpent + dayToDaySpent)) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{partnerName || "Partner"}</span>
                <span><BlurAmount value={partnerCycleSpent} className="number-font inline" /> · {partnerCycleSpent + dayToDaySpent > 0 ? ((partnerCycleSpent / (partnerCycleSpent + dayToDaySpent)) * 100).toFixed(0) : 0}%</span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Zero-based salary waterfall */}
      {monthlySalary && monthlySalary > 0 && (() => {
        const committed = cycleRecurringSpent + totalSipMonthly + totalEmiMonthly;
        const adjustedSalary = monthlySalary + cycleCredits;
        const unallocated = adjustedSalary - committed - totalBudget;
        const isOverAllocated = unallocated < 0;

        const waterfallRows: Array<{
          label: string; sub: string; value: number; barColor: string;
          textColor: string; bgColor: string; isActual?: boolean; actualValue?: number; isCredit?: boolean;
        }> = [
          ...(cycleCredits > 0 ? [{
            label: "Credits & coupons", sub: "Pluxee, reimbursements added",
            value: cycleCredits, barColor: "bg-sky-400", textColor: "text-sky-600 dark:text-sky-400",
            bgColor: "bg-sky-50 dark:bg-sky-950/20", isCredit: true,
          }] : []),
          ...(cycleRecurringSpent > 0 ? [{
            label: "Fixed monthly", sub: "Rent, insurance, school fees",
            value: cycleRecurringSpent, barColor: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400",
            bgColor: "bg-blue-50 dark:bg-blue-950/20",
          }] : []),
          ...(totalSipMonthly > 0 ? [{
            label: "SIP investments", sub: "Mutual funds auto-deducted",
            value: totalSipMonthly, barColor: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400",
            bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
          }] : []),
          ...(totalEmiMonthly > 0 ? [{
            label: "Loan EMIs", sub: "Home / car / personal loan",
            value: totalEmiMonthly, barColor: "bg-rose-500", textColor: "text-rose-600 dark:text-rose-400",
            bgColor: "bg-rose-50 dark:bg-rose-950/20",
          }] : []),
          ...(totalBudget > 0 ? [{
            label: "Variable budget", sub: `${formatCurrency(dayToDaySpent)} spent so far`,
            value: totalBudget, barColor: "bg-violet-400", textColor: "text-violet-600 dark:text-violet-400",
            bgColor: "bg-violet-50 dark:bg-violet-950/20",
            isActual: true, actualValue: dayToDaySpent,
          }] : []),
        ];

        return (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="bg-card border border-border/50 rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-secondary/30">
              <div>
                <h3 className="font-display text-base font-600">Salary allocation</h3>
                <p className="text-xs text-muted-foreground">Where every rupee is assigned</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Take-home</div>
                <BlurAmount value={monthlySalary} className="number-font text-xl font-700" />
              </div>
            </div>

            {/* Stacked allocation bar */}
            <div className="px-6 pt-4 pb-2">
              <div className="h-3 bg-secondary rounded-full overflow-hidden flex gap-px">
                {waterfallRows.map(r => {
                  const pct = Math.min((r.value / adjustedSalary) * 100, 100);
                  if (pct <= 0) return null;
                  return <div key={r.label} className={`h-full ${r.barColor} transition-all`} style={{ width: `${pct}%` }} />;
                })}
                {unallocated > 0 && (
                  <div className="h-full bg-secondary flex-1 rounded-r-full" />
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-2">
                {waterfallRows.map(r => (
                  <div key={r.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className={`w-2 h-2 rounded-full ${r.barColor}`} />
                    {r.label}
                  </div>
                ))}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-secondary border border-border" />
                  Unallocated
                </div>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/40 mt-2">
              {waterfallRows.map(row => {
                const pct = adjustedSalary > 0 ? Math.min((row.value / adjustedSalary) * 100, 100) : 0;
                const spentPct = row.isActual && row.actualValue ? Math.min((row.actualValue / row.value) * 100, 100) : null;
                const isOverSpent = row.isActual && row.actualValue && row.actualValue > row.value;
                return (
                  <div key={row.label} className="flex items-center gap-4 px-6 py-3.5">
                    <div className={`w-8 h-8 rounded-xl ${row.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${row.barColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{row.label}</span>
                        {row.isCredit && <span className="text-[10px] font-semibold text-sky-500 bg-sky-50 dark:bg-sky-950/30 px-1.5 py-0.5 rounded-full">+income</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.sub}</div>
                      {row.isActual && spentPct !== null && (
                        <div className="mt-1 h-1 bg-secondary rounded-full overflow-hidden w-full">
                          <div
                            className={`h-full rounded-full ${isOverSpent ? "bg-red-500" : "bg-violet-500"}`}
                            style={{ width: `${spentPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`number-font text-sm font-700 ${row.isCredit ? "text-sky-600 dark:text-sky-400" : row.textColor}`}>
                        {row.isCredit && <span className="mr-0.5">+</span>}
                        <BlurAmount value={row.value} className="inline" />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(0)}% of salary</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unallocated / over-allocated footer */}
            <div className={`flex items-center justify-between px-6 py-4 border-t-2 ${isOverAllocated ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10" : "border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/10"}`}>
              <div>
                <div className={`text-sm font-700 ${isOverAllocated ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {isOverAllocated ? "⚠ Over-allocated" : "✓ Unallocated"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {isOverAllocated
                    ? "Committed + budget exceeds salary — reduce budget or fixed expenses"
                    : totalBudget > 0
                      ? "Not assigned to any budget category yet"
                      : "Set a budget to see full allocation"}
                </div>
              </div>
              <BlurAmount
                value={Math.abs(unallocated)}
                className={`number-font text-2xl font-700 tabular-nums ${isOverAllocated ? "text-red-600" : "text-emerald-600"}`}
              />
            </div>
          </motion.div>
        );
      })()}

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

      {/* Category vs last cycle comparison */}
      {Object.keys(categoryTotals).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="bg-card border border-border/50 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-violet-500" />
            <div>
              <h3 className="font-display text-sm font-600">This cycle vs last cycle</h3>
              <p className="text-xs text-muted-foreground">Category breakdown comparison</p>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(categoryTotals)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([cat, curr]) => {
                const prev = prevCategoryTotals[cat] ?? 0;
                const diff = curr - prev;
                const diffPct = prev > 0 ? (diff / prev) * 100 : null;
                const meta = CATEGORY_META[cat as keyof typeof CATEGORY_META];
                const maxAmt = Math.max(curr, prev, 1);
                return (
                  <div key={cat} className="flex items-center gap-3 group">
                    <span className="text-base w-7 flex-shrink-0">{meta?.icon ?? "💰"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate">{meta?.label ?? cat}</span>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <BlurAmount value={curr} className="number-font text-xs font-600" />
                          {diffPct !== null && (
                            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${diff > 0 ? "text-red-500" : "text-emerald-500"}`}>
                              {diff > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                              {Math.abs(diffPct).toFixed(0)}%
                            </span>
                          )}
                          {diffPct === null && prev === 0 && (
                            <span className="text-[10px] text-muted-foreground">new</span>
                          )}
                        </div>
                      </div>
                      {/* Dual bar: this (solid) vs last (faint) */}
                      <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
                        {prev > 0 && (
                          <div
                            className="absolute inset-y-0 left-0 bg-muted-foreground/20 rounded-full"
                            style={{ width: `${(prev / maxAmt) * 100}%` }}
                          />
                        )}
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all ${diff > 50 ? "bg-red-400" : diff < -50 ? "bg-emerald-500" : "bg-violet-400"}`}
                          style={{ width: `${(curr / maxAmt) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          {Object.keys(prevCategoryTotals).filter(c => !categoryTotals[c]).length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-2">
              {Object.entries(prevCategoryTotals)
                .filter(([c]) => !categoryTotals[c])
                .slice(0, 4)
                .map(([cat, amt]) => {
                  const meta = CATEGORY_META[cat as keyof typeof CATEGORY_META];
                  return (
                    <span key={cat} className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/60 rounded-full px-2 py-0.5">
                      {meta?.icon} {meta?.label ?? cat} — <BlurAmount value={amt} className="number-font inline" /> last cycle
                    </span>
                  );
                })}
            </div>
          )}
        </motion.div>
      )}

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
