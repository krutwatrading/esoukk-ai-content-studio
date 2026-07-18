import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function context() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
  return membership ? { supabase, organizationId: membership.organization_id } : null;
}

export async function PUT(request: NextRequest) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const row = {
    organization_id: ctx.organizationId,
    store_name: String(body.storeName || "eSoukk").trim(),
    website_url: String(body.websiteUrl || "").trim() || null,
    voice: body.voice || [], audiences: body.audiences || [],
    approved_ctas: body.approvedCtas || [], prohibited_claims: body.prohibitedClaims || [],
  };
  const { data, error } = await ctx.supabase.from("brand_profiles").upsert(row, { onConflict: "organization_id" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ profile: data });
}
