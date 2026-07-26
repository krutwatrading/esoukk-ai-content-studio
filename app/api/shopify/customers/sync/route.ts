import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { importShopifyContacts } from "@/lib/shopify-contacts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    const { data: membership, error: membershipError } = await supabase.from("organization_members")
      .select("organization_id,role").eq("user_id", user.id).limit(1).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Owner or admin access is required." }, { status: 403 });
    }
    const imported = await importShopifyContacts(membership.organization_id);
    return NextResponse.json({
      ok: true,
      imported,
      message: `${imported} Shopify customer contact${imported === 1 ? "" : "s"} synchronized.`,
    });
  } catch (error) {
    console.error("Shopify customer synchronization failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Customer import failed." },
      { status: 500 }
    );
  }
}
