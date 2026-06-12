"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CATEGORY_META, UserSettings } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  userSettings?: UserSettings | null;
}

export default function AddTransactionButton({ userSettings }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "food" as string,
    date: new Date().toISOString().split("T")[0],
    notes: "",
    is_cash: false,
    isWithdrawal: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    if (form.isWithdrawal) {
      // Log as cash withdrawal
      const { error: err } = await supabase.from("cash_withdrawals").insert({
        user_id: user.id,
        amount: parseFloat(form.amount),
        date: form.date,
        notes: form.notes || null,
      });
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from("transactions").insert({
        user_id: user.id,
        description: form.description,
        amount: parseFloat(form.amount),
        category: form.category,
        date: form.date,
        notes: form.notes || null,
        is_cash: form.is_cash,
      });
      if (err) { setError(err.message); setLoading(false); return; }
    }

    setOpen(false);
    setForm({
      description: "",
      amount: "",
      category: "food",
      date: new Date().toISOString().split("T")[0],
      notes: "",
      is_cash: false,
      isWithdrawal: false,
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:-translate-y-0.5"
      >
        <Plus className="w-4 h-4" />
        Add transaction
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-600">Add transaction</h2>
                <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ATM withdrawal toggle */}
              <div className="flex gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isWithdrawal: false })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${!form.isWithdrawal ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  Spend
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isWithdrawal: true, is_cash: false })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2 ${form.isWithdrawal ? "bg-yellow-500 text-white border-yellow-500" : "border-border text-muted-foreground hover:border-yellow-400"}`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  ATM withdrawal
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!form.isWithdrawal && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Description</label>
                    <input
                      type="text"
                      required
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder="e.g. Lunch at Swiggy"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                      {form.isWithdrawal ? "Withdrawal amount (₹)" : "Amount (₹)"}
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Date</label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {!form.isWithdrawal && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Category</label>
                      <div className="grid grid-cols-3 gap-2">
                        {CATEGORIES.map((cat) => {
                          const meta = CATEGORY_META[cat];
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setForm({ ...form, category: cat })}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                                form.category === cat
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

                    {/* Cash payment toggle */}
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, is_cash: !form.is_cash })}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        form.is_cash
                          ? "bg-yellow-50 border-yellow-300 text-yellow-700 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-400"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <Coins className="w-4 h-4 flex-shrink-0" />
                      {form.is_cash ? "Paid in cash ✓" : "Paid in cash? (tap to mark)"}
                    </button>
                  </>
                )}

                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                    {form.isWithdrawal ? "Notes (optional)" : "Notes (optional)"}
                  </label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder={form.isWithdrawal ? "e.g. SBI ATM, MG Road" : "Any extra details..."}
                  />
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : form.isWithdrawal ? "Log withdrawal" : "Save transaction"}
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
