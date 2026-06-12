export type Category =
  | "food"
  | "transport"
  | "shopping"
  | "bills"
  | "health"
  | "entertainment"
  | "travel"
  | "education"
  | "savings"
  | "emi"
  | "other";

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  category: Category;
  date: string;
  notes?: string;
  is_cash?: boolean;
  created_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  salary_day: number;       // 1–28
  monthly_salary: number | null;
  whatsapp_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: Category;
  amount: number;
  month: string; // YYYY-MM
  created_at: string;
}

export interface CategoryMeta {
  label: string;
  icon: string;
  color: string;
  lightColor: string;
  textColor: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  food: {
    label: "Food & Dining",
    icon: "🍽️",
    color: "#f97316",
    lightColor: "#fff7ed",
    textColor: "#c2410c",
  },
  transport: {
    label: "Transport",
    icon: "🚗",
    color: "#3b82f6",
    lightColor: "#eff6ff",
    textColor: "#1d4ed8",
  },
  shopping: {
    label: "Shopping",
    icon: "🛍️",
    color: "#a855f7",
    lightColor: "#faf5ff",
    textColor: "#7e22ce",
  },
  bills: {
    label: "Bills & Utilities",
    icon: "💡",
    color: "#eab308",
    lightColor: "#fefce8",
    textColor: "#a16207",
  },
  health: {
    label: "Health",
    icon: "💊",
    color: "#22c55e",
    lightColor: "#f0fdf4",
    textColor: "#15803d",
  },
  entertainment: {
    label: "Entertainment",
    icon: "🎬",
    color: "#ec4899",
    lightColor: "#fdf2f8",
    textColor: "#be185d",
  },
  travel: {
    label: "Travel",
    icon: "✈️",
    color: "#06b6d4",
    lightColor: "#ecfeff",
    textColor: "#0e7490",
  },
  education: {
    label: "Education",
    icon: "📚",
    color: "#8b5cf6",
    lightColor: "#f5f3ff",
    textColor: "#6d28d9",
  },
  savings: {
    label: "SIP & Savings",
    icon: "📈",
    color: "#10b981",
    lightColor: "#ecfdf5",
    textColor: "#065f46",
  },
  emi: {
    label: "Loan EMI",
    icon: "🏦",
    color: "#6366f1",
    lightColor: "#eef2ff",
    textColor: "#3730a3",
  },
  other: {
    label: "Other",
    icon: "📦",
    color: "#6b7280",
    lightColor: "#f9fafb",
    textColor: "#374151",
  },
};

export interface Sip {
  id: string;
  user_id: string;
  fund_name: string;
  monthly_amount: number;
  sip_day: number;
  start_date: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  loan_name: string;
  principal_amount: number;
  emi_amount: number;
  annual_interest_rate: number;
  tenure_months: number;
  start_date: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
