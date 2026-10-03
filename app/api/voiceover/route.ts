import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;
const voices = new Set(["coral", "marin", "cedar", "alloy", "sage", "shimmer"]);

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is required to generate narration." }, { status: 503 });
  try {
    const body = await request.json(), input = String(body.input || "").trim();
    const voice = voices.has(String(body.voice)) ? String(body.voice) : "coral";
    if (!input) return NextResponse.json({ error: "Add a voiceover script first." }, { status: 400 });
    if (input.length > 1600) return NextResponse.json({ error: "Voiceover script must be 1,600 characters or fewer." }, { status: 400 });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await openai.audio.speech.create({ model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice, input, instructions: "Warm, confident premium ecommerce narration. Natural pace, clear pronunciation, approachable tone, no exaggerated sales delivery.", response_format: "mp3" });
    const audio = Buffer.from(await speech.arrayBuffer());
    return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(audio.length), "Cache-Control": "private, no-store", "X-AI-Generated-Voice": "true" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voiceover generation failed." }, { status: 400 });
  }
}
