"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathname = useRef(pathname);

  // Detect when navigation starts (link click) via a click interceptor
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http")) return;
      // Only animate if navigating to a different path
      if (href !== pathname) {
        startProgress();
      }
    }
    document.addEventListener("click", onLinkClick);
    return () => document.removeEventListener("click", onLinkClick);
  }, [pathname]);

  // When pathname changes, the page has loaded — complete the bar
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      completeProgress();
    }
  }, [pathname]);

  function startProgress() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    setWidth(0);
    // Quickly get to 30%, then slow down
    setTimeout(() => setWidth(30), 10);
    setTimeout(() => setWidth(60), 400);
    setTimeout(() => setWidth(75), 1000);
    setTimeout(() => setWidth(85), 2000);
  }

  function completeProgress() {
    if (!visible) return;
    setWidth(100);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 400);
  }

  if (!visible && width === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_6px_1px] shadow-primary/60"
        style={{
          width: `${width}%`,
          transition:
            width === 100
              ? "width 200ms ease-out"
              : "width 600ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}
