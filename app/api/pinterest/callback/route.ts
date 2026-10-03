import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/token-crypto";

export async function GET(request: NextRequest) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://ai.esoukk.ae").trim().replace(/\/$/, "");
  const done = (key: string, message: string) => NextResponse.redirect(`${site}/?${key}=${encodeURIComponent(message)}#meta-publishing`);
  try {
    const oauthError = request.nextUrl.searchParams.get("error"), description = request.nextUrl.searchParams.get("error_description");
    if (oauthError) throw new Error(description || oauthError);
    const code = request.nextUrl.searchParams.get("code"), state = request.nextUrl.searchParams.get("state"), expected = request.cookies.get("pinterest_oauth_state")?.value;
    if (!code || !state || state !== expected) throw new Error("Invalid or expired Pinterest authorization state.");
    const clientId = process.env.PINTEREST_APP_ID?.trim(), clientSecret = process.env.PINTEREST_APP_SECRET?.trim();
    if (!clientId || !clientSecret) throw new Error("Pinterest credentials are not configured.");
    const redirectUri = `${site}/api/pinterest/callback`;
    const tokenResponse = await fetch("https://api.pinterest.com/v5/oauth/token", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }), cache: "no-store" });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.message || "Pinterest token exchange failed.");
    const profileResponse = await fetch("https://api.pinterest.com/v5/user_account", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.username) throw new Error(profile.message || "Unable to read the Pinterest business account.");
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Your studio session expired.");
    const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(1).single();
    if (!membership || !["owner", "admin"].includes(membership.role)) throw new Error("Owner or admin access is required.");
    const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;
    const { error } = await supabase.from("social_connections").upsert({ organization_id: membership.organization_id, provider: "pinterest", provider_account_id: String(profile.id || profile.username), account_name: String(profile.username), encrypted_access_token: encryptToken(String(token.access_token)), token_expires_at: expiresAt, scopes: String(token.scope || "boards:read pins:read pins:write user_accounts:read").split(/[ ,]+/).filter(Boolean), status: "active", connected_by: user.id }, { onConflict: "organization_id,provider,provider_account_id" });
    if (error) throw error;
    const response = done("pinterest", "connected");
    response.cookies.delete("pinterest_oauth_state");
    return response;
  } catch (error) {
    return done("pinterest_error", error instanceof Error ? error.message : "Pinterest connection failed.");
  }
}
