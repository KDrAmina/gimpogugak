import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 전용: 크론 알림톡 수동 트리거
 *
 * 인증 분기:
 *  - 자동 크론(Vercel): /api/cron/alimtalk가 Authorization: Bearer CRON_SECRET 헤더를 직접 확인
 *  - 수동 발송(관리자 버튼): 이 라우트에서 관리자 세션을 검증한 뒤 내부 fetch로 크론을 호출
 *    → CRON_SECRET이 없는 개발 환경에서도 관리자 세션이 유효하면 정상 발송됨
 */

export const dynamic = "force-dynamic";

export async function POST() {
  // ── 관리자 세션 인증 (필수) ──────────────────────────────────────
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

  // ── 크론 엔드포인트 내부 호출 ─────────────────────────────────────
  // CRON_SECRET이 설정된 경우 Bearer 토큰 첨부 (Vercel 프로덕션)
  // 미설정 시(로컬 개발)에는 헤더 없이 호출 — 크론 라우트가 VERCEL 환경변수 없을 때 인증 생략
  const cronSecret = process.env.CRON_SECRET;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const headers: Record<string, string> = {};
  if (cronSecret) {
    headers["Authorization"] = `Bearer ${cronSecret}`;
  }

  try {
    const cronRes = await fetch(`${baseUrl}/api/cron/alimtalk`, {
      method: "GET",
      headers,
    });

    const data = await cronRes.json();
    return NextResponse.json(data, { status: cronRes.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "크론 호출 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
