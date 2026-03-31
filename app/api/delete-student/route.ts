import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // Verify the caller is an admin
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

    // Use service role key to delete from auth.users
    // CASCADE will handle: auth.users → profiles → lessons → lesson_history
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error: missing service role key" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Manually delete in order as a safety net (in case CASCADE isn't set up)
    // 1. Delete lesson_history entries via lesson_ids
    const { data: lessonIds } = await supabaseAdmin
      .from("lessons")
      .select("id")
      .eq("user_id", user_id);

    if (lessonIds && lessonIds.length > 0) {
      const ids = lessonIds.map((l: { id: string }) => l.id);
      await supabaseAdmin
        .from("lesson_history")
        .delete()
        .in("lesson_id", ids);
    }

    // 2. Delete lessons
    await supabaseAdmin
      .from("lessons")
      .delete()
      .eq("user_id", user_id);

    // 3. Delete profile
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", user_id);

    // 4. Delete auth user (this also cascades but we already cleaned up above)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (authError) {
      console.error("[delete-student] auth.admin.deleteUser error:", authError);
      // Profile and lessons are already deleted, so this is a partial success
      return NextResponse.json({
        warning: "프로필과 수업 데이터는 삭제되었으나 인증 계정 삭제에 실패했습니다.",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[delete-student] Error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
