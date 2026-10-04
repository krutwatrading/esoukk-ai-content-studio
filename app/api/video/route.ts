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
    const data = JSON.parse(raw) as { error?: unknown; message?: string; errors?: unknown };
    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error === "object" && "message" in data.error && typeof data.error.message === "string") return data.error.message;
    if (data.errors) return `${data.message || "Runway validation failed"}: ${JSON.stringify(data.errors)}`;
    return data.message || `Runway returned HTTP ${status}.`;
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
    const quality = body.quality === "720p" ? "720p" : "480p";
    if (!script || !imageUrl) return NextResponse.json({ error: "A selected script and product image are required." }, { status: 400 });
    if (!/^https?:\/\//i.test(imageUrl) && !/^data:image\/(?:png|jpeg|webp);base64,/i.test(imageUrl)) return NextResponse.json({ error: "The selected reference image must be a public image URL or PNG, JPEG, or WebP upload." }, { status: 400 });

    const price = Number(product.price) > 0 ? `${String(product.currency || "AED")} ${Number(product.price).toFixed(2)}` : "";
    const compareAt = Number(product.compareAtPrice) > Number(product.price) ? `${String(product.currency || "AED")} ${Number(product.compareAtPrice).toFixed(2)}` : "";
    const availableVariants = Array.isArray(product.variants) ? product.variants.filter((variant: { available?: boolean }) => variant.available).map((variant: { title?: string }) => variant.title).filter(Boolean).slice(0, 8) : [];
    const promptText = [
      "25-second vertical 9:16 direct-response product ad for Instagram Reels and TikTok with synchronized native audio.",
      `Use this spoken narration naturally within 25 seconds: ${script.slice(0, 500)}.`,
      `End with the spoken CTA: ${String(campaign.cta || "Shop now")}.`,
      "Pacing: 0-3s scroll-stopping product hook; 3-8s aspirational use context; 8-15s dynamic verified-detail close-ups; 15-21s believable lifestyle desire; 21-25s clean hero reveal and CTA.",
      "Preserve the reference product's exact shape, colour, construction, proportions and branding. Premium energetic camera motion, realistic interaction, clean match cuts, mobile-first framing.",
      "No slideshow, static poster, text cards, generic montage, invented claims, testimonials, discounts, scarcity, medical or performance claims.",
      `Product: ${String(product.title || "featured product")}; category: ${String(product.productType || "")}; price: ${price || "not stated"}; details: ${String(product.description || "").slice(0, 240)}.`,
      compareAt ? `Verified compare-at price: ${compareAt}.` : "",
      availableVariants.length ? `Options: ${availableVariants.join(", ")}.` : "",
    ].filter(Boolean).join(" ").slice(0, 1000);

    const response = await fetch(`${RUNWAY_API}/image_to_video`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "X-Runway-Version": RUNWAY_VERSION },
      body: JSON.stringify({ model: "wan3", promptImage: [{ uri: imageUrl }], promptText, ratio: quality === "720p" ? "720:1280" : "480:832", duration: 25, audio: true }),
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
