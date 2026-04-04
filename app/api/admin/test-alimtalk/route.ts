import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 전용: 크론 알림톡 수동 트리거
 * 관리자 세션 검증 후 /api/cron/alimtalk를 CRON_SECRET으로 내부 호출
 */

export const dynamic = "force-dynamic";

export async function POST() {
  // ── 관리자 인증 ──
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile?.status !== "active") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  // ── 크론 엔드포인트 내부 호출 ──
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  // 서버 내부 URL 결정 (Vercel 환경 대응)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const cronRes = await fetch(`${baseUrl}/api/cron/alimtalk`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    const data = await cronRes.json();
    return NextResponse.json(data, { status: cronRes.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "크론 호출 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
