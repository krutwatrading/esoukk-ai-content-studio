import { NextRequest, NextResponse } from "next/server";
import { listShopifyProducts } from "@/lib/shopify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await listShopifyProducts({
      query: searchParams.get("q") || "",
      first: Number(searchParams.get("first") || 24),
      after: searchParams.get("after")
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Shopify products." },
      { status: 500 }
    );
  }
}
