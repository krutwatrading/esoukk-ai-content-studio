import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addShopifyWhatsAppOptInTag, normalisePhone, upsertShopifyContact } from "@/lib/shopify-contacts";

export const runtime = "nodejs";

function validProxySignature(url: URL) {
  const signature = url.searchParams.get("signature");
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!signature || !secret) return false;
  const message = [...url.searchParams.entries()]
    .filter(([key]) => key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("");
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  if (!validProxySignature(url)) {
    return NextResponse.json({ error: "Invalid Shopify app proxy signature." }, { status: 401 });
  }
  const form = await request.formData();
  if (form.get("whatsapp_marketing_opt_in") !== "yes") {
    return NextResponse.json({ error: "WhatsApp marketing consent was not selected." }, { status: 400 });
  }
  const phone = normalisePhone(String(form.get("phone") || ""));
  const email = String(form.get("email") || "").trim().toLowerCase() || null;
  if (!phone) return NextResponse.json({ error: "A valid international mobile number is required." }, { status: 400 });
  const customerIdRaw = String(form.get("customer_id") || "").trim();
  const customerId = customerIdRaw
    ? (customerIdRaw.startsWith("gid://") ? customerIdRaw : `gid://shopify/Customer/${customerIdRaw}`)
    : null;
  const name = String(form.get("display_name") || "").trim();
  try {
    if (customerId) await addShopifyWhatsAppOptInTag(customerId);
    const supabase = createSupabaseAdminClient();
    const { data: organization } = await supabase.from("organizations").select("id").order("created_at").limit(1).single();
    if (!organization) throw new Error("No eSoukk organization is configured.");
    if (customerId) {
      await upsertShopifyContact(organization.id, {
        id: customerId, displayName: name || email || phone, firstName: null, lastName: null, defaultAddress: null,
        tags: ["esoukk-whatsapp-opt-in"], state: "ENABLED", updatedAt: new Date().toISOString(),
        email, phone, emailMarketingState: null, smsMarketingState: null,
        defaultAddress: null,
      });
    } else {
      const now = new Date().toISOString();
      const { error } = await supabase.from("whatsapp_contacts").upsert({
        organization_id: organization.id, phone_e164: phone, email,
        display_name: name || null, marketing_opt_in: true,
        opt_in_source: "shopify_storefront_checkbox", opted_in_at: now,
        opted_out_at: null, synced_at: now, updated_at: now,
      }, { onConflict: "organization_id,phone_e164" });
      if (error) throw error;
    }
    const requestedReturnTo = String(form.get("return_to") || "/");
    const returnTo = requestedReturnTo.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : "/";
    const destination = new URL(returnTo, `https://${url.searchParams.get("shop") || "esoukk.ae"}`);
    destination.searchParams.set("whatsapp_opt_in", "success");
    return NextResponse.redirect(destination, 303);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record consent." }, { status: 400 });
  }
}
