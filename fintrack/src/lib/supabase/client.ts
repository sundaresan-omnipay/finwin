"use client";

import { createBrowserClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";
import { compressSessionCookies } from "./session-compress";

function getAllCookies() {
  if (typeof document === "undefined") return [];
  const parsed = parse(document.cookie);
  return Object.entries(parsed).map(([name, value]) => ({ name, value: value ?? "" }));
}

function setAllCookies(
  items: Array<{ name: string; value: string; options?: Record<string, unknown> }>
) {
  items.forEach(({ name, value, options = {} }) => {
    document.cookie = serialize(name, value, {
      path: "/",
      sameSite: "lax",
      maxAge: value === "" ? 0 : 400 * 24 * 60 * 60,
      ...(options as Parameters<typeof serialize>[2]),
    });
  });
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return getAllCookies();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          setAllCookies(compressSessionCookies(cookiesToSet));
        },
      },
    }
  );
}
