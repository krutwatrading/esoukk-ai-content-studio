import { createClient } from "@supabase/supabase-js";
import { getSecretSupabaseEnv } from "./env";

export function createSupabaseAdminClient() {
  const { projectUrl, secretKey } = getSecretSupabaseEnv();
  return createClient(projectUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
