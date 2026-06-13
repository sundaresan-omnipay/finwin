"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, X, Loader2, TrendingUp, PauseCircle, Circle, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Sip } from "@/types";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props {
  sips: Sip[];
  userId: string;
}

const emptyForm = { fund_name: "", monthly_amount: "", notes: "" };

export default function SavingsClient({ sips, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [editingSip, setEditingSip] = useState<Sip | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeSips = sips.filter((s) => s.is_active);
  const totalMonthly = activeSips.reduce((s, sip) => s + sip.monthly_amount, 0);

  function openAdd() {
    setEditingSip(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(sip: Sip) {
    setEditingSip(sip);
    setForm({
      fund_name: sip.fund_name,
      monthly_amount: String(sip.monthly_amount),
      notes: sip.notes ?? "",
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
      fund_name: form.fund_name.trim(),
      monthly_amount: parseFloat(form.monthly_amount),
      sip_day: 1,
      start_date: new Date().toISOString().split("T")[0],
      notes: form.notes.trim() || null,
    };
    if (editingSip) {
      const { error: err } = await supabase.from("sips").update(payload).eq("id", editingSip.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from("sips").insert({ ...payload, is_active: true });
      if (err) { setError(err.message); setLoading(false); return; }
    }
    setOpen(false);
    router.refresh();
    setLoading(false);
  }

  async function handleToggleActive(sip: Sip) {
    await supabase.from("sips").update({ is_active: !sip.is_active }).eq("id", sip.id);
    router.refresh();
  }

  async function handleDelete(sip: Sip) {
    if (!confirm(`Delete "${sip.fund_name}"? This won't remove past transactions.`)) return;
    await supabase.from("sips").delete().eq("id", sip.id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-700">SIP Savings</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your monthly mutual fund investments</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Add SIP
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Monthly SIP total", value: <BlurAmount value={totalMonthly} className="number-font text-2xl font-700 text-white" />, sub: `${activeSips.length} active SIP${activeSips.length !== 1 ? "s" : ""}`, icon: "📈", color: "from-emerald-500 to-teal-600" },
          { label: "Total SIPs", value: <span className="number-font text-2xl font-700 text-white">{sips.length}</span>, sub: `${activeSips.length} active · ${sips.length - activeSips.length} paused`, icon: "📊", color: "from-blue-500 to-indigo-600" },
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

      {/* SIP list */}
      {sips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30" />
          <p className="font-display text-lg font-600">No SIPs added yet</p>
          <p className="text-muted-foreground text-sm">Add your first SIP to start tracking investments</p>
          <button onClick={openAdd} className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Add your first SIP
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sips.map((sip, i) => (
            <motion.div key={sip.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={`bg-card border rounded-2xl p-5 transition-all ${!sip.is_active ? "opacity-60 border-border/40" : "border-border/50"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 text-lg">📈</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{sip.fund_name}</span>
                      {!sip.is_active && <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">Paused</span>}
                      {sip.is_active && <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Auto-deducted monthly</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {sip.notes && <div className="italic">{sip.notes}</div>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <BlurAmount value={sip.monthly_amount} className="number-font text-lg font-700" />
                  <span className="text-xs text-muted-foreground -mt-1">per month</span>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => openEdit(sip)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleToggleActive(sip)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors" title={sip.is_active ? "Pause SIP" : "Resume SIP"}>
                      {sip.is_active ? <PauseCircle className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDelete(sip)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-600">{editingSip ? "Edit SIP" : "Add SIP"}</h2>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">SIP / Fund name</label>
                <input type="text" required value={form.fund_name} onChange={(e) => setForm({ ...form, fund_name: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="e.g. Axis Bluechip Fund" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Monthly amount (₹)</label>
                <input type="number" required min="1" step="0.01" value={form.monthly_amount} onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="5000" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Notes (optional)</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="e.g. Zerodha Coin, Axis MF" />
              </div>
              {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingSip ? "Save changes" : "Add SIP"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
