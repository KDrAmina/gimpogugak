import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증 필요", status: 401, supabase: null };

  const { data: profile } = await supabase
    .from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile?.status !== "active") {
    return { error: "관리자 권한 필요", status: 403, supabase: null };
  }
  return { error: null, status: 200, supabase };
}

// GET /api/admin/settings?key=bank_account
// GET /api/admin/settings  (전체 조회)
export async function GET(req: NextRequest) {
  const { error, status, supabase } = await verifyAdmin();
  if (error || !supabase) return NextResponse.json({ error }, { status });

  const key = req.nextUrl.searchParams.get("key");

  if (key) {
    const { data, error: dbErr } = await supabase
      .from("settings").select("value").eq("key", key).single();
    if (dbErr && dbErr.code !== "PGRST116") {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }
    return NextResponse.json({ key, value: data?.value ?? "" });
  }

  const { data, error: dbErr } = await supabase.from("settings").select("*");
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ settings: data ?? [] });
}

// POST /api/admin/settings
// body: { key: string, value: string }
export async function POST(req: NextRequest) {
  const { error, status, supabase } = await verifyAdmin();
  if (error || !supabase) return NextResponse.json({ error }, { status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { key, value } = body as { key?: unknown; value?: unknown };
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "저장할 항목의 key가 누락되었습니다." }, { status: 400 });
  }

  const { error: dbErr } = await supabase
    .from("settings")
    .upsert(
      { key, value: typeof value === "string" ? value : "", updated_at: new Date().toISOString() },
      { onConflict: "key" }   // PRIMARY KEY 충돌 시 UPDATE로 처리
    );

  if (dbErr) {
    console.error("[SETTINGS] upsert 실패:", { code: dbErr.code, message: dbErr.message });
    const friendlyMsg =
      dbErr.code === "42P01" ? "settings 테이블이 존재하지 않습니다. 마이그레이션을 먼저 실행해 주세요." :
      dbErr.code === "23505" ? "이미 존재하는 설정입니다. 잠시 후 다시 시도해 주세요." :
      dbErr.code === "42501" ? "권한이 없습니다. 관리자 계정으로 로그인되어 있는지 확인해 주세요." :
      `저장 중 오류가 발생했습니다. (${dbErr.code ?? "알 수 없는 오류"})`;
    return NextResponse.json({ error: friendlyMsg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
