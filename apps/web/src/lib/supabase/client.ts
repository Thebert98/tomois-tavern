"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "../env";

export function supabaseBrowser() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
