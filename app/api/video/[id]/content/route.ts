import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;
const RUNWAY_API = "https://api.dev.runwayml.com/v1";
type RunwayTask = { status?: string; output?: string[]; failure?: string };

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const secret = process.env.RUNWAYML_API_SECRET;
  if (!secret) return NextResponse.json({ error: "RUNWAYML_API_SECRET is required." }, { status: 503 });
  const { id } = await params;
  if (!/^[0-9a-f-]{20,}$/i.test(id)) return NextResponse.json({ error: "Invalid Runway video task." }, { status: 400 });
  const taskResponse = await fetch(`${RUNWAY_API}/tasks/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${secret}`, "X-Runway-Version": "2024-11-06" }, cache: "no-store" });
  const task = await taskResponse.json().catch(() => ({})) as RunwayTask;
  if (!taskResponse.ok) return NextResponse.json({ error: task.failure || "Runway video lookup failed." }, { status: taskResponse.status >= 500 ? 502 : taskResponse.status });
  if (task.status !== "SUCCEEDED" || !task.output?.[0]) return NextResponse.json({ error: "The Runway video is not ready for download." }, { status: 409 });
  const videoResponse = await fetch(task.output[0], { cache: "no-store" });
  if (!videoResponse.ok || !videoResponse.body) return NextResponse.json({ error: "The generated Runway video could not be downloaded." }, { status: 502 });
  return new NextResponse(videoResponse.body, { headers: { "Content-Type": videoResponse.headers.get("content-type") || "video/mp4", "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="${id}.mp4"` } });
}
