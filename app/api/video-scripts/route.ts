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
      input: `Act as a senior direct-response creative strategist for Instagram Reels and TikTok commerce ads. Create exactly four distinct, high-converting voiceover scripts for a 25-second vertical product video. Infer the most relevant non-sensitive customer context from the verified product category, description and campaign positioning. Each script must use this conversion sequence: an immediate spoken hook, a relatable desire or friction, the product as the credible answer, two or three verified product/value details, and one clear CTA. Use short, energetic, natural spoken sentences with pattern interrupts; aim for 55-70 words so narration fits 25 seconds. Use price or a verified offer when supplied and commercially useful. Do not invent materials, benefits, discounts, delivery, scarcity, popularity, testimonials or performance claims. Do not describe camera shots. Give the four approaches these exact names: Product Reveal, Problem to Desire, Lifestyle Story, Direct Response. Make every approach materially different and make Direct Response the strongest performance-ad option. The final sentence must use the supplied CTA naturally. Return valid JSON only as {"scripts":[{"name":"...","hook":"...","script":"..."}]}.

Product: ${JSON.stringify({ title: product.title, vendor: product.vendor, productType: product.productType, description: product.description, price: product.price, compareAtPrice: product.compareAtPrice, currency: product.currency, availableVariants: Array.isArray(product.variants) ? product.variants.filter((variant:{available?:boolean})=>variant.available).map((variant:{title?:string})=>variant.title).slice(0,8) : [], url: product.url })}
Campaign: ${JSON.stringify({ headline: campaign.headline, subheadline: campaign.subheadline, angle: campaign.campaignAngle, cta: campaign.cta, offer: campaign.offer, reelHook: campaign.reelHook })}`,
    });
    const parsed = JSON.parse(response.output_text.replace(/^```json\s*|\s*```$/g, ""));
    const scripts = Array.isArray(parsed.scripts) ? parsed.scripts.slice(0, 4).filter((item:unknown) => item && typeof item === "object" && "script" in item) : [];
    if (scripts.length < 3) throw new Error("The script generator returned too few options.");
    return NextResponse.json({ scripts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video script generation failed." }, { status: 400 });
  }
}
