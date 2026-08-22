"use client";

import { createBrowserClient } from "@supabase/ssr";

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) throw new Error("Supabase public configuration is unavailable.");

  return { key, url };
}

export function createClient() {
  const { key, url } = getPublicSupabaseConfig();
  return createBrowserClient(url, key);
}
