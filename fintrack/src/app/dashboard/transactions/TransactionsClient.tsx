"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Filter, Trash2, ArrowUpDown, Calendar, Download } from "lucide-react";
import { Transaction, CATEGORY_META, CATEGORIES } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import AddTransactionButton from "@/components/ui/AddTransactionButton";

interface Props {
  transactions: Transaction[];
}

export default function TransactionsClient({ transactions }: Props) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
        if (catFilter !== "all" && t.category !== catFilter) return false;
        if (monthFilter !== "all" && !t.date.startsWith(monthFilter)) return false;
        return true;
      })
      .sort((a, b) => {
        const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
        return sortOrder === "desc" ? -diff : diff;
      });
  }, [transactions, search, catFilter, monthFilter, sortOrder]);

  const totalFiltered = filtered.reduce((s, t) => s + t.amount, 0);

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    setDeleting(id);
    await supabase.from("transactions").delete().eq("id", id);
    router.refresh();
    setDeleting(null);
  }

  function exportCSV() {
    const rows = [
      ["Date", "Description", "Category", "Amount", "Notes"],
      ...filtered.map((t) => [t.date, t.description, t.category, t.amount, t.notes || ""]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fintrack-transactions.csv";
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Transactions</h1>
          <p className="text-muted-foreground text-sm">{transactions.length} total records</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <AddTransactionButton />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Category */}
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_META[c].label}</option>
            ))}
          </select>

          {/* Month */}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {new Date(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>

          {/* Sort */}
          <button
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border bg-secondary/50 text-sm font-medium hover:bg-secondary transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === "desc" ? "Newest" : "Oldest"}
          </button>
        </div>

        {/* Summary bar */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
          <span>{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</span>
          <span className="number-font font-medium text-foreground">{formatCurrency(totalFiltered)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No transactions found</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((tx, i) => {
              const meta = CATEGORY_META[tx.category];
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30 transition-colors group"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: meta?.lightColor }}
                  >
                    {meta?.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{tx.description}</div>
                    {tx.notes && (
                      <div className="text-xs text-muted-foreground truncate">{tx.notes}</div>
                    )}
                  </div>

                  <div
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: meta?.lightColor, color: meta?.textColor }}
                  >
                    {meta?.icon} {meta?.label}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                  </div>

                  <div className="number-font font-600 text-sm min-w-24 text-right">
                    {formatCurrency(tx.amount)}
                  </div>

                  <button
                    onClick={() => handleDelete(tx.id)}
                    disabled={deleting === tx.id}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
