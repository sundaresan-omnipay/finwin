"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Trash2, ArrowUpDown, Download, Coins, Users, User, RefreshCw, Pencil, Check, X } from "lucide-react";
import { Transaction, CATEGORY_META, CATEGORIES } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import AddTransactionButton from "@/components/ui/AddTransactionButton";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props {
  transactions: Transaction[];
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toISOString().split("T")[0];
  const yestStr = yesterday.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Today";
  if (dateStr === yestStr) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function TransactionsClient({ transactions }: Props) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState<"all" | "me" | "partner">("all");
  const [cashOnly, setCashOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ description: "", amount: "", category: "", date: "" });
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const hasPartnerTxs = useMemo(() => transactions.some(t => t.member === "partner"), [transactions]);

  const today = new Date().toISOString().split("T")[0];

  const thisWeekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  }, []);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
        if (catFilter !== "all" && t.category !== catFilter) return false;
        if (monthFilter !== "all" && !t.date.startsWith(monthFilter)) return false;
        if (cashOnly && !t.is_cash) return false;
        if (memberFilter === "me" && t.member === "partner") return false;
        if (memberFilter === "partner" && t.member !== "partner") return false;
        // Quick chips
        if (activeChip === "today" && t.date !== today) return false;
        if (activeChip === "week" && t.date < thisWeekStart) return false;
        if (activeChip === "food" && t.category !== "food") return false;
        if (activeChip === "big" && t.amount < 500) return false;
        if (activeChip === "cash" && !t.is_cash) return false;
        if (activeChip === "partner" && t.member !== "partner") return false;
        return true;
      })
      .sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return sortOrder === "desc" ? -dateDiff : dateDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [transactions, search, catFilter, monthFilter, sortOrder, cashOnly, memberFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    filtered.forEach(t => {
      const existing = map.get(t.date);
      if (existing) existing.push(t);
      else map.set(t.date, [t]);
    });
    return Array.from(map.entries()).map(([date, txs]) => ({
      date,
      txs,
      total: txs.reduce((s, t) => s + t.amount, 0),
    }));
  }, [filtered]);

  const totalFiltered = filtered.reduce((s, t) => s + t.amount, 0);
  const hasCash = transactions.some(t => t.is_cash);

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    setDeleting(id);
    await supabase.from("transactions").delete().eq("id", id);
    router.refresh();
    setDeleting(null);
  }

  function startEdit(tx: Transaction) {
    setEditing(tx.id);
    setEditForm({ description: tx.description, amount: String(tx.amount), category: tx.category, date: tx.date });
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.description.trim() || !editForm.amount) return;
    setSaving(true);
    await supabase.from("transactions").update({
      description: editForm.description.trim(),
      amount: parseFloat(editForm.amount),
      category: editForm.category,
      date: editForm.date,
    }).eq("id", id);
    setEditing(null);
    router.refresh();
    setSaving(false);
  }

  function exportCSV() {
    const rows = [
      ["Date", "Description", "Category", "Amount", "Cash", "Member", "Notes"],
      ...filtered.map((t) => [
        t.date, t.description, t.category, t.amount,
        t.is_cash ? "yes" : "no",
        t.member === "partner" ? "Partner" : "Me",
        t.notes || "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finwin-transactions.csv";
    a.click();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Transactions</h1>
          <p className="text-muted-foreground text-sm">{transactions.length} total records</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <AddTransactionButton />
        </div>
      </div>

      {/* Quick-filter chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "today", label: "Today" },
          { id: "week", label: "This week" },
          { id: "food", label: "🍛 Food" },
          { id: "big", label: "Over ₹500" },
          { id: "cash", label: "💵 Cash" },
          ...(hasPartnerTxs ? [{ id: "partner", label: "👫 Partner" }] : []),
        ].map(chip => (
          <button
            key={chip.id}
            onClick={() => setActiveChip(activeChip === chip.id ? null : chip.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              activeChip === chip.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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

        {/* Second row filters */}
        <div className="flex flex-wrap gap-2">
          {/* Member filter */}
          {(hasPartnerTxs) && (
            <div className="flex gap-1 bg-secondary/60 p-1 rounded-xl">
              {(["all", "me", "partner"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMemberFilter(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    memberFilter === m
                      ? m === "partner"
                        ? "bg-pink-500 text-white shadow-sm"
                        : "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "all" ? <><Users className="w-3 h-3" /> All</> :
                   m === "me" ? <><User className="w-3 h-3" /> Me</> :
                   <>👫 Partner</>}
                </button>
              ))}
            </div>
          )}

          {/* Cash filter */}
          {hasCash && (
            <button
              onClick={() => setCashOnly(!cashOnly)}
              className={`flex items-center gap-2 h-8 px-3 rounded-xl border text-xs font-medium transition-colors ${
                cashOnly
                  ? "bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-950/40 dark:border-yellow-800 dark:text-yellow-400"
                  : "border-border bg-secondary/50 hover:bg-secondary"
              }`}
            >
              <Coins className="w-3 h-3" />
              Cash only
            </button>
          )}
        </div>

        {/* Summary bar */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
          <span>{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</span>
          <BlurAmount value={totalFiltered} className="number-font font-semibold text-foreground" />
        </div>
      </div>

      {/* Grouped list */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl text-center py-16 text-muted-foreground">
          <p className="text-sm">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ date, txs, total }) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-700 text-muted-foreground uppercase tracking-wide">
                  {formatDateHeader(date)}
                </span>
                <BlurAmount value={total} className="number-font text-xs font-semibold text-muted-foreground" />
              </div>

              {/* Transactions for this date */}
              <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="divide-y divide-border/40">
                  {txs.map((tx, i) => {
                    const meta = CATEGORY_META[tx.category];
                    const isPartner = tx.member === "partner";
                    const isRecurring = tx.is_recurring === true;
                    const isEditingThis = editing === tx.id;
                    return (
                      <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                        {/* Normal row */}
                        <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/30 transition-colors group">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 relative"
                            style={{ background: meta?.lightColor }}
                          >
                            {meta?.icon}
                            {tx.is_cash && (
                              <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-400 text-yellow-900 rounded-full px-1 font-bold leading-4">₹</span>
                            )}
                            {isRecurring && !tx.is_cash && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <RefreshCw className="w-2.5 h-2.5 text-white" />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{tx.description}</span>
                              {isRecurring && (
                                <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5">
                                  <RefreshCw className="w-2.5 h-2.5" /> Fixed
                                </span>
                              )}
                              {isPartner && (
                                <span className="text-[10px] font-semibold bg-pink-100 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                  👫 Partner
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                style={{ background: meta?.lightColor, color: meta?.textColor }}
                              >
                                {meta?.icon} {meta?.label}
                              </span>
                              {tx.notes && <span className="text-xs text-muted-foreground truncate">{tx.notes}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <BlurAmount value={tx.amount} className="number-font font-600 text-sm" />
                            <button
                              onClick={() => isEditingThis ? setEditing(null) : startEdit(tx)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              disabled={deleting === tx.id}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline edit form */}
                        {isEditingThis && (
                          <div className="px-4 pb-3 pt-1 border-t border-border/40 bg-secondary/20">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <input
                                type="text"
                                value={editForm.description}
                                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder="Description"
                                className="col-span-2 h-9 px-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <input
                                type="number"
                                value={editForm.amount}
                                onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                                placeholder="Amount"
                                className="h-9 px-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <input
                                type="date"
                                value={editForm.date}
                                onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                className="h-9 px-3 rounded-xl border border-border bg-card text-sm focus:outline-none"
                              />
                              <select
                                value={editForm.category}
                                onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                className="col-span-2 h-9 px-3 rounded-xl border border-border bg-card text-sm focus:outline-none"
                              >
                                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label}</option>)}
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEdit(tx.id)}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                              <button
                                onClick={() => setEditing(null)}
                                className="flex items-center gap-1.5 px-3 h-8 rounded-xl border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
