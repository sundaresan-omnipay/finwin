export type Category =
  | "food"
  | "transport"
  | "shopping"
  | "bills"
  | "health"
  | "entertainment"
  | "travel"
  | "education"
  | "other";

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  category: Category;
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
  other: {
    label: "Other",
    icon: "📦",
    color: "#6b7280",
    lightColor: "#f9fafb",
    textColor: "#374151",
  },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
