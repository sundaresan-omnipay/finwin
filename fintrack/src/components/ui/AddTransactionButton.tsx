"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Coins, ArrowDownLeft, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CATEGORY_META, UserSettings } from "@/types";
import { isSipOrEmiTx } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  userSettings?: UserSettings | null;
  compact?: boolean;
}

type Tab = "spend" | "atm" | "credit";

const CREDIT_TYPES = [
  { value: "pluxee", label: "Pluxee / Coupon", icon: "🎫" },
  { value: "reimbursement", label: "Reimbursement", icon: "💸" },
  { value: "cash_received", label: "Cash from someone", icon: "🤝" },
  { value: "salary_advance", label: "Salary advance", icon: "🏛️" },
  { value: "other", label: "Other", icon: "➕" },
];

// Spending categories only (exclude savings/emi which are auto-deducted)
const SPEND_CATEGORIES = CATEGORIES.filter(c => !isSipOrEmiTx({ category: c, description: "" }));

export default function AddTransactionButton({ userSettings, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("spend");
  const router = useRouter();
  const supabase = createClient();

  const [spendForm, setSpendForm] = useState({
    description: "",
    amount: "",
    category: "food" as string,
    date: new Date().toISOString().split("T")[0],
    notes: "",
    is_cash: false,
    is_recurring: false,
    member: null as string | null,
  });

  const [atmForm, setAtmForm] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [creditForm, setCreditForm] = useState({
    source: "",
    amount: "",
    credit_type: "pluxee",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  function resetAll() {
    const today = new Date().toISOString().split("T")[0];
    setSpendForm({ description: "", amount: "", category: "food", date: today, notes: "", is_cash: false, is_recurring: false, member: null });
    setAtmForm({ amount: "", date: today, notes: "" });
    setCreditForm({ source: "", amount: "", credit_type: "pluxee", date: today, notes: "" });
    setTab("spend");
    setError("");
  }

  function handleClose() {
    setOpen(false);
    resetAll();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    if (tab === "atm") {
      const { error: err } = await supabase.from("cash_withdrawals").insert({
        user_id: user.id,
        amount: parseFloat(atmForm.amount),
        date: atmForm.date,
        notes: atmForm.notes || null,
      });
      if (err) { setError(err.message); setLoading(false); return; }
    } else if (tab === "credit") {
      const { error: err } = await supabase.from("credits").insert({
        user_id: user.id,
        amount: parseFloat(creditForm.amount),
        source: creditForm.source,
        credit_type: creditForm.credit_type,
        date: creditForm.date,
        notes: creditForm.notes || null,
      });
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from("transactions").insert({
        user_id: user.id,
        description: spendForm.description,
        amount: parseFloat(spendForm.amount),
        category: spendForm.category,
        date: spendForm.date,
        notes: spendForm.notes || null,
        is_cash: spendForm.is_cash,
        is_recurring: spendForm.is_recurring,
        member: spendForm.member || null,
      });
      if (err) { setError(err.message); setLoading(false); return; }
    }

    handleClose();
    router.refresh();
    setLoading(false);
  }

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
          aria-label="Add transaction"
        >
          <Plus className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          Add transaction
        </button>
      )}

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleClose}
            />
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="relative bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto"
            >
              {/* Handle bar on mobile */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-border rounded-full" />
              </div>

              <div className="flex items-center justify-between px-6 pt-4 pb-4 sm:pt-6">
                <h2 className="font-display text-xl font-600">Add entry</h2>
                <button onClick={handleClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1.5 mx-6 mb-5 bg-secondary/60 p-1 rounded-xl">
                {([
                  { id: "spend", label: "Spend", icon: "💳" },
                  { id: "atm", label: "ATM", icon: "🏧" },
                  { id: "credit", label: "Credit", icon: "💚" },
                ] as { id: Tab; label: string; icon: string }[]).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      tab === t.id
                        ? t.id === "credit"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : t.id === "atm"
                          ? "bg-amber-500 text-white shadow-sm"
                          : "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-base leading-none">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
                {/* SPEND TAB */}
                {tab === "spend" && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Description</label>
                      <input
                        type="text"
                        required
                        value={spendForm.description}
                        onChange={(e) => setSpendForm({ ...spendForm, description: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        placeholder="e.g. Lunch at Swiggy"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Amount (₹)</label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={spendForm.amount}
                          onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Date</label>
                        <input
                          type="date"
                          required
                          value={spendForm.date}
                          onChange={(e) => setSpendForm({ ...spendForm, date: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block text-muted-foreground">Category</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {SPEND_CATEGORIES.map((cat) => {
                          const meta = CATEGORY_META[cat];
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSpendForm({ ...spendForm, category: cat })}
                              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                                spendForm.category === cat
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              <span>{meta.icon}</span>
                              <span className="truncate">{meta.label.split(" ")[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Who spent? */}
                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Who spent?</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSpendForm({ ...spendForm, member: null })}
                          className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-medium transition-all ${
                            spendForm.member === null
                              ? "bg-primary/10 border-primary text-primary"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          👤 Me
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpendForm({ ...spendForm, member: "partner" })}
                          className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-medium transition-all ${
                            spendForm.member === "partner"
                              ? "bg-pink-50 border-pink-400 text-pink-700 dark:bg-pink-950/30 dark:border-pink-700 dark:text-pink-400"
                              : "border-border text-muted-foreground hover:border-pink-300"
                          }`}
                        >
                          👫 {userSettings?.partner_name || "Partner"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSpendForm({ ...spendForm, is_cash: !spendForm.is_cash })}
                        className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                          spendForm.is_cash
                            ? "bg-yellow-50 border-yellow-300 text-yellow-700 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-400"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <Coins className="w-4 h-4 flex-shrink-0" />
                        {spendForm.is_cash ? "Cash ✓" : "Paid in cash?"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpendForm({ ...spendForm, is_recurring: !spendForm.is_recurring })}
                        className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                          spendForm.is_recurring
                            ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-400"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <RefreshCw className="w-4 h-4 flex-shrink-0" />
                        {spendForm.is_recurring ? "Fixed monthly ✓" : "Fixed monthly?"}
                      </button>
                    </div>
                    {spendForm.is_recurring && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 -mt-1 px-1">
                        Rent, insurance, school fees — won&apos;t count towards your daily spend limit.
                      </p>
                    )}

                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Notes (optional)</label>
                      <input
                        type="text"
                        value={spendForm.notes}
                        onChange={(e) => setSpendForm({ ...spendForm, notes: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        placeholder="Any extra details..."
                      />
                    </div>
                  </>
                )}

                {/* ATM TAB */}
                {tab === "atm" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Amount (₹)</label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={atmForm.amount}
                          onChange={(e) => setAtmForm({ ...atmForm, amount: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Date</label>
                        <input
                          type="date"
                          required
                          value={atmForm.date}
                          onChange={(e) => setAtmForm({ ...atmForm, date: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Notes (optional)</label>
                      <input
                        type="text"
                        value={atmForm.notes}
                        onChange={(e) => setAtmForm({ ...atmForm, notes: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        placeholder="e.g. SBI ATM, MG Road"
                      />
                    </div>
                  </>
                )}

                {/* CREDIT TAB */}
                {tab === "credit" && (
                  <>
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl px-4 py-3 flex items-start gap-3">
                      <ArrowDownLeft className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                        Record money received — Pluxee coupons, cash from someone, reimbursements. This offsets your expenses in the salary breakdown.
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Source</label>
                      <input
                        type="text"
                        required
                        value={creditForm.source}
                        onChange={(e) => setCreditForm({ ...creditForm, source: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                        placeholder="e.g. Pluxee food coupon, Cash from Ravi"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Amount (₹)</label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          value={creditForm.amount}
                          onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Date</label>
                        <input
                          type="date"
                          required
                          value={creditForm.date}
                          onChange={(e) => setCreditForm({ ...creditForm, date: e.target.value })}
                          className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block text-muted-foreground">Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {CREDIT_TYPES.map((ct) => (
                          <button
                            key={ct.value}
                            type="button"
                            onClick={() => setCreditForm({ ...creditForm, credit_type: ct.value })}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                              creditForm.credit_type === ct.value
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                : "border-border bg-secondary/50 text-muted-foreground hover:border-emerald-400"
                            }`}
                          >
                            <span>{ct.icon}</span>
                            <span className="truncate">{ct.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Notes (optional)</label>
                      <input
                        type="text"
                        value={creditForm.notes}
                        onChange={(e) => setCreditForm({ ...creditForm, notes: e.target.value })}
                        className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                        placeholder="Any extra details..."
                      />
                    </div>
                  </>
                )}

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 h-11 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-60 ${
                      tab === "credit"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : tab === "atm"
                        ? "bg-amber-500 hover:bg-amber-600"
                        : "bg-primary hover:bg-primary/90"
                    }`}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : tab === "credit" ? (
                      "Save credit"
                    ) : tab === "atm" ? (
                      "Log withdrawal"
                    ) : (
                      "Save transaction"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
