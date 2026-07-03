export type Category =
  | "food"
  | "groceries"
  | "vegetables"
  | "milk"
  | "snacks"
  | "transport"
  | "petrol"
  | "shopping"
  | "clothing"
  | "bills"
  | "household"
  | "health"
  | "entertainment"
  | "travel"
  | "education"
  | "kids"
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
  is_recurring?: boolean;
  member?: string | null;
  created_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  salary_day: number;       // 1–28
  monthly_salary: number | null;
  whatsapp_phone: string | null;
  partner_name: string | null;
  partner_account_balance: number | null;
  emergency_fund_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface NetWorthEntry {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  type: "asset" | "liability";
  category: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type IncomeType = "salary" | "freelance" | "rental" | "dividend" | "bonus" | "gift" | "other";

export interface IncomeEntry {
  id: string;
  user_id: string;
  source: string;
  amount: number;
  date: string;
  income_type: IncomeType;
  notes?: string;
  created_at: string;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: number | null;
  due_day: number;
  category: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export type FuelType = "petrol" | "diesel" | "cng" | "ev";

export interface FuelLog {
  id: string;
  user_id: string;
  date: string;
  liters: number;
  amount: number;      // total ₹ paid
  odometer: number;   // km at fill-up
  fuel_type: FuelType;
  vehicle?: string | null;
  notes?: string | null;
  created_at: string;
}

export const ASSET_CATEGORIES = [
  { value: "cash_savings", label: "Cash & Savings", icon: "🏦" },
  { value: "fixed_deposit", label: "Fixed Deposit", icon: "📋" },
  { value: "mutual_funds", label: "Mutual Funds & SIP", icon: "📈" },
  { value: "stocks", label: "Stocks & ETFs", icon: "📊" },
  { value: "gold", label: "Gold & Silver", icon: "🥇" },
  { value: "property", label: "Property & Real Estate", icon: "🏠" },
  { value: "pf_ppf", label: "EPF / PPF", icon: "🛡️" },
  { value: "other_asset", label: "Other Asset", icon: "💎" },
] as const;

export const LIABILITY_CATEGORIES = [
  { value: "home_loan", label: "Home Loan", icon: "🏠" },
  { value: "car_loan", label: "Car Loan", icon: "🚗" },
  { value: "personal_loan", label: "Personal Loan", icon: "💸" },
  { value: "credit_card", label: "Credit Card Debt", icon: "💳" },
  { value: "education_loan", label: "Education Loan", icon: "🎓" },
  { value: "other_liability", label: "Other Liability", icon: "📄" },
] as const;

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
    label: "Dining Out",
    icon: "🍽️",
    color: "#f97316",
    lightColor: "#fff7ed",
    textColor: "#c2410c",
  },
  groceries: {
    label: "Groceries",
    icon: "🛒",
    color: "#84cc16",
    lightColor: "#f7fee7",
    textColor: "#3f6212",
  },
  vegetables: {
    label: "Vegetables & Fruits",
    icon: "🥦",
    color: "#16a34a",
    lightColor: "#f0fdf4",
    textColor: "#14532d",
  },
  milk: {
    label: "Milk & Dairy",
    icon: "🥛",
    color: "#60a5fa",
    lightColor: "#eff6ff",
    textColor: "#1d4ed8",
  },
  snacks: {
    label: "Snacks & Chai",
    icon: "☕",
    color: "#d97706",
    lightColor: "#fffbeb",
    textColor: "#78350f",
  },
  transport: {
    label: "Transport",
    icon: "🚗",
    color: "#3b82f6",
    lightColor: "#eff6ff",
    textColor: "#1d4ed8",
  },
  petrol: {
    label: "Petrol & Fuel",
    icon: "⛽",
    color: "#ef4444",
    lightColor: "#fef2f2",
    textColor: "#b91c1c",
  },
  shopping: {
    label: "Shopping",
    icon: "🛍️",
    color: "#a855f7",
    lightColor: "#faf5ff",
    textColor: "#7e22ce",
  },
  clothing: {
    label: "Clothing",
    icon: "👕",
    color: "#fb923c",
    lightColor: "#fff7ed",
    textColor: "#c2410c",
  },
  bills: {
    label: "Bills & Utilities",
    icon: "💡",
    color: "#eab308",
    lightColor: "#fefce8",
    textColor: "#a16207",
  },
  household: {
    label: "Home Supplies",
    icon: "🧹",
    color: "#a78bfa",
    lightColor: "#f5f3ff",
    textColor: "#6d28d9",
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
  kids: {
    label: "Kids & School",
    icon: "🎒",
    color: "#f472b6",
    lightColor: "#fdf4ff",
    textColor: "#a21caf",
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

export interface Goal {
  id: string;
  user_id: string;
  goal_name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  notes?: string;
  is_completed: boolean;
  created_at: string;
}

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export const CATEGORY_GROUPS: Array<{ label: string; categories: Category[] }> = [
  { label: "Daily Food", categories: ["food", "groceries", "vegetables", "milk", "snacks"] },
  { label: "Home & Bills", categories: ["bills", "household"] },
  { label: "Transport", categories: ["transport", "petrol"] },
  { label: "Lifestyle", categories: ["shopping", "clothing", "health", "entertainment"] },
  { label: "Family & Growth", categories: ["kids", "education", "travel"] },
  { label: "Other", categories: ["other"] },
];

export interface Credit {
  id: string;
  user_id: string;
  amount: number;
  source: string;
  credit_type: string;
  date: string;
  notes?: string;
  created_at: string;
}
