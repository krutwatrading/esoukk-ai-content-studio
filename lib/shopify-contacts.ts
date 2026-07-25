import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { shopifyGraphQL } from "@/lib/shopify-admin";

export const WHATSAPP_OPT_IN_TAG = "esoukk-whatsapp-opt-in";

export type ShopifyContact = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  tags: string[];
  state: string;
  updatedAt: string;
  email: string | null;
  phone: string | null;
  emailMarketingState: string | null;
  smsMarketingState: string | null;
};

type CustomerNode = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  tags: string[];
  state: string;
  updatedAt: string;
  email: string | null;
  phone: string | null;
  emailMarketingConsent: { marketingState: string; consentUpdatedAt: string | null } | null;
  smsMarketingConsent: { marketingState: string; consentUpdatedAt: string | null } | null;
};

type CustomerPageData = {
  customers: {
    nodes: CustomerNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export function normalisePhone(value: string | null | undefined) {
  if (!value) return null;
  const phone = value.trim().replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function contactFromWebhook(customer: Record<string, any>): ShopifyContact {
  const tags = Array.isArray(customer.tags)
    ? customer.tags
    : String(customer.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  return {
    id: String(customer.admin_graphql_api_id || `gid://shopify/Customer/${customer.id}`),
    displayName: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email || customer.phone || "Shopify customer",
    firstName: customer.first_name || null,
    lastName: customer.last_name || null,
    tags,
    state: String(customer.state || ""),
    updatedAt: customer.updated_at || new Date().toISOString(),
    email: customer.email || null,
    phone: customer.phone || customer.default_address?.phone || null,
    emailMarketingState: customer.email_marketing_consent?.state || (customer.accepts_marketing ? "SUBSCRIBED" : "NOT_SUBSCRIBED"),
    smsMarketingState: customer.sms_marketing_consent?.state || null,
  };
}

export async function upsertShopifyContact(organizationId: string, contact: ShopifyContact) {
  const supabase = createSupabaseAdminClient();
  const phone = normalisePhone(contact.phone);
  const email = contact.email?.trim().toLowerCase() || null;
  const optedIn = contact.tags.some((tag) => tag.toLowerCase() === WHATSAPP_OPT_IN_TAG);
  const now = new Date().toISOString();

  if (!phone && !email) return false;

  let existing: {
    id: string;
    opt_in_source: string | null;
  } | null = null;

  const byShopifyId = await supabase
    .from("whatsapp_contacts")
    .select("id,opt_in_source")
    .eq("organization_id", organizationId)
    .eq("shopify_customer_id", contact.id)
    .maybeSingle();
  if (byShopifyId.error) throw byShopifyId.error;
  existing = byShopifyId.data;

  if (!existing && phone) {
    const byPhone = await supabase
      .from("whatsapp_contacts")
      .select("id,opt_in_source")
      .eq("organization_id", organizationId)
      .eq("phone_e164", phone)
      .maybeSingle();
    if (byPhone.error) throw byPhone.error;
    existing = byPhone.data;
  }

  const storefrontManaged =
    existing?.opt_in_source === "shopify_storefront_checkbox";
  const record = {
    organization_id: organizationId,
    shopify_customer_id: contact.id,
    display_name: contact.displayName || null,
    first_name: contact.firstName,
    last_name: contact.lastName,
    email,
    phone_e164: phone,
    customer_state: contact.state || null,
    email_marketing_state: contact.emailMarketingState,
    sms_marketing_state: contact.smsMarketingState,
    shopify_tags: contact.tags,
    shopify_updated_at: contact.updatedAt,
    synced_at: now,
    updated_at: now,
    ...(optedIn ? {
      marketing_opt_in: true,
      opt_in_source: "shopify_storefront_checkbox",
      opted_in_at: contact.updatedAt || now,
      opted_out_at: null,
    } : storefrontManaged ? {
      marketing_opt_in: false,
      opted_out_at: now,
    } : {}),
  };

  const { error } = existing
    ? await supabase.from("whatsapp_contacts").update(record).eq("id", existing.id)
    : await supabase.from("whatsapp_contacts").insert(record);
  if (error) throw error;
  return true;
}

export async function importShopifyContacts(organizationId: string) {
  let after: string | null = null;
  let imported = 0;
  do {
    const data: CustomerPageData = await shopifyGraphQL<CustomerPageData>(`#graphql
      query CustomersForContactSync($first: Int!, $after: String) {
        customers(first: $first, after: $after, sortKey: UPDATED_AT) {
          nodes {
            id displayName firstName lastName email phone tags state updatedAt
            emailMarketingConsent { marketingState consentUpdatedAt }
            smsMarketingConsent { marketingState consentUpdatedAt }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { first: 100, after });
    for (const customer of data.customers.nodes) {
      const saved = await upsertShopifyContact(organizationId, {
        id: customer.id,
        displayName: customer.displayName,
        firstName: customer.firstName,
        lastName: customer.lastName,
        tags: customer.tags || [],
        state: customer.state,
        updatedAt: customer.updatedAt,
        email: customer.email,
        phone: customer.phone,
        emailMarketingState: customer.emailMarketingConsent?.marketingState || null,
        smsMarketingState: customer.smsMarketingConsent?.marketingState || null,
      });
      if (saved) imported++;
    }
    after = data.customers.pageInfo.hasNextPage ? data.customers.pageInfo.endCursor : null;
  } while (after);
  return imported;
}

export async function addShopifyWhatsAppOptInTag(customerId: string) {
  const result = await shopifyGraphQL<{
    tagsAdd: { userErrors: Array<{ field: string[] | null; message: string }> };
  }>(`#graphql
    mutation AddWhatsAppOptInTag($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors { field message }
      }
    }
  `, { id: customerId, tags: [WHATSAPP_OPT_IN_TAG] });
  if (result.tagsAdd.userErrors.length) {
    throw new Error(result.tagsAdd.userErrors.map((error) => error.message).join("; "));
  }
}
