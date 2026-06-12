"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface BlurContextType {
  blurred: boolean;
  toggle: () => void;
}

const BlurContext = createContext<BlurContextType>({ blurred: false, toggle: () => {} });

export function BlurProvider({ children }: { children: ReactNode }) {
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("finwin-blur") === "true") setBlurred(true);
    } catch {}
  }, []);

  const toggle = () => {
    setBlurred((b) => {
      const next = !b;
      try {
        localStorage.setItem("finwin-blur", String(next));
      } catch {}
      return next;
    });
  };

  return <BlurContext.Provider value={{ blurred, toggle }}>{children}</BlurContext.Provider>;
}

export const useBlur = () => useContext(BlurContext);
