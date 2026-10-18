import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmailBrand } from "@/lib/email-brands";

export const runtime = "nodejs";

const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
const allowedHosts = () => new Set([
  "shopkavia.com", "www.shopkavia.com", "esoukk.ae", "www.esoukk.ae",
  ...(process.env.ALLOWED_SHOPIFY_DOMAINS || "").split(","),
].map((value) => value.trim().toLowerCase()).filter(Boolean));
const approvedUrl = (value: unknown) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && allowedHosts().has(url.hostname.toLowerCase()) ? url.toString() : "";
  } catch { return ""; }
};

export async function POST(request: Request) {
  const access = await enforceRateLimit("email-draft", 20, 3600);
  if (access.response) return access.response;
  const input = await request.json().catch(() => ({})) as Record<string, unknown>;
  const brand = parseEmailBrand(input.brand), subject = clean(input.subject, 150), preview = clean(input.preview, 220), body = clean(input.body, 5000), ctaLabel = clean(input.ctaLabel, 50) || "Shop now", ctaUrl = approvedUrl(input.ctaUrl), productTitle = clean(input.productTitle, 180);
  if (!subject || !body || !ctaUrl || !productTitle) return NextResponse.json({ error: "Generate a complete email campaign with an approved storefront CTA before saving it." }, { status: 400, headers: access.headers });

  const admin = createSupabaseAdminClient();
  const { data: membership } = await admin.from("organization_members").select("role").eq("organization_id", access.organizationId).eq("user_id", access.user.id).maybeSingle();
  if (!membership || !["owner", "admin", "creator"].includes(membership.role)) return NextResponse.json({ error: "Your workspace role cannot create campaign drafts." }, { status: 403, headers: access.headers });

  const { data: campaign, error: campaignError } = await admin.from("campaigns").insert({ organization_id: access.organizationId, name: `${productTitle} · ${brand === "kavia" ? "KAVIA" : "eSoukk"} email`, status: "ready_for_review", settings: { channel: "email", brand, ctaLabel, ctaUrl }, product_snapshot: { title: productTitle, url: ctaUrl }, prompt_version: "email-approval-v1", created_by: access.user.id }).select("id,status,created_at").single();
  if (campaignError || !campaign) return NextResponse.json({ error: campaignError?.message || "Unable to save the email campaign." }, { status: 500, headers: access.headers });

  const { data: variation, error: variationError } = await admin.from("campaign_variations").insert({ organization_id: access.organizationId, campaign_id: campaign.id, platform: "email", variation_number: 1, revision: 1, content: { brand, subject, preview, body, ctaLabel, ctaUrl, productTitle }, created_by: access.user.id }).select("id").single();
  if (variationError || !variation) {
    await admin.from("campaigns").delete().eq("id", campaign.id).eq("organization_id", access.organizationId);
    return NextResponse.json({ error: variationError?.message || "Unable to save the email variation." }, { status: 500, headers: access.headers });
  }
  await admin.from("audit_logs").insert({ organization_id: access.organizationId, actor_id: access.user.id, action: "email_campaign.submitted_for_review", object_type: "campaign", object_id: campaign.id, metadata: { brand, variation_id: variation.id } });
  return NextResponse.json({ campaignId: campaign.id, variationId: variation.id, status: campaign.status, createdAt: campaign.created_at }, { headers: access.headers });
}
