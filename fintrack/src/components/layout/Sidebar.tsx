"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  BarChart3,
  Settings,
  LogOut,
  Wallet,
  Eye,
  EyeOff,
  Gift,
  TrendingUp,
  Building2,
  Star,
  Fuel,
  MoreHorizontal,
  X,
  Bell,
  PieChart,
  DollarSign,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useBlur } from "@/contexts/blur-context";
import AddTransactionButton from "@/components/ui/AddTransactionButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/budget", label: "Budget", icon: Target },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/loans", label: "Loans", icon: Building2 },
  { href: "/dashboard/networth", label: "Net Worth", icon: PieChart },
  { href: "/dashboard/income", label: "Income", icon: DollarSign },
  { href: "/dashboard/bills", label: "Bills", icon: Bell },
  { href: "/dashboard/savings", label: "SIP Savings", icon: TrendingUp },
  { href: "/dashboard/goals", label: "Goals", icon: Star },
  { href: "/dashboard/fuel", label: "Fuel Log", icon: Fuel },
  { href: "/dashboard/wrapped", label: "Wrapped", icon: Gift },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// Bottom nav: 4 primary items + center Add + More
const BOTTOM_PRIMARY = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Txns", icon: ArrowLeftRight },
  // center + button goes here
  { href: "/dashboard/budget", label: "Budget", icon: Target },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [moreOpen, setMoreOpen] = useState(false);
  const { blurred, toggle: toggleBlur } = useBlur();

  const allNavItems = NAV_ITEMS;

  // Items that go into the "More" bottom sheet
  const moreItems = allNavItems.filter(
    (item) => !BOTTOM_PRIMARY.some((p) => p.href === item.href)
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <>
      {/* ─── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 fixed left-0 top-0 h-full bg-card border-r border-border/50 flex-col z-40">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-display text-base font-700">FinWin</span>
              <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Finance Monitor</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
          {allNavItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110", active ? "text-white" : "")} />
                {item.label}
                {item.href === "/dashboard/wrapped" && !active && (
                  <span className="ml-auto text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-semibold">NEW</span>
                )}
                {active && (
                  <motion.div layoutId="desktop-active" className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Add transaction button */}
        <div className="px-4 pb-3 pt-1 border-t border-border/30">
          <AddTransactionButton userSettings={null} />
        </div>

        {/* User section */}
        <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
          <button
            onClick={toggleBlur}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
              blurred
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {blurred ? <EyeOff className="w-4 h-4 flex-shrink-0" /> : <Eye className="w-4 h-4 flex-shrink-0" />}
            <span>{blurred ? "Amounts hidden" : "Hide amounts"}</span>
          </button>

          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/50">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-600 text-primary">{user.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user.email}</div>
              <div className="text-[10px] text-muted-foreground">Free plan</div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Bottom Navigation ────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border/50">
        <div className="flex items-center justify-around px-2 h-16 pb-safe">
          {/* First 2 primary items */}
          {BOTTOM_PRIMARY.slice(0, 2).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-transform", active && "scale-110")} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && <div className="w-1 h-1 rounded-full bg-primary" />}
              </Link>
            );
          })}

          {/* Center Add Button */}
          <div className="-mt-4">
            <AddTransactionButton userSettings={null} compact />
          </div>

          {/* Last 2 primary items */}
          {BOTTOM_PRIMARY.slice(2).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-transform", active && "scale-110")} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && <div className="w-1 h-1 rounded-full bg-primary" />}
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all",
              moreItems.some((i) => pathname === i.href) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* ─── Mobile "More" Bottom Sheet ──────────────────────────────── */}
      <AnimatePresence>
        {moreOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl border-t border-border/50 pb-8"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-4">
                <div className="w-10 h-1 bg-border rounded-full" />
              </div>

              <div className="flex items-center justify-between px-6 mb-4">
                <span className="font-display text-base font-600">More</span>
                <button onClick={() => setMoreOpen(false)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 grid grid-cols-3 gap-2 mb-4">
                {moreItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border text-sm font-medium transition-all",
                        active
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-xs text-center leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Divider + user actions */}
              <div className="mx-4 border-t border-border/50 pt-4 space-y-2">
                <button
                  onClick={() => { toggleBlur(); setMoreOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    blurred
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-secondary/50 text-muted-foreground"
                  )}
                >
                  {blurred ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {blurred ? "Show amounts" : "Hide amounts"}
                </button>

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive bg-destructive/5 hover:bg-destructive/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
