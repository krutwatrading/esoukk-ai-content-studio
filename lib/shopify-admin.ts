import "server-only";
import type { ProductData } from "./types";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function shopDomain(): string {
  const shop = required("SHOPIFY_SHOP")
    .replace(/^https?:\/\//, "")
    .replace(/\.myshopify\.com.*$/i, "")
    .replace(/\/.*$/, "");
  return `${shop}.myshopify.com`;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const response = await fetch(`https://${shopDomain()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: required("SHOPIFY_CLIENT_ID"),
      client_secret: required("SHOPIFY_CLIENT_SECRET")
    }),
    cache: "no-store"
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || `Shopify authentication failed (${response.status}).`);
  }

  const expiresIn = Number(payload.expires_in || 86400);
  tokenCache = {
    token: String(payload.access_token),
    expiresAt: now + Math.max(300, expiresIn) * 1000
  };
  return tokenCache.token;
}

export async function shopifyGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(
    `https://${shopDomain()}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Shopify-Access-Token": token
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store"
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Shopify API request failed (${response.status}).`);
  }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e: { message?: string }) => e.message).filter(Boolean).join("; "));
  }
  return payload.data as T;
}

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  description: string;
  descriptionHtml: string;
  onlineStoreUrl: string | null;
  featuredImage: { url: string; altText: string | null } | null;
  images: { nodes: Array<{ url: string; altText: string | null }> };
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  variants: {
    nodes: Array<{
      id: string;
      title: string;
      sku: string | null;
      availableForSale: boolean;
      price: string;
      compareAtPrice: string | null;
      inventoryQuantity: number | null;
    }>;
  };
};

function toProductData(node: ProductNode): ProductData & {
  adminId: string;
  status: string;
  sku: string;
  inventoryQuantity: number | null;
} {
  const min = node.priceRangeV2.minVariantPrice;
  const images = node.images.nodes.map(i => i.url);
  const firstVariant = node.variants.nodes[0];
  return {
    adminId: node.id,
    status: node.status,
    sku: firstVariant?.sku || "",
    inventoryQuantity: firstVariant?.inventoryQuantity ?? null,
    title: node.title,
    handle: node.handle,
    url: node.onlineStoreUrl || `https://esoukk.ae/products/${node.handle}`,
    vendor: node.vendor,
    productType: node.productType,
    description: node.description || "",
    price: Number(min.amount || 0),
    compareAtPrice: firstVariant?.compareAtPrice ? Number(firstVariant.compareAtPrice) : null,
    currency: min.currencyCode || "AED",
    images: images.length ? images : node.featuredImage?.url ? [node.featuredImage.url] : [],
    variants: node.variants.nodes.map(v => ({
      id: v.id,
      title: v.title,
      price: Number(v.price || 0),
      available: v.availableForSale
    }))
  };
}

export async function listShopifyProducts(args?: {
  query?: string;
  first?: number;
  after?: string | null;
}) {
  const first = Math.min(Math.max(args?.first || 24, 1), 100);
  const data = await shopifyGraphQL<{
    products: {
      nodes: ProductNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(
    `#graphql
    query Products($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
        nodes {
          id title handle status vendor productType description descriptionHtml onlineStoreUrl
          featuredImage { url altText }
          images(first: 12) { nodes { url altText } }
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          variants(first: 50) {
            nodes {
              id title sku availableForSale price compareAtPrice inventoryQuantity
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {
      first,
      after: args?.after || null,
      query: args?.query?.trim() || null
    }
  );

  return {
    products: data.products.nodes.map(toProductData),
    pageInfo: data.products.pageInfo
  };
}

export async function getShopifyConnectionStatus() {
  const data = await shopifyGraphQL<{
    shop: { name: string; myshopifyDomain: string; primaryDomain: { url: string } };
  }>(`#graphql
    query ConnectionStatus {
      shop { name myshopifyDomain primaryDomain { url } }
    }
  `);
  return data.shop;
}
