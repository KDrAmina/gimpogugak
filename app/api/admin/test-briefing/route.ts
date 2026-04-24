import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 관리자 전용: 말일 미납자 텔레그램 브리핑 즉시 테스트
 *
 * GET /api/admin/test-briefing
 *   → 실제 미납자 데이터를 조회해 텔레그램으로 브리핑 메시지를 즉시 발송합니다.
 *   → 브라우저 주소창에서 직접 열거나, 관리자 로그인 상태에서 호출할 수 있습니다.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  // ── 관리자 세션 인증 ───────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile?.status !== "active") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  // ── 텔레그램 환경변수 ──────────────────────────────────────────────
  const tgToken  = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHAT_ID;
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  if (!tgToken || !tgChatId) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  // ── KST 현재 월 계산 ───────────────────────────────────────────────
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const year   = kstNow.getUTCFullYear();
  const month  = kstNow.getUTCMonth() + 1;
  const todayStr = `${year}-${String(month).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

  // ── 미납자 조회 ────────────────────────────────────────────────────
  const { data: lessons, error: lessonsErr } = await supabase
    .from("lessons")
    .select("id, user_id, tuition_amount, profiles!inner(name, phone, status)")
    .eq("is_active", true);

  if (lessonsErr) {
    return NextResponse.json(
      { error: `DB 조회 실패: ${lessonsErr.message}` },
      { status: 500 }
    );
  }

  const allIds = (lessons ?? []).map((l: { id: string }) => l.id);

  const paidIds = new Set<string>();
  if (allIds.length > 0) {
    const { data: paid } = await supabase
      .from("lesson_history").select("lesson_id")
      .in("lesson_id", allIds).eq("status", "결제 완료").gte("completed_date", monthStart);
    (paid ?? []).forEach((r: { lesson_id: string }) => paidIds.add(r.lesson_id));
  }

  // user별 납부 여부 집계
  const userMap = new Map<string, { name: string; tuition: number; anyPaid: boolean }>();
  for (const l of (lessons ?? [])) {
    const p = l.profiles as unknown as { name: string; status: string };
    if (p?.status !== "active") continue;
    const uid = l.user_id;
    if (!userMap.has(uid)) userMap.set(uid, { name: p.name, tuition: 0, anyPaid: false });
    const entry = userMap.get(uid)!;
    entry.tuition += l.tuition_amount ?? 0;
    if (paidIds.has(l.id)) entry.anyPaid = true;
  }

  const unpaid = Array.from(userMap.values())
    .filter(u => !u.anyPaid && u.tuition > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  // ── 텔레그램 메시지 구성 ───────────────────────────────────────────
  const monthLabel = `${year}년 ${month}월`;
  let text: string;

  if (unpaid.length === 0) {
    text = [
      "💸 [말일 미납자 브리핑] (테스트 발송)",
      `📅 ${todayStr} (${monthLabel})`,
      "",
      "✅ 이번 달 미납자 없음 — 전원 납부 완료!",
    ].join("\n");
  } else {
    const totalUnpaid = unpaid.reduce((s, u) => s + u.tuition, 0);
    const nameList = unpaid
      .map(u => `  • ${u.name.replace(/[0-9]/g, "").trim()} (${u.tuition.toLocaleString("ko-KR")}원)`)
      .join("\n");
    text = [
      "💸 [말일 미납자 브리핑] (테스트 발송)",
      `📅 ${todayStr} (${monthLabel})`,
      "",
      `미납 인원: ${unpaid.length}명 / 미납 합계: ${totalUnpaid.toLocaleString("ko-KR")}원`,
      "",
      nameList,
    ].join("\n");
  }

  const unpaidPageUrl = `${appUrl}/admin/billing/unpaid`;

  // ── 텔레그램 발송 ─────────────────────────────────────────────────
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: tgChatId,
        text,
        reply_markup: {
          inline_keyboard: [[{ text: "📋 미납자 관리 페이지 열기", url: unpaidPageUrl }]],
        },
      }),
    });

    if (!tgRes.ok) {
      const body = await tgRes.text().catch(() => "(응답 없음)");
      return NextResponse.json(
        { error: `텔레그램 전송 실패 (HTTP ${tgRes.status}): ${body}` },
        { status: 500 }
      );
    }
  } catch (e) {
    return NextResponse.json({ error: `텔레그램 fetch 예외: ${String(e)}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "텔레그램 브리핑 발송 완료",
    unpaidCount: unpaid.length,
    month: `${year}-${String(month).padStart(2, "0")}`,
    unpaidNames: unpaid.map(u => u.name.replace(/[0-9]/g, "").trim()),
    unpaidPageUrl,
  });
}
