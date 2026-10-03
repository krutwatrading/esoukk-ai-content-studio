import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login";
  const isProtected = path === "/" || path.startsWith("/onboarding");

  // API routes perform their own authorization. Avoid making every webhook,
  // OAuth callback and asset request depend on an external auth round-trip.
  if (!isAuthPage && !isProtected) return response;

  const { projectUrl, publishableKey } = getPublicSupabaseEnv();
  const supabase = createServerClient(projectUrl, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  let user = null;
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Supabase session check timed out.")), 2500)),
    ]);
    user = result.data.user;
  } catch {
    // A stale browser session or temporary Supabase networking issue must not
    // consume Vercel's full middleware deadline and produce an opaque 504.
    if (isProtected) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "session_timeout");
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }
  if (!user && isProtected) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }
  if (user && isAuthPage) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }
  return response;
}
