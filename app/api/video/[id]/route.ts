import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const RUNWAY_API = "https://api.dev.runwayml.com/v1";
type RunwayTask = { id?: string; status?: string; progress?: number; failure?: string; failureCode?: string };

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const secret = process.env.RUNWAYML_API_SECRET;
  if (!secret) return NextResponse.json({ error: "RUNWAYML_API_SECRET is required." }, { status: 503 });
  const { id } = await params;
  if (!/^[0-9a-f-]{20,}$/i.test(id)) return NextResponse.json({ error: "Invalid Runway video task." }, { status: 400 });
  const response = await fetch(`${RUNWAY_API}/tasks/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${secret}`, "X-Runway-Version": "2024-11-06" }, cache: "no-store" });
  const raw = await response.text();
  let data: RunwayTask = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ error: `Runway returned unreadable task data (HTTP ${response.status}).` }, { status: 502 }); }
  if (!response.ok) return NextResponse.json({ error: data.failure || `Runway task lookup failed (HTTP ${response.status}).` }, { status: response.status >= 500 ? 502 : response.status });
  const state = String(data.status || "PENDING").toUpperCase();
  const status = state === "SUCCEEDED" ? "completed" : state === "FAILED" || state === "CANCELED" ? "failed" : state === "RUNNING" || state === "THROTTLED" ? "processing" : "queued";
  return NextResponse.json({ id: data.id || id, status, progress: status === "completed" ? 100 : Number(data.progress || 0), error: status === "failed" ? data.failure || data.failureCode || `Runway task ${state.toLowerCase()}.` : null });
}
