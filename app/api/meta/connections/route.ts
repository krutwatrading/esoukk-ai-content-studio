import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supported = new Set(["instagram", "facebook", "tiktok", "whatsapp", "pinterest", "google", "snapchat"]);

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const provider = String(request.nextUrl.searchParams.get("provider") || "").toLowerCase();
  if (!supported.has(provider)) return NextResponse.json({ error: "Unsupported publishing channel." }, { status: 400 });
  const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return NextResponse.json({ error: "Owner or admin access is required." }, { status: 403 });
  const { data: connections, error: readError } = await supabase.from("social_connections").select("id,account_name,provider_account_id").eq("organization_id", membership.organization_id).eq("provider", provider);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });
  const { error } = await supabase.from("social_connections").delete().eq("organization_id", membership.organization_id).eq("provider", provider);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("audit_logs").insert({ organization_id: membership.organization_id, actor_id: user.id, action: "social_connection.disconnected", object_type: "social_connection", object_id: provider, metadata: { provider, accounts: (connections || []).map(item => ({ account_name: item.account_name, provider_account_id: item.provider_account_id })) } });
  return NextResponse.json({ disconnected: true, provider });
}
