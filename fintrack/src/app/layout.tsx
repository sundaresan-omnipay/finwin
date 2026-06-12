import type { Metadata } from "next";
import "./globals.css";
import { BlurProvider } from "@/contexts/blur-context";

export const metadata: Metadata = {
  title: "FinWin — Smart Finance Monitor",
  description: "Track your spending, stay on budget, and get AI-powered insights.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-body antialiased">
        <BlurProvider>{children}</BlurProvider>
      </body>
    </html>
  );
}
