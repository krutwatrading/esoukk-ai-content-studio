import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          configured: true,
          database: false,
          message:
            error.code === "42P01"
              ? "Supabase is connected, but the Phase 1 migration has not been applied."
              : "Supabase is configured, but the database check failed.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      configured: true,
      database: true,
      message: "Supabase connection and Phase 1 schema are healthy.",
    });
  } catch {
    return NextResponse.json(
      {
        configured: false,
        database: false,
        message: "Supabase environment variables are missing or invalid.",
      },
      { status: 503 },
    );
  }
}
