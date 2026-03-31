import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * One-time migration: Add tuition_snapshot column to lesson_history
 * and backfill existing records with their lesson's current tuition_amount.
 *
 * POST /api/migrate  (admin-only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const supabaseAuth = await createServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing service role key" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 1: Add tuition_snapshot column (INTEGER, default 0) if not exists
    const { error: alterError } = await supabaseAdmin.rpc("exec_sql", {
      sql: `ALTER TABLE lesson_history ADD COLUMN IF NOT EXISTS tuition_snapshot INTEGER DEFAULT 0;`,
    });

    // If rpc('exec_sql') is not available, try direct approach
    if (alterError) {
      console.warn("[migrate] exec_sql RPC not available, trying direct column add via REST...");
      // Attempt to just read the column - if it fails we can't proceed
      const { error: testError } = await supabaseAdmin
        .from("lesson_history")
        .select("tuition_snapshot")
        .limit(1);

      if (testError && testError.message.includes("tuition_snapshot")) {
        return NextResponse.json({
          error: "Cannot add column automatically. Please run this SQL in Supabase Dashboard:\n\nALTER TABLE lesson_history ADD COLUMN IF NOT EXISTS tuition_snapshot INTEGER DEFAULT 0;",
          manual_sql: "ALTER TABLE lesson_history ADD COLUMN IF NOT EXISTS tuition_snapshot INTEGER DEFAULT 0;"
        }, { status: 500 });
      }
      // Column already exists if no error
    }

    // Step 2: Backfill - set tuition_snapshot for records where it's 0
    const { data: records, error: fetchErr } = await supabaseAdmin
      .from("lesson_history")
      .select("id, lesson_id, tuition_snapshot")
      .eq("tuition_snapshot", 0);

    if (fetchErr) {
      return NextResponse.json({ error: `Fetch error: ${fetchErr.message}` }, { status: 500 });
    }

    if (records && records.length > 0) {
      // Get all unique lesson_ids
      const lessonIds = [...new Set(records.map(r => r.lesson_id))];
      const { data: lessonsData } = await supabaseAdmin
        .from("lessons")
        .select("id, tuition_amount")
        .in("id", lessonIds);

      const tuitionMap = new Map(
        (lessonsData || []).map(l => [l.id, l.tuition_amount || 0])
      );

      // Batch update
      let updated = 0;
      for (const record of records) {
        const amount = tuitionMap.get(record.lesson_id) || 0;
        if (amount > 0) {
          await supabaseAdmin
            .from("lesson_history")
            .update({ tuition_snapshot: amount })
            .eq("id", record.id);
          updated++;
        }
      }

      return NextResponse.json({ success: true, message: `Backfilled ${updated} records` });
    }

    return NextResponse.json({ success: true, message: "Column exists, no records to backfill" });
  } catch (error: any) {
    console.error("[migrate] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
