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
  if (!secret) return NextResponse.json({ error: "RUNWAYML_API_SECRET is required for Runway Gen-4.5 video generation." }, { status: 503 });
  try {
    const body = await request.json();
    const product = body.product || {};
    const campaign = body.campaign || {};
    const script = String(body.script || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    if (!script || !imageUrl) return NextResponse.json({ error: "A selected script and product image are required." }, { status: 400 });
    if (!/^https?:\/\//i.test(imageUrl) && !/^data:image\/(?:png|jpeg|webp);base64,/i.test(imageUrl)) return NextResponse.json({ error: "The selected reference image must be a public image URL or PNG, JPEG, or WebP upload." }, { status: 400 });

    const promptText = [
      "Vertical 9:16 premium social-commerce product video.",
      "Use the reference product as the exact hero and preserve its visible shape, colour, materials, construction, and branding.",
      "Create genuine natural motion with a deliberate camera move, realistic product interaction, dimensional lighting, and a polished commercial product reveal.",
      "Do not create a slideshow, poster, static text card, captions, or extra written claims.",
      `Product: ${String(product.title || "featured product")}.`,
      `Creative direction: ${String(campaign.campaignAngle || campaign.subheadline || script).slice(0, 650)}.`,
      `Narrative direction: ${script.slice(0, 650)}.`,
      `Finish with a clean visual reveal appropriate for: ${String(campaign.cta || "Shop now")}.`,
    ].join(" ").slice(0, 1000);

    const response = await fetch(`${RUNWAY_API}/image_to_video`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "X-Runway-Version": RUNWAY_VERSION },
      body: JSON.stringify({ model: process.env.RUNWAY_VIDEO_MODEL || "gen4.5", promptImage: imageUrl, promptText, ratio: "720:1280", duration: 5 }),
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
