import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function getLast6Months(): string[] {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(getMonthKey(d));
  }
  return months;
}

export function getLast12Months(): string[] {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(getMonthKey(d));
  }
  return months;
}

// --- Salary cycle utilities ---

export interface CycleBounds {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
  label: string;
  daysLeft: number;
  monthKey: string; // YYYY-MM used for budget lookup
}

export function getSalaryCycleBounds(salaryDay: number, today = new Date()): CycleBounds {
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-based
  const day = today.getDate();

  let startYear: number;
  let startMonth: number; // 0-based

  if (day >= salaryDay) {
    startYear = year;
    startMonth = month;
  } else {
    startMonth = month - 1;
    startYear = startMonth < 0 ? year - 1 : year;
    if (startMonth < 0) startMonth = 11;
  }

  const start = new Date(startYear, startMonth, salaryDay);
  // end = one day before next cycle starts
  const nextStart = new Date(startYear, startMonth + 1, salaryDay);
  const end = new Date(nextStart.getTime() - 86400000);

  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - todayMs) / 86400000) + 1);

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    label: `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
    daysLeft,
    monthKey: `${startYear}-${String(startMonth + 1).padStart(2, "0")}`,
  };
}

export function getPrevSalaryCycleBounds(salaryDay: number, today = new Date()): CycleBounds {
  const current = getSalaryCycleBounds(salaryDay, today);
  const dayBeforeStart = new Date(current.start);
  dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
  return getSalaryCycleBounds(salaryDay, dayBeforeStart);
}

// --- Streak utilities ---

export function computeNoSpendStreak(transactions: { date: string; category: string }[]): {
  current: number;
  bestThisMonth: number;
} {
  const discretionaryDates = new Set(
    transactions.filter((t) => t.category !== "bills").map((t) => t.date)
  );

  const today = new Date();

  // Current streak: consecutive no-spend days counting back from today
  let current = 0;
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    if (discretionaryDates.has(ds)) break;
    current++;
  }

  // Best streak this month
  const daysThisMonth = today.getDate();
  let best = 0;
  let temp = 0;
  for (let i = 1; i <= daysThisMonth; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), i);
    const ds = d.toISOString().split("T")[0];
    if (!discretionaryDates.has(ds)) {
      temp++;
      if (temp > best) best = temp;
    } else {
      temp = 0;
    }
  }

  return { current, bestThisMonth: best };
}

// --- SIP / EMI transaction filter ---
// SIP and loan EMI are fixed salary deductions — exclude from all budget, analytics, and wrapped calculations.
// A transaction is SIP/EMI if its category is "savings"/"emi" OR its description starts with "SIP:"/"EMI:"
// (the old "Mark paid" button sometimes saved these as category "other" with a prefixed description).
export function isSipOrEmiTx(t: { category: string; description?: string | null }): boolean {
  if (t.category === "savings" || t.category === "emi") return true;
  const desc = (t.description || "").toLowerCase();
  return desc.startsWith("sip:") || desc.startsWith("emi:");
}

// --- Work hours utilities ---

export function computeWorkHours(amount: number, monthlySalary: number): number {
  // 26 working days × 8 hours = 208 hrs/month
  const hourlyRate = monthlySalary / 208;
  return Math.round((amount / hourlyRate) * 10) / 10;
}
