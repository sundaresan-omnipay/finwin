"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Loader2, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Loan } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props {
  loans: Loan[];
  userId: string;
}

interface AmortizationRow {
  month: number;
  paymentDate: string;
  emi: number;
  principal: number;
  interest: number;
  outstanding: number;
}

function computeAmortization(loan: Loan): AmortizationRow[] {
  const rate = loan.annual_interest_rate ?? 0;
  const r = rate / 12 / 100;
  let outstanding = loan.principal_amount ?? 0;
  const rows: AmortizationRow[] = [];
  const start = new Date(loan.start_date);

  for (let i = 0; i < loan.tenure_months; i++) {
    const paymentDate = new Date(start);
    paymentDate.setMonth(start.getMonth() + i);

    const interest = r > 0 ? outstanding * r : 0;
    const principal = Math.min(loan.emi_amount - interest, outstanding);
    outstanding = Math.max(0, outstanding - principal);

    rows.push({
      month: i + 1,
      paymentDate: paymentDate.toISOString().split("T")[0],
      emi: loan.emi_amount,
      principal,
      interest,
      outstanding,
    });

    if (outstanding === 0) break;
  }
  return rows;
}

function monthsPaid(loan: Loan): number {
  const start = new Date(loan.start_date);
  const now = new Date();
  const diff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.min(Math.max(0, diff), loan.tenure_months);
}

const emptyForm = {
  loan_name: "", principal_amount: "", emi_amount: "",
  annual_interest_rate: "", tenure_months: "", start_date: new Date().toISOString().split("T")[0], notes: "",
};

export default function LoanClient({ loans, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scheduleLimit, setScheduleLimit] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const activeLoans = loans.filter((l) => l.is_active);
  const totalMonthlyEmi = activeLoans.reduce((s, l) => s + l.emi_amount, 0);

  const totalOutstanding = activeLoans.reduce((sum, loan) => {
    const schedule = computeAmortization(loan);
    const paid = monthsPaid(loan);
    const row = schedule[paid - 1];
    return sum + (row ? row.outstanding : loan.principal_amount);
  }, 0);

  function openAdd() {
    setEditingLoan(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(loan: Loan) {
    setEditingLoan(loan);
    setForm({
      loan_name: loan.loan_name,
      principal_amount: String(loan.principal_amount),
      emi_amount: String(loan.emi_amount),
      annual_interest_rate: String(loan.annual_interest_rate),
      tenure_months: String(loan.tenure_months),
      start_date: loan.start_date,
      notes: loan.notes ?? "",
    });
    setError("");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payload = {
      user_id: userId,
      loan_name: form.loan_name.trim(),
      principal_amount: parseFloat(form.principal_amount),
      emi_amount: parseFloat(form.emi_amount),
      annual_interest_rate: parseFloat(form.annual_interest_rate),
      tenure_months: parseInt(form.tenure_months),
      start_date: form.start_date,
      notes: form.notes.trim() || null,
    };
    if (editingLoan) {
      const { error: err } = await supabase.from("loans").update(payload).eq("id", editingLoan.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from("loans").insert({ ...payload, is_active: true });
      if (err) { setError(err.message); setLoading(false); return; }
    }
    setOpen(false);
    router.refresh();
    setLoading(false);
  }

  async function handleDelete(loan: Loan) {
    if (!confirm(`Delete "${loan.loan_name}"? This won't remove past transactions.`)) return;
    await supabase.from("loans").delete().eq("id", loan.id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-700">Loan Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">Track EMIs and view amortization schedule</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Add loan
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Monthly EMI total", value: <BlurAmount value={totalMonthlyEmi} className="number-font text-2xl font-700 text-white" />, sub: `${activeLoans.length} active loan${activeLoans.length !== 1 ? "s" : ""} · auto-deducted`, icon: "📅", color: "from-indigo-500 to-purple-600" },
          { label: "Total outstanding", value: <BlurAmount value={totalOutstanding} className="number-font text-2xl font-700 text-white" />, sub: "Across all loans", icon: "🏦", color: "from-rose-500 to-pink-600" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`rounded-2xl p-5 bg-gradient-to-br ${card.color} text-white relative overflow-hidden`}>
            <div className="absolute -top-3 -right-3 text-5xl opacity-20">{card.icon}</div>
            <div className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">{card.label}</div>
            <div className="mb-1">{card.value}</div>
            <div className="text-white/60 text-xs">{card.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Loan list */}
      {loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <span className="text-5xl">🏦</span>
          <p className="font-display text-lg font-600">No loans added yet</p>
          <p className="text-muted-foreground text-sm">Add a loan to track EMIs and see your repayment schedule</p>
          <button onClick={openAdd} className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Add your first loan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan, i) => {
            const schedule = computeAmortization(loan);
            const paid = monthsPaid(loan);
            const currentRow = schedule[paid] ?? schedule[schedule.length - 1];
            const outstanding = currentRow ? currentRow.outstanding : 0;
            const progressPct = Math.round((paid / loan.tenure_months) * 100);
            const limit = scheduleLimit[loan.id] ?? 12;
            const isExpanded = expandedId === loan.id;
            const remaining = loan.tenure_months - paid;
            const yearsLeft = Math.floor(remaining / 12);
            const monthsLeft = remaining % 12;

            return (
              <motion.div key={loan.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card border border-border/50 rounded-2xl overflow-hidden transition-all">

                {/* Loan header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center text-lg flex-shrink-0">🏦</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{loan.loan_name}</span>
                          {!loan.is_active && <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">Closed</span>}
                          {loan.is_active && <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">Auto-deducted</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <div>Principal: <BlurAmount value={loan.principal_amount ?? 0} className="font-medium" /> · Rate: <span className="font-medium">{loan.annual_interest_rate ?? 0}% p.a.</span></div>
                          <div>
                            {paid} of {loan.tenure_months} months paid ·{" "}
                            {remaining > 0 ? <>{yearsLeft > 0 && `${yearsLeft}y `}{monthsLeft > 0 && `${monthsLeft}m`} remaining</> : "Fully paid off 🎉"}
                          </div>
                          <div>Outstanding: <BlurAmount value={outstanding} className="font-semibold text-rose-600 dark:text-rose-400" /></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <BlurAmount value={loan.emi_amount} className="number-font text-lg font-700" />
                      <span className="text-xs text-muted-foreground -mt-1">EMI / month</span>
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => openEdit(loan)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(loan)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                      <span>{progressPct}% paid off</span>
                      <span>{paid} / {loan.tenure_months} EMIs</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  {/* Toggle amortization */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : loan.id)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {isExpanded ? "Hide" : "View"} amortization schedule
                  </button>
                </div>

                {/* Amortization table */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border/50">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-secondary/50">
                              <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Month</th>
                              <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Date</th>
                              <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">EMI</th>
                              <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Principal</th>
                              <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Interest</th>
                              <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Outstanding</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.slice(0, limit).map((row) => {
                              const isCurrent = row.month === paid + 1;
                              const isPastRow = row.month <= paid;
                              return (
                                <tr key={row.month}
                                  className={`border-t border-border/30 transition-colors ${isCurrent ? "bg-indigo-50/50 dark:bg-indigo-950/20" : isPastRow ? "opacity-50" : ""}`}>
                                  <td className="px-4 py-2.5">
                                    <span className="font-medium">{row.month}</span>
                                    {isCurrent && <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">current</span>}
                                    {isPastRow && <span className="ml-1.5 text-[10px] text-muted-foreground">✓</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(row.paymentDate).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}</td>
                                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(row.emi)}</td>
                                  <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(row.principal)}</td>
                                  <td className="px-4 py-2.5 text-right text-rose-500">{formatCurrency(row.interest)}</td>
                                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(row.outstanding)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {schedule.length > limit && (
                          <div className="p-3 text-center">
                            <button
                              onClick={() => setScheduleLimit({ ...scheduleLimit, [loan.id]: limit + 12 })}
                              className="text-xs text-primary hover:underline"
                            >
                              Show more ({schedule.length - limit} remaining rows)
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-600">{editingLoan ? "Edit loan" : "Add loan"}</h2>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Loan name</label>
                <input type="text" required value={form.loan_name} onChange={(e) => setForm({ ...form, loan_name: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="e.g. Home Loan - HDFC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Principal (₹)</label>
                  <input type="number" required min="1" step="0.01" value={form.principal_amount} onChange={(e) => setForm({ ...form, principal_amount: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="3000000" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">EMI amount (₹)</label>
                  <input type="number" required min="1" step="0.01" value={form.emi_amount} onChange={(e) => setForm({ ...form, emi_amount: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="45000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Annual interest rate (%)</label>
                  <input type="number" required min="0" max="50" step="0.01" value={form.annual_interest_rate} onChange={(e) => setForm({ ...form, annual_interest_rate: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="8.5" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Tenure (months)</label>
                  <input type="number" required min="1" max="600" value={form.tenure_months} onChange={(e) => setForm({ ...form, tenure_months: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="240" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">First EMI date</label>
                <input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Notes (optional)</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="e.g. HDFC Bank, account no." />
              </div>
              {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingLoan ? "Save changes" : "Add loan"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
