import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { data: membership } = await supabase.from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return NextResponse.json({ error: "Audit history is available to owners and admins." }, { status: 403 });
  const { data, error } = await supabase.from("audit_logs").select("id,actor_id,action,object_type,object_id,metadata,created_at").eq("organization_id", membership.organization_id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ logs: data || [] });
}
