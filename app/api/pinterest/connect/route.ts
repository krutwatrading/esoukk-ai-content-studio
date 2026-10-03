import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://ai.esoukk.ae").trim().replace(/\/$/, "");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", site));
  const clientId = process.env.PINTEREST_APP_ID?.trim();
  if (!clientId) return NextResponse.json({ error: "PINTEREST_APP_ID is not configured." }, { status: 503 });
  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${site}/api/pinterest/callback`;
  const url = new URL("https://www.pinterest.com/oauth/");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "boards:read,pins:read,pins:write,user_accounts:read", state }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set("pinterest_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
