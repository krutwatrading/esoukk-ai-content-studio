import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is required." }, { status: 503 });
  try {
    const body = await request.json();
    const product = body.product || {}, campaign = body.campaign || {};
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-5-mini",
      input: `Create exactly four distinct, high-converting short-form video voiceover scripts for this ecommerce product. Each should take roughly 15-25 seconds to narrate and use only supplied facts. Do not invent materials, benefits, discounts, delivery, scarcity, popularity or performance claims. Make each script natural when spoken, not a shot list. Give the four approaches these names: Product Reveal, Problem to Desire, Lifestyle Story, Direct Response. The final sentence must use the supplied CTA naturally. Return valid JSON only as {"scripts":[{"name":"...","hook":"...","script":"..."}]}.

Product: ${JSON.stringify({ title: product.title, description: product.description, price: product.price, currency: product.currency, url: product.url })}
Campaign: ${JSON.stringify({ headline: campaign.headline, subheadline: campaign.subheadline, angle: campaign.campaignAngle, cta: campaign.cta, offer: campaign.offer })}`,
    });
    const parsed = JSON.parse(response.output_text.replace(/^```json\s*|\s*```$/g, ""));
    const scripts = Array.isArray(parsed.scripts) ? parsed.scripts.slice(0, 4).filter((item:unknown) => item && typeof item === "object" && "script" in item) : [];
    if (scripts.length < 3) throw new Error("The script generator returned too few options.");
    return NextResponse.json({ scripts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video script generation failed." }, { status: 400 });
  }
}
