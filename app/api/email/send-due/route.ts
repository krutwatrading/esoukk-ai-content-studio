import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emailBrandConfig, parseEmailBrand } from "@/lib/email-brands";
import { createUnsubscribeToken } from "@/lib/email-unsubscribe";

export const runtime = "nodejs";
const hash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
const chunks = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

async function run(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Worker authorization failed." }, { status: 401 });
  if (process.env.EMAIL_BULK_SEND_ENABLED !== "true") return NextResponse.json({ error: "Bulk email delivery is locked. Scheduling is available, but customer sending is disabled." }, { status: 423 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY is missing." }, { status: 503 });
  if (!process.env.EMAIL_UNSUBSCRIBE_SECRET) return NextResponse.json({ error: "EMAIL_UNSUBSCRIBE_SECRET is required before customer delivery." }, { status: 503 });
  const audienceMode=process.env.EMAIL_LIVE_AUDIENCE_MODE==="full"?"full":"test",testRecipients=new Set((process.env.EMAIL_LIVE_TEST_RECIPIENTS||"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean)),recipientLimit=Math.max(1,Math.min(20,Number(process.env.EMAIL_LIVE_RECIPIENT_LIMIT)||5)),requestedCampaignId=request.nextUrl.searchParams.get("campaignId");
  if(audienceMode==="test"&&!testRecipients.size)return NextResponse.json({error:"Test mode requires EMAIL_LIVE_TEST_RECIPIENTS before delivery."},{status:423});
  if(audienceMode==="test"&&!requestedCampaignId)return NextResponse.json({error:"Test mode requires an explicitly selected campaign."},{status:423});
  const publicOrigin=(process.env.NEXT_PUBLIC_APP_URL||request.nextUrl.origin).replace(/\/$/,"");
  const admin = createSupabaseAdminClient(), now = new Date().toISOString();
  let campaignQuery = admin.from("campaigns").select("id,organization_id,settings,scheduled_for,publish_attempts").eq("status", "scheduled").lte("scheduled_for", now).order("scheduled_for").limit(3);
  if (requestedCampaignId) campaignQuery = campaignQuery.eq("id", requestedCampaignId).limit(1);
  const { data: campaigns, error: campaignError } = await campaignQuery;
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
  const results: Array<{ campaignId: string; status: string; eligible?: number; sent?: number; error?: string }> = [];
  for (const campaign of campaigns || []) {
    const claimed = await admin.from("campaigns").update({ status: "publishing", publish_attempts: (campaign.publish_attempts || 0) + 1, publishing_error: null }).eq("id", campaign.id).eq("status", "scheduled").select("id").maybeSingle();
    if (!claimed.data) continue;
    try {
      const { data: approval } = await admin.from("approvals").select("variation_id").eq("campaign_id", campaign.id).eq("decision", "approved").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!approval) throw new Error("Recorded approval is missing.");
      const { data: variation } = await admin.from("campaign_variations").select("content").eq("id", approval.variation_id).eq("platform", "email").single();
      const content = variation?.content as Record<string, unknown> | null;
      if (!content) throw new Error("Approved email content is missing.");
      const brand = parseEmailBrand(content.brand), config = emailBrandConfig(brand);
      if (!config.sender) throw new Error(`${config.label} sender is not configured.`);
      const [{ data: contacts, error: contactError }, { data: suppressions, error: suppressionError }, { data: existing, error: ledgerError }] = await Promise.all([
        admin.from("whatsapp_contacts").select("email").eq("organization_id", campaign.organization_id).eq("email_marketing_state", "SUBSCRIBED").not("email", "is", null),
        admin.from("email_suppressions").select("email_hash").eq("organization_id", campaign.organization_id),
        admin.from("email_campaign_recipients").select("email_hash,status").eq("campaign_id", campaign.id),
      ]);
      if (contactError || suppressionError || ledgerError) throw new Error(contactError?.message || suppressionError?.message || ledgerError?.message || "Audience check failed.");
      const blocked = new Set((suppressions || []).map((item) => item.email_hash)), completed = new Set((existing || []).filter((item) => ["sending", "sent", "suppressed"].includes(item.status)).map((item) => item.email_hash));
      // Controlled test recipients are an explicit operator allowlist. They do not
      // need to be part of the live Shopify audience, but they still pass through
      // suppression, duplicate-prevention, recipient-limit and unsubscribe guards.
      // Full delivery continues to use only Shopify-subscribed contacts.
      const uniqueEmails = audienceMode === "test"
        ? [...testRecipients]
        : [...new Set((contacts || []).map((item) => String(item.email || "").trim().toLowerCase()).filter(Boolean))];
      const eligibleRecipients = uniqueEmails.map((email) => ({ email, emailHash: hash(email) })).filter((item) => !blocked.has(item.emailHash) && !completed.has(item.emailHash));
      const recipients=audienceMode==="test"?eligibleRecipients.slice(0,recipientLimit):eligibleRecipients;
      if (!recipients.length) throw new Error("No unsent, consented recipients are currently eligible.");
      const subject = String(content.subject || "").slice(0, 150), body = String(content.body || "").slice(0, 5000), ctaLabel = String(content.ctaLabel || "Shop now").slice(0, 50), ctaUrl = String(content.ctaUrl || ""), preview = String(content.preview || "").slice(0, 220);
      let sent = 0;
      for (const batch of chunks(recipients, 100)) {
        const { error: claimError } = await admin.from("email_campaign_recipients").upsert(batch.map((item) => ({ organization_id: campaign.organization_id, campaign_id: campaign.id, email_hash: item.emailHash, status: "sending", attempts: 1 })), { onConflict: "campaign_id,email_hash" });
        if (claimError) throw new Error(`Recipient safety ledger failed: ${claimError.message}`);
        const payload = batch.map((item) => {const token=createUnsubscribeToken(campaign.organization_id,item.emailHash),unsubscribeUrl=`${publicOrigin}/api/email/unsubscribe?token=${encodeURIComponent(token)}`,html=`<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div><div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#181818"><p style="letter-spacing:.12em;color:#9b772e;font-weight:700">${escapeHtml(config.label)}</p><div style="font-size:16px;line-height:1.65">${escapeHtml(body).replace(/\r?\n/g,"<br/>")}</div><p style="margin:28px 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${config.accent};color:#fff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700">${escapeHtml(ctaLabel)}</a></p><p style="margin-top:36px;color:#777;font-size:12px">You received this because you subscribed to marketing emails. <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>.</p></div>`;return { from: config.sender, to: [item.email], subject, text: `${body}\n\n${ctaLabel}: ${ctaUrl}\n\nUnsubscribe: ${unsubscribeUrl}`, html, reply_to: config.replyTo || undefined, headers:{"List-Unsubscribe":`<${unsubscribeUrl}>`,"List-Unsubscribe-Post":"List-Unsubscribe=One-Click"},tags: [{ name: "organization_id", value: campaign.organization_id }, { name: "campaign_id", value: campaign.id }, { name: "brand", value: brand }] }});
        const batchHash = createHash("sha256").update(batch.map((item) => item.emailHash).join(":")).digest("hex").slice(0, 24);
        let response: Response;
        try { response = await fetch("https://api.resend.com/emails/batch", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `email-campaign/${campaign.id}/${batchHash}` }, body: JSON.stringify(payload) }); }
        catch { throw new Error("Resend batch outcome is uncertain; recipients remain locked against automatic retry."); }
        const responseBody = await response.json().catch(() => ({})) as { data?: Array<{ id?: string }>; message?: string };
        if (!response.ok) {
          await admin.from("email_campaign_recipients").update({ status: "failed", last_error: responseBody.message || `Resend HTTP ${response.status}` }).eq("campaign_id", campaign.id).in("email_hash", batch.map((item) => item.emailHash));
          throw new Error(responseBody.message || `Resend batch returned HTTP ${response.status}.`);
        }
        for (let index = 0; index < batch.length; index++) await admin.from("email_campaign_recipients").update({ status: "sent", provider_email_id: responseBody.data?.[index]?.id || null, last_error: null }).eq("campaign_id", campaign.id).eq("email_hash", batch[index].emailHash);
        sent += batch.length;
      }
      await admin.from("campaigns").update({ status: "published", published_at: new Date().toISOString(), publishing_error: null }).eq("id", campaign.id);
      await admin.from("audit_logs").insert({ organization_id: campaign.organization_id, actor_id: null, action: "email_campaign.sent", object_type: "campaign", object_id: campaign.id, metadata: { eligible: recipients.length, sent, brand, audience_mode:audienceMode,recipient_limit:audienceMode==="test"?recipientLimit:null } });
      results.push({ campaignId: campaign.id, status: "published", eligible: recipients.length, sent });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Email campaign delivery failed.";
      await admin.from("campaigns").update({ status: "partially_failed", publishing_error: message }).eq("id", campaign.id);
      results.push({ campaignId: campaign.id, status: "failed", error: message });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}

export async function GET(request: NextRequest) { return run(request); }
export async function POST(request: NextRequest) { return run(request); }
