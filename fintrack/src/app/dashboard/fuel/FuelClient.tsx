"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Trash2, Fuel, TrendingUp, TrendingDown, Gauge, Coins } from "lucide-react";
import { FuelLog, FuelType } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { BlurAmount } from "@/components/ui/BlurAmount";

interface Props { logs: FuelLog[]; userId: string }

const FUEL_TYPES: { value: FuelType; label: string; icon: string }[] = [
  { value: "petrol", label: "Petrol", icon: "⛽" },
  { value: "diesel", label: "Diesel", icon: "🛢️" },
  { value: "cng", label: "CNG", icon: "🔵" },
  { value: "ev", label: "Electric", icon: "⚡" },
];

const BLANK = {
  date: new Date().toISOString().split("T")[0],
  liters: "",
  amount: "",
  odometer: "",
  fuel_type: "petrol" as FuelType,
  vehicle: "",
  notes: "",
};

interface FillupWithStats extends FuelLog {
  costPerLiter: number;
  kmSinceLast: number | null;
  mileage: number | null;    // km per liter
  costPerKm: number | null;
}

function withStats(logs: FuelLog[]): FillupWithStats[] {
  // Sort ascending by odometer for km calculation
  const sorted = [...logs].sort((a, b) => a.odometer - b.odometer);
  return sorted.map((log, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    const kmSinceLast = prev ? log.odometer - prev.odometer : null;
    const mileage = kmSinceLast && kmSinceLast > 0 && log.liters > 0
      ? kmSinceLast / log.liters
      : null;
    const costPerKm = kmSinceLast && kmSinceLast > 0
      ? log.amount / kmSinceLast
      : null;
    return {
      ...log,
      costPerLiter: log.liters > 0 ? log.amount / log.liters : 0,
      kmSinceLast,
      mileage,
      costPerKm,
    };
  }).reverse(); // newest first for display
}

export default function FuelClient({ logs, userId }: Props) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const enriched = useMemo(() => withStats(logs), [logs]);

  // Monthly stats (current calendar month)
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthLogs = useMemo(
    () => enriched.filter(l => l.date.startsWith(monthKey)),
    [enriched, monthKey]
  );
  const monthCost = useMemo(() => monthLogs.reduce((s, l) => s + l.amount, 0), [monthLogs]);
  const monthLiters = useMemo(() => monthLogs.reduce((s, l) => s + l.liters, 0), [monthLogs]);
  const avgMileage = useMemo(() => {
    const valid = enriched.filter(l => l.mileage !== null && l.mileage > 0);
    if (!valid.length) return null;
    return valid.reduce((s, l) => s + l.mileage!, 0) / valid.length;
  }, [enriched]);
  const latestCostPerLiter = enriched.length ? enriched[0].costPerLiter : null;
  const totalKmLogged = useMemo(() => {
    if (logs.length < 2) return null;
    const sorted = [...logs].sort((a, b) => a.odometer - b.odometer);
    return sorted[sorted.length - 1].odometer - sorted[0].odometer;
  }, [logs]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("fuel_logs").insert({
      user_id: userId,
      date: form.date,
      liters: parseFloat(form.liters),
      amount: parseFloat(form.amount),
      odometer: parseInt(form.odometer),
      fuel_type: form.fuel_type,
      vehicle: form.vehicle.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (!error) {
      setForm(BLANK);
      setShowForm(false);
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await supabase.from("fuel_logs").delete().eq("id", id);
    setDeleting(null);
    router.refresh();
  }

  const fuelTypeMeta = (ft: FuelType) => FUEL_TYPES.find(f => f.value === ft) ?? FUEL_TYPES[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-700 mb-1">Fuel Log</h1>
          <p className="text-muted-foreground text-sm">Track fill-ups, mileage & cost per km</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Fill-up
        </button>
      </div>

      {/* Summary cards */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "This month cost",
              value: <BlurAmount value={monthCost} className="number-font text-2xl font-700" />,
              sub: `${monthLiters.toFixed(1)} L filled`,
              icon: Coins,
              bg: "bg-orange-50 dark:bg-orange-950/30",
              color: "text-orange-600",
            },
            {
              label: "Avg mileage",
              value: <span className="number-font text-2xl font-700">{avgMileage ? `${avgMileage.toFixed(1)} km/L` : "—"}</span>,
              sub: avgMileage ? (avgMileage >= 15 ? "Good efficiency" : avgMileage >= 12 ? "Average" : "Below average") : "Need 2+ fill-ups",
              icon: Gauge,
              bg: "bg-emerald-50 dark:bg-emerald-950/30",
              color: "text-emerald-600",
            },
            {
              label: "Current rate",
              value: <BlurAmount value={latestCostPerLiter ?? 0} className="number-font text-2xl font-700" />,
              sub: "₹ per litre",
              icon: Fuel,
              bg: "bg-blue-50 dark:bg-blue-950/30",
              color: "text-blue-600",
            },
            {
              label: "Total km tracked",
              value: <span className="number-font text-2xl font-700">{totalKmLogged !== null ? `${totalKmLogged.toLocaleString("en-IN")}` : "—"}</span>,
              sub: totalKmLogged !== null ? "across all fill-ups" : "Need 2+ fill-ups",
              icon: TrendingUp,
              bg: "bg-violet-50 dark:bg-violet-950/30",
              color: "text-violet-600",
            },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card border border-border/50 rounded-2xl p-5"
            >
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-4`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="mb-1">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.sub}</div>
              <div className="text-[11px] text-muted-foreground/70 mt-0.5 font-medium uppercase tracking-wide">{c.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-2xl p-6"
        >
          <h2 className="font-display text-base font-600 mb-5">New fill-up</h2>
          <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Date</label>
              <input
                type="date" required value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Fuel type */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Fuel type</label>
              <div className="flex gap-2 flex-wrap">
                {FUEL_TYPES.map(ft => (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, fuel_type: ft.value }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${form.fuel_type === ft.value ? "bg-primary text-primary-foreground border-primary" : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}
                  >
                    <span>{ft.icon}</span>{ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Liters */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Litres filled</label>
              <input
                type="number" required min="0.1" step="0.1" placeholder="e.g. 35.5"
                value={form.liters}
                onChange={e => setForm(f => ({ ...f, liters: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {form.liters && form.amount && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  ₹{(parseFloat(form.amount) / parseFloat(form.liters)).toFixed(2)}/L
                </p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Total amount paid (₹)</label>
              <input
                type="number" required min="1" step="1" placeholder="e.g. 2800"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Odometer */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Odometer reading (km)</label>
              <input
                type="number" required min="0" step="1" placeholder="e.g. 23450"
                value={form.odometer}
                onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Vehicle (optional) */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Vehicle <span className="text-muted-foreground/50">(optional)</span></label>
              <input
                type="text" placeholder="e.g. Swift, Activa"
                value={form.vehicle}
                onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Notes <span className="text-muted-foreground/50">(optional)</span></label>
              <input
                type="text" placeholder="e.g. Highway trip, full tank"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="sm:col-span-2 flex gap-3 pt-1">
              <button
                type="submit" disabled={saving}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save fill-up"}
              </button>
              <button
                type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Fill-up history */}
      {enriched.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 text-muted-foreground"
        >
          <Fuel className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm font-medium mb-1">No fill-ups logged yet</p>
          <p className="text-xs">Add your first fill-up to start tracking mileage & fuel costs.</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-2xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border/50">
            <h3 className="font-display text-sm font-600">Fill-up history</h3>
          </div>
          <div className="divide-y divide-border/40">
            {enriched.map((log, i) => {
              const ft = fuelTypeMeta(log.fuel_type);
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors group"
                >
                  {/* Fuel type badge */}
                  <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-lg flex-shrink-0">
                    {ft.icon}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {log.vehicle || ft.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {log.notes && (
                        <span className="text-xs text-muted-foreground/70 truncate">{log.notes}</span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{log.liters.toFixed(1)}L</span>
                        {" "}@ ₹{log.costPerLiter.toFixed(2)}/L
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ODO: <span className="font-medium text-foreground">{log.odometer.toLocaleString("en-IN")} km</span>
                      </span>
                      {log.kmSinceLast !== null && log.kmSinceLast > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Ran: <span className="font-medium text-foreground">{log.kmSinceLast} km</span>
                        </span>
                      )}
                      {log.mileage !== null && (
                        <span className={`text-xs font-semibold flex items-center gap-0.5 ${log.mileage >= 15 ? "text-emerald-600" : log.mileage >= 12 ? "text-amber-600" : "text-red-500"}`}>
                          {log.mileage >= 15 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {log.mileage.toFixed(1)} km/L
                        </span>
                      )}
                      {log.costPerKm !== null && (
                        <span className="text-xs text-muted-foreground">
                          ₹{log.costPerKm.toFixed(2)}/km
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount + delete */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <BlurAmount value={log.amount} className="number-font text-sm font-700" />
                    <button
                      onClick={() => handleDelete(log.id)}
                      disabled={deleting === log.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
