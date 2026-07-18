import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "./env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { projectUrl, publishableKey } = getPublicSupabaseEnv();

  return createServerClient(projectUrl, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always write cookies. Middleware/auth routes
          // will own session refresh when authentication is added in Phase 1.2.
        }
      },
    },
  });
}
