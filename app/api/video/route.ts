import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;
const RUNWAY_API = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";

async function authorized() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function runwayError(raw: string, status: number) {
  if (!raw) return `Runway returned HTTP ${status} with an empty response.`;
  try {
    const data = JSON.parse(raw) as { error?: string | { message?: string }; message?: string };
    return typeof data.error === "string" ? data.error : data.error?.message || data.message || `Runway returned HTTP ${status}.`;
  } catch {
    return `Runway returned unreadable data (HTTP ${status}).`;
  }
}

export async function POST(request: NextRequest) {
  if (!await authorized()) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const secret = process.env.RUNWAYML_API_SECRET;
  if (!secret) return NextResponse.json({ error: "RUNWAYML_API_SECRET is required for Runway video generation." }, { status: 503 });
  try {
    const body = await request.json();
    const product = body.product || {};
    const campaign = body.campaign || {};
    const script = String(body.script || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    if (!script || !imageUrl) return NextResponse.json({ error: "A selected script and product image are required." }, { status: 400 });
    if (!/^https?:\/\//i.test(imageUrl) && !/^data:image\/(?:png|jpeg|webp);base64,/i.test(imageUrl)) return NextResponse.json({ error: "The selected reference image must be a public image URL or PNG, JPEG, or WebP upload." }, { status: 400 });

    const price = Number(product.price) > 0 ? `${String(product.currency || "AED")} ${Number(product.price).toFixed(2)}` : "";
    const compareAt = Number(product.compareAtPrice) > Number(product.price) ? `${String(product.currency || "AED")} ${Number(product.compareAtPrice).toFixed(2)}` : "";
    const availableVariants = Array.isArray(product.variants) ? product.variants.filter((variant: { available?: boolean }) => variant.available).map((variant: { title?: string }) => variant.title).filter(Boolean).slice(0, 8) : [];
    const promptText = [
      "Create a 25-second vertical 9:16 direct-response ecommerce video ad for Instagram Reels and TikTok, with polished native audio and persuasive spoken narration.",
      "The viewer should understand the product and feel motivated to visit the product page, while every claim must stay strictly within the supplied facts.",
      "Use the reference image as the exact product hero. Preserve its visible shape, colour, materials, construction, proportions, and branding. Do not substitute or redesign the product.",
      "EDIT AND PACING: 0-3 seconds: immediate scroll-stopping visual hook with the product clearly visible. 3-8 seconds: reveal the product in an aspirational, category-appropriate use context. 8-15 seconds: dynamic close-ups that demonstrate only visible or supplied product details. 15-21 seconds: build desire with a believable lifestyle payoff for the likely customer. 21-25 seconds: confident hero shot and spoken call to action.",
      "Use energetic but premium camera movement, pattern interrupts every 2-4 seconds, clean match cuts, realistic human interaction where appropriate, and mobile-first framing. Avoid slow empty shots.",
      "Do not make a slideshow, poster, product-page screenshot, static text card, or generic montage. Do not invent performance, material, medical, scarcity, delivery, discount, testimonial, or popularity claims. Avoid generated on-screen typography; communicate the offer through narration and visuals.",
      `PRODUCT NAME: ${String(product.title || "featured product")}.`,
      product.vendor ? `BRAND OR VENDOR: ${String(product.vendor)}.` : "",
      product.productType ? `CATEGORY: ${String(product.productType)}.` : "",
      product.description ? `VERIFIED PRODUCT DETAILS: ${String(product.description).slice(0, 750)}.` : "",
      price ? `CURRENT PRICE: ${price}.` : "",
      compareAt ? `VERIFIED COMPARE-AT PRICE: ${compareAt}.` : "",
      availableVariants.length ? `AVAILABLE OPTIONS: ${availableVariants.join(", ")}.` : "",
      `PRODUCT PAGE CONTEXT: ${String(product.url || "")}.`,
      `CAMPAIGN POSITIONING: ${String(campaign.campaignAngle || campaign.headline || campaign.subheadline || "").slice(0, 400)}.`,
      `EXACT NARRATION DIRECTION: ${script.slice(0, 1000)}.`,
      `FINAL SPOKEN CTA: ${String(campaign.cta || "Shop now")} at the product page.`,
    ].filter(Boolean).join(" ").slice(0, 3500);

    const response = await fetch(`${RUNWAY_API}/image_to_video`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "X-Runway-Version": RUNWAY_VERSION },
      body: JSON.stringify({ model: "seedance2_5", promptImage: imageUrl, promptText, ratio: "720:1280", duration: 25, audio: true }),
    });
    const raw = await response.text();
    if (!response.ok) return NextResponse.json({ error: runwayError(raw, response.status) }, { status: response.status >= 500 ? 502 : response.status });
    const data = JSON.parse(raw) as { id?: string };
    if (!data.id) return NextResponse.json({ error: "Runway accepted the request but did not return a task ID." }, { status: 502 });
    return NextResponse.json({ id: data.id, status: "queued", progress: 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Runway video generation failed." }, { status: 400 });
  }
}
