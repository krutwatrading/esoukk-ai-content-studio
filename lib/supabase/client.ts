"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "./env";

export function createSupabaseBrowserClient() {
  const { projectUrl, publishableKey } = getPublicSupabaseEnv();
  return createBrowserClient(projectUrl, publishableKey);
}
