"use client";

import { useBlur } from "@/contexts/blur-context";
import { formatCurrency } from "@/lib/utils";

interface Props {
  value: number;
  className?: string;
}

export function BlurAmount({ value, className = "" }: Props) {
  const { blurred } = useBlur();
  return (
    <span
      className={`transition-all duration-200 ${blurred ? "blur-sm select-none" : ""} ${className}`.trim()}
    >
      {blurred ? "₹•••••" : formatCurrency(value)}
    </span>
  );
}
