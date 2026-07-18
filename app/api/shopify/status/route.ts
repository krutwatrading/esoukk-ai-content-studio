import { NextResponse } from "next/server";
import { getShopifyConnectionStatus } from "@/lib/shopify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const shop = await getShopifyConnectionStatus();
    return NextResponse.json({ connected: true, shop });
  } catch (error) {
    return NextResponse.json(
      { connected: false, error: error instanceof Error ? error.message : "Connection failed." },
      { status: 500 }
    );
  }
}
