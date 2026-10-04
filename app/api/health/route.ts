import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const configured = (name: string) => Boolean(process.env[name]?.trim());

export async function GET() {
  const started = Date.now();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  const { data: membership, error } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
  const checks = {
    database: Boolean(membership?.organization_id) && !error,
    shopify: configured("SHOPIFY_CLIENT_ID") && configured("SHOPIFY_CLIENT_SECRET"),
    generativeAi: configured("OPENAI_API_KEY"),
    video: configured("RUNWAYML_API_SECRET"),
    tokenEncryption: configured("SOCIAL_TOKEN_ENCRYPTION_KEY"),
    publishingWorker: configured("CRON_SECRET"),
    legalPages: true,
  };
  const required = [checks.database, checks.shopify, checks.generativeAi, checks.video, checks.tokenEncryption];
  return NextResponse.json({
    status: required.every(Boolean) ? "healthy" : "attention",
    checks,
    latencyMs: Date.now() - started,
    checkedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
