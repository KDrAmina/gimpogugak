import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Vercel Cron: 매일 KST 오전 10시(UTC 01:00) 실행
 *
 * ── 요일별 발송 전략 ──────────────────────────────────────────────
 * 월~목 : 오늘 결제일인 수강생만 발송
 * 금요일 : 오늘(금) + 내일(토) + 모레(일) 결제일 수강생을 한 번에 선발송
 * 토~일 : 즉시 종료 (금요일에 이미 발송 완료)
 * ────────────────────────────────────────────────────────────────
 *
 * ── 말일 특별 처리 ───────────────────────────────────────────────
 * 매월 말일 : 이번 달 미납자 요약을 텔레그램으로 발송 (미납자 관리 페이지 인라인 버튼 포함)
 * ────────────────────────────────────────────────────────────────
 *
 * ── 모니터링 안전장치 ───────────────────────────────────────────────
 * 1. TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID 설정 시:
 *    - 정상 완료 → ✅ 일일 브리핑 (발송 성공 명단, 스킵 명단)
 *    - 오늘 대상 없음 → ℹ️ 안내 메시지
 *    - 에러 발생 → 🚨 즉각 알림
 *    - 말일 → 💸 미납자 요약 브리핑 (인라인 버튼)
 * 2. 실행 완료·중단 시 Supabase cron_logs 테이블에 결과를 영구 기록합니다.
 *    (Vercel 함수 로그 30분 만료 대응)
 * ────────────────────────────────────────────────────────────────
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Solapi 기본 설정 (환경변수 우선, 없으면 하드코딩 값 사용)
const DEFAULT_PF_ID           = "KA01PF260331040320508LV0zMRKw5rq";
const DEFAULT_TEMPLATE_REGULAR = "KA01TP260401151429848dunorzB8OgO";

// ─────────────────────────────────────────────────────────────────────────────
// 텔레그램 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Telegram Bot API로 메시지를 전송합니다.
 * 토큰이나 채팅 ID 가 미설정이면 조용히 무시합니다.
 * inlineButton 지정 시 인라인 키보드 버튼을 함께 전송합니다.
 */
async function sendTelegram(
  token: string | undefined,
  chatId: string | undefined,
  text: string,
  inlineButton?: { label: string; url: string }
): Promise<void> {
  if (!token || !chatId) return;
  try {
    const payload: Record<string, unknown> = { chat_id: chatId, text };
    if (inlineButton) {
      payload.reply_markup = {
        inline_keyboard: [[{ text: inlineButton.label, url: inlineButton.url }]],
      };
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(body 없음)");
      console.error(`[CRON TELEGRAM] 전송 실패 HTTP ${res.status}: ${body}`);
    }
  } catch (e) {
    console.error("[CRON TELEGRAM] fetch 예외:", String(e));
  }
}

/**
 * ✅ 일일 브리핑 메시지를 구성합니다.
 *
 * 오늘 결제 대상자 전체 명단을 먼저 보여주고, 발송 성공/제외/실패를 구분합니다.
 * 포맷 예시:
 *   ✅ [알림톡 발송 브리핑]
 *   📅 2026-04-20 (월요일)
 *
 *   오늘 전체 결제 대상: 홍길동, 김철수, 이영희 (총 3명)
 *
 *   알림톡 발송 성공: 2건 (홍길동, 김철수)
 *
 *   발송 제외(이미 납부 등): 1건 (이영희)
 */
function buildBriefingMessage({
  todayStr,
  dayLabel,
  successNames,
  failNames,
  skippedNames,
}: {
  todayStr: string;
  dayLabel: string;
  successNames: string[];
  failNames: string[];
  skippedNames: string[];
}): string {
  // 오늘 결제일 대상자가 전혀 없는 경우
  if (successNames.length === 0 && failNames.length === 0 && skippedNames.length === 0) {
    return [
      "ℹ️ [알림톡 브리핑] 오늘 결제일인 수강생이 없습니다.",
      `📅 ${todayStr} (${dayLabel})`,
    ].join("\n");
  }

  const allNames = [...successNames, ...failNames, ...skippedNames];
  const totalCount = allNames.length;

  const lines: string[] = [
    "✅ [알림톡 발송 브리핑]",
    `📅 ${todayStr} (${dayLabel})`,
    "",
    `오늘 전체 결제 대상: ${allNames.join(", ")} (총 ${totalCount}명)`,
    "",
    `알림톡 발송 성공: ${successNames.length}건${successNames.length > 0 ? ` (${successNames.join(", ")})` : ""}`,
  ];

  if (skippedNames.length > 0) {
    lines.push("");
    lines.push(`발송 제외(이미 납부 등): ${skippedNames.length}건 (${skippedNames.join(", ")})`);
  }

  if (failNames.length > 0) {
    lines.push("");
    lines.push(`⚠️ 발송 실패: ${failNames.length}건 (${failNames.join(", ")})`);
  }

  return lines.join("\n");
}

/**
 * 🚨 에러 알림 메시지를 구성합니다.
 * 포맷 예시:
 *   🚨 [알림톡 발송 에러]
 *   - 실패 원인: Solapi API 호출 실패
 *   - 상세: INVALID_TEMPLATE_ID
 *   - 시간: 2026-04-16T01:00:05.123Z
 */
function buildErrorMessage(
  title: string,
  details: { errorCode?: string; errorMessage?: string; time?: string; [key: string]: unknown }
): string {
  const lines: string[] = [
    "🚨 [알림톡 발송 에러]",
    `- 실패 원인: ${title}`,
  ];
  if (details.errorCode)    lines.push(`- 오류 코드: ${details.errorCode}`);
  if (details.errorMessage && details.errorMessage !== title) {
    lines.push(`- 상세: ${details.errorMessage}`);
  }
  if (details.time)         lines.push(`- 시간: ${details.time}`);

  // 추가 컨텍스트 필드 (name 등)
  const skip = new Set(["errorCode", "errorMessage", "time"]);
  for (const [k, v] of Object.entries(details)) {
    if (!skip.has(k) && v !== undefined && v !== null) {
      lines.push(`- ${k}: ${String(v)}`);
    }
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// cron_logs DB 기록 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/**
 * cron_logs 테이블에 실행 결과를 INSERT 합니다.
 * 테이블 미존재(42P01) 시 조용히 무시 — 마이그레이션 전 단계에서도 크론은 정상 동작합니다.
 *
 * 테이블 생성 SQL → supabase/migrations/20260416_create_cron_logs.sql
 */
async function saveCronLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  log: {
    today_str: string;
    total_tried: number;
    success_count: number;
    fail_count: number;
    error_summary?: string | null;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from("cron_logs").insert({
      today_str:     log.today_str,
      total_tried:   log.total_tried,
      success_count: log.success_count,
      fail_count:    log.fail_count,
      error_summary: log.error_summary ?? null,
      // created_at 은 DB DEFAULT NOW() 사용
    });
    if (error) {
      if (error.code !== "42P01") { // 42P01: 테이블 미존재 — 마이그레이션 전 단계
        console.error("[CRON LOG] cron_logs INSERT 실패:", { code: error.code, message: error.message });
      }
    } else {
      console.log(`[CRON LOG] cron_logs 저장 완료 — total_tried=${log.total_tried} success=${log.success_count} fail=${log.fail_count}`);
    }
  } catch (e) {
    console.error("[CRON LOG] cron_logs INSERT 예외:", String(e));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 말일 미납자 텔레그램 브리핑
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 매월 말일 실행 — 이번 달 결제 완료 기록이 없는 수강생 목록을 텔레그램으로 발송.
 * 메시지 하단에 미납자 관리 페이지 인라인 버튼을 첨부합니다.
 */
async function sendUnpaidBriefing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  tgToken: string | undefined,
  tgChatId: string | undefined,
  year: number,
  month: number,
  todayStr: string,
  appUrl: string,
): Promise<void> {
  if (!tgToken || !tgChatId) return;

  try {
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

    // 활성 수강생 전체 조회
    const { data: lessons, error: lessonsErr } = await supabase
      .from("lessons")
      .select("id, user_id, tuition_amount, profiles!inner(name, phone, status)")
      .eq("is_active", true);

    if (lessonsErr || !lessons) {
      console.error("[CRON UNPAID] lessons 조회 실패:", lessonsErr?.message);
      return;
    }

    const allIds = lessons.map((l: { id: string }) => l.id);

    // 이번 달 납부 완료 lesson_id
    const paidIds = new Set<string>();
    if (allIds.length > 0) {
      const { data: paid } = await supabase
        .from("lesson_history").select("lesson_id")
        .in("lesson_id", allIds).eq("status", "결제 완료").gte("completed_date", monthStart);
      (paid ?? []).forEach((r: { lesson_id: string }) => paidIds.add(r.lesson_id));
    }

    // user별 미납 집계
    const userMap = new Map<string, { name: string; tuition: number; anyPaid: boolean }>();
    for (const l of lessons) {
      const p = l.profiles as unknown as { name: string; status: string };
      if (p?.status !== "active") continue;
      const uid = l.user_id;
      if (!userMap.has(uid)) {
        userMap.set(uid, { name: p.name, tuition: 0, anyPaid: false });
      }
      const entry = userMap.get(uid)!;
      entry.tuition += l.tuition_amount ?? 0;
      if (paidIds.has(l.id)) entry.anyPaid = true;
    }

    const unpaid = Array.from(userMap.values())
      .filter(u => !u.anyPaid && u.tuition > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));

    const monthLabel = `${year}년 ${month}월`;

    let text: string;
    if (unpaid.length === 0) {
      text = [
        "💸 [말일 미납자 브리핑]",
        `📅 ${todayStr} (${monthLabel} 마지막 날)`,
        "",
        "✅ 이번 달 미납자 없음 — 전원 납부 완료!",
      ].join("\n");
    } else {
      const totalUnpaid = unpaid.reduce((s, u) => s + u.tuition, 0);
      const nameList = unpaid
        .map(u => `  • ${u.name.replace(/[0-9]/g, "").trim()} (${u.tuition.toLocaleString("ko-KR")}원)`)
        .join("\n");
      text = [
        "💸 [말일 미납자 브리핑]",
        `📅 ${todayStr} (${monthLabel} 마지막 날)`,
        "",
        `미납 인원: ${unpaid.length}명 / 미납 합계: ${totalUnpaid.toLocaleString("ko-KR")}원`,
        "",
        nameList,
      ].join("\n");
    }

    const unpaidPageUrl = `${appUrl}/admin/billing/unpaid`;
    await sendTelegram(tgToken, tgChatId, text, {
      label: "📋 미납자 관리 페이지 열기",
      url: unpaidPageUrl,
    });

    console.log(`[CRON UNPAID] 말일 브리핑 발송 완료 — 미납 ${unpaid.length}명`);
  } catch (e) {
    console.error("[CRON UNPAID] 말일 브리핑 예외:", String(e));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Cron 인증
// ─────────────────────────────────────────────────────────────────────────────

function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────

type LessonRow = {
  id: string;
  user_id: string;
  category: string;
  tuition_amount: number;
  payment_date: string | null;
  profiles: {
    name: string;
    phone: string | null;
    status: string;
    is_alimtalk_enabled: boolean;
  };
};

type GroupedTarget = {
  baseName: string;
  phone: string;
  totalTuition: number;
  paymentDate: string | null;
  actualPaymentDateStr: string;
  logDate: string;
  categories: string[];
  lessonIds: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// 메인 핸들러
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {

  // ── 1. Vercel 환경에서만 CRON_SECRET 인증 ──────────────────────────
  if (process.env.VERCEL && !verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. 환경변수 로드 ───────────────────────────────────────────────
  const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const apiKey             = process.env.SOLAPI_API_KEY as string;
  const apiSecret          = process.env.SOLAPI_API_SECRET as string;
  const pfId               = process.env.SOLAPI_PF_ID ?? DEFAULT_PF_ID;
  const templateId         = process.env.SOLAPI_TEMPLATE_ID ?? DEFAULT_TEMPLATE_REGULAR;
  const senderPhone        = process.env.SOLAPI_SENDER_PHONE as string;
  const tgToken            = process.env.TELEGRAM_BOT_TOKEN;   // 미설정 시 알림 비활성
  const tgChatId           = process.env.TELEGRAM_CHAT_ID;     // 미설정 시 알림 비활성
  const appUrl             = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  console.log("크론 알림톡 환경변수 로드 상태:", {
    apiKey: !!apiKey, apiSecret: !!apiSecret, pfId: !!pfId,
    templateId: !!templateId, senderPhone: !!senderPhone,
    supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey,
    telegramEnabled: !!(tgToken && tgChatId),
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    const msg = "Supabase 환경변수 누락";
    console.error("[CRON ERROR]", msg);
    await sendTelegram(tgToken, tgChatId,
      buildErrorMessage(msg, { errorMessage: "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정" })
    );
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const missingSolapi: string[] = [];
  if (!apiKey)      missingSolapi.push("SOLAPI_API_KEY");
  if (!apiSecret)   missingSolapi.push("SOLAPI_API_SECRET");
  if (!senderPhone) missingSolapi.push("SOLAPI_SENDER_PHONE");

  if (missingSolapi.length > 0) {
    const msg = `Solapi 환경변수 누락: ${missingSolapi.join(", ")}`;
    console.error("[CRON ERROR]", msg);
    await sendTelegram(tgToken, tgChatId, buildErrorMessage("Solapi 환경변수 누락", { errorMessage: msg }));
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 계좌번호 조회 (settings 테이블)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let bankAccount = "";
  try {
    const { data: setting } = await supabase
      .from("settings").select("value").eq("key", "bank_account").single();
    bankAccount = setting?.value ?? "";
  } catch {
    // settings 테이블 미존재 시 무시
  }

  // ── 3. KST 기준 오늘 날짜·요일 계산 ──────────────────────────────
  /**
   * Vercel 서버는 UTC 기준으로 동작합니다.
   * KST(UTC+9)로 보정하기 위해 9시간(ms)을 더한 뒤 getUTC* 메서드로 읽습니다.
   * .getDate() 등 로컬 시간 메서드는 타임존 의존성이 있어 사용하지 않습니다.
   */
  const now       = new Date();
  const kstNow    = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const todayYear  = kstNow.getUTCFullYear();
  const todayMonth = kstNow.getUTCMonth() + 1;
  const todayDay   = kstNow.getUTCDate();
  const todayStr   = `${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;
  const dayOfWeek  = kstNow.getUTCDay(); // 0=일 1=월 … 5=금 6=토
  const DAY_LABELS = ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"];
  const dayLabel   = DAY_LABELS[dayOfWeek];

  // 말일 여부 (이번 달의 마지막 날인지 확인)
  const lastDayOfMonth     = new Date(todayYear, todayMonth, 0).getDate();
  const isLastDayOfMonth   = todayDay === lastDayOfMonth;

  console.log(`[CRON START] KST: ${todayStr} (${dayLabel}) | UTC: ${now.toISOString()} | 말일=${isLastDayOfMonth}`);

  // ── 날짜 헬퍼 함수 ────────────────────────────────────────────────

  /** alimtalk/page.tsx 의 matchesPayDay 와 동일한 말일 보정 로직 */
  function matchesPayDay(payDay: number, y: number, m: number, d: number): boolean {
    if (payDay === d) return true;
    const lastDay = new Date(y, m, 0).getDate(); // m은 1-based, day=0 → 전달 말일
    return payDay > lastDay && d === lastDay;
  }

  /** "YYYY-MM-DD" 에서 DD 를 숫자로 직접 추출 (Date 파싱 없이 타임존 독립) */
  function extractPayDay(paymentDate: string | null): number {
    if (!paymentDate) return 0;
    const d = parseInt(paymentDate.split("-")[2] ?? "0", 10);
    return isNaN(d) ? 0 : d;
  }

  // ── 4. 토·일요일: 즉시 종료 ───────────────────────────────────────
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`[CRON SKIP] 주말(${todayStr}) — 금요일 선발송으로 이미 처리됨`);
    if (isLastDayOfMonth) {
      await sendUnpaidBriefing(supabase, tgToken, tgChatId, todayYear, todayMonth, todayStr, appUrl);
    }
    await saveCronLog(supabase, { today_str: todayStr, total_tried: 0, success_count: 0, fail_count: 0 });
    return NextResponse.json({ message: `주말(${todayStr}) 발송 없음`, sent: 0, skipped: true });
  }

  // ── 5. 금요일: 토·일요일 날짜 사전 계산 ──────────────────────────
  const isFriday = dayOfWeek === 5;

  let satYear: number | null = null, satMonth: number | null = null, satDay: number | null = null;
  let sunYear: number | null = null, sunMonth: number | null = null, sunDay: number | null = null;
  let satDateStr: string | null = null, sunDateStr: string | null = null;

  if (isFriday) {
    const MS_DAY  = 24 * 60 * 60 * 1000;
    const satDate = new Date(kstNow.getTime() + MS_DAY);
    const sunDate = new Date(kstNow.getTime() + 2 * MS_DAY);
    satYear  = satDate.getUTCFullYear(); satMonth = satDate.getUTCMonth() + 1; satDay = satDate.getUTCDate();
    sunYear  = sunDate.getUTCFullYear(); sunMonth = sunDate.getUTCMonth() + 1; sunDay = sunDate.getUTCDate();
    satDateStr = `${satYear}-${String(satMonth).padStart(2,"0")}-${String(satDay).padStart(2,"0")}`;
    sunDateStr = `${sunYear}-${String(sunMonth).padStart(2,"0")}-${String(sunDay).padStart(2,"0")}`;
    console.log(`[CRON FRIDAY] 선발송: 오늘(${todayStr}) + 토(${satDateStr}) + 일(${sunDateStr})`);
  }

  // 명단 수집 (텔레그램 브리핑에 사용)
  const successNames:     string[] = [];
  const failNames:        string[] = [];
  const skippedPaidNames: string[] = [];
  const skippedZeroNames: string[] = [];

  try {
    // ── 6. 활성 수강생 조회 ───────────────────────────────────────────
    const { data, error } = await supabase
      .from("lessons")
      .select(`id, user_id, category, tuition_amount, payment_date,
               profiles!inner(name, phone, status, is_alimtalk_enabled)`)
      .eq("is_active", true);

    if (error) {
      const msg = `DB 조회 오류: ${error.message}`;
      console.error("[CRON ERROR] DB 조회 오류:", { code: error.code, message: error.message, hint: error.hint });
      await Promise.all([
        sendTelegram(tgToken, tgChatId, buildErrorMessage("활성 수강생 DB 조회 실패", {
          errorCode: error.code, errorMessage: error.message, time: now.toISOString(),
        })),
        saveCronLog(supabase, { today_str: todayStr, total_tried: 0, success_count: 0, fail_count: 0, error_summary: msg }),
      ]);
      return NextResponse.json({ error: "DB 조회 실패", detail: error.message }, { status: 500 });
    }

    const rawRows = (data || []) as unknown as LessonRow[];
    console.log(`[CRON DB] 활성 lesson: ${rawRows.length}건`);

    const uniqueLessonMap = new Map<string, LessonRow>();
    for (const row of rawRows) {
      if (!uniqueLessonMap.has(row.id)) uniqueLessonMap.set(row.id, row);
    }
    const rows = Array.from(uniqueLessonMap.values());
    console.log(`[CRON DB] 중복 제거 후: ${rows.length}건`);

    // ── 7. 발송 대상 필터링 ────────────────────────────────────────────
    type FilteredRow = LessonRow & { actualDateStr: string };
    const todayTargets: FilteredRow[] = [];
    let skippedNoPhone = 0, skippedInactive = 0, skippedDisabled = 0, skippedNoPayDay = 0, skippedNoMatch = 0;

    for (const r of rows) {
      const name = r.profiles?.name ?? "(이름없음)";

      if (!r.payment_date)               { skippedNoPayDay++;  console.log(`[CRON FILTER] 결제일 없음 → 스킵: ${name}`);                            continue; }
      if (!r.profiles?.phone)            { skippedNoPhone++;   console.log(`[CRON FILTER] 전화번호 없음 → 스킵: ${name}`);                          continue; }
      if (r.profiles.status !== "active"){ skippedInactive++;  console.log(`[CRON FILTER] 비활성(${r.profiles.status}) → 스킵: ${name}`);           continue; }
      if (r.profiles.is_alimtalk_enabled === false){ skippedDisabled++; console.log(`[CRON FILTER] 알림톡 OFF → 스킵: ${name}`); continue; }

      const payDay = extractPayDay(r.payment_date);
      if (payDay === 0) { skippedNoPayDay++; console.log(`[CRON FILTER] payDay 파싱 실패(${r.payment_date}) → 스킵: ${name}`); continue; }

      const matchesToday = matchesPayDay(payDay, todayYear, todayMonth, todayDay);
      const matchesSat   = isFriday && satYear !== null && satMonth !== null && satDay !== null
        ? matchesPayDay(payDay, satYear, satMonth, satDay) : false;
      const matchesSun   = isFriday && sunYear !== null && sunMonth !== null && sunDay !== null
        ? matchesPayDay(payDay, sunYear, sunMonth, sunDay) : false;

      if (matchesToday) {
        console.log(`[CRON MATCH] 오늘(${todayStr}) → ${name} (payDay=${payDay})`);
        todayTargets.push({ ...r, actualDateStr: todayStr });
      } else if (matchesSat) {
        console.log(`[CRON MATCH] 토(${satDateStr}) 선발송 → ${name} (payDay=${payDay})`);
        todayTargets.push({ ...r, actualDateStr: satDateStr! });
      } else if (matchesSun) {
        console.log(`[CRON MATCH] 일(${sunDateStr}) 선발송 → ${name} (payDay=${payDay})`);
        todayTargets.push({ ...r, actualDateStr: sunDateStr! });
      } else {
        skippedNoMatch++;
      }
    }

    console.log(`[CRON FILTER] 전체=${rows.length} | 대상=${todayTargets.length} | 결제일없음=${skippedNoPayDay} | 전화없음=${skippedNoPhone} | 비활성=${skippedInactive} | OFF=${skippedDisabled} | 날짜불일치=${skippedNoMatch}`);

    if (todayTargets.length === 0) {
      const coverageMsg = isFriday ? `오늘(${todayStr})/토(${satDateStr})/일(${sunDateStr})` : `오늘(${todayStr})`;
      console.log(`[CRON DONE] 발송 대상 없음 — todayDay=${todayDay}`);
      if (isLastDayOfMonth) {
        await sendUnpaidBriefing(supabase, tgToken, tgChatId, todayYear, todayMonth, todayStr, appUrl);
      }
      await Promise.all([
        // 오늘 결제일 수강생이 없음 → ℹ️ 브리핑
        sendTelegram(tgToken, tgChatId, buildBriefingMessage({
          todayStr, dayLabel, successNames: [], failNames: [], skippedNames: [],
        })),
        saveCronLog(supabase, { today_str: todayStr, total_tried: 0, success_count: 0, fail_count: 0 }),
      ]);
      return NextResponse.json({
        message: `${coverageMsg} 발송 대상 없음`, sent: 0, todayDay,
        filterSummary: { total: rows.length, skippedNoPayDay, skippedNoPhone, skippedInactive, skippedDisabled, skippedNoMatch },
      });
    }

    // ── 8. 중복 발송 방지 ─────────────────────────────────────────────
    const { data: sentToday, error: sentTodayError } = await supabase
      .from("notification_log").select("phone")
      .eq("sent_date", todayStr).in("status", ["success", "manual_success"]);

    if (sentTodayError) {
      console.error("[CRON ERROR] 발송 이력 조회 실패:", { code: sentTodayError.code, message: sentTodayError.message });
      await sendTelegram(tgToken, tgChatId, buildErrorMessage("발송 이력 조회 실패", {
        errorCode: sentTodayError.code, errorMessage: sentTodayError.message, time: now.toISOString(),
      }));
    }

    const alreadySentPhones = new Set((sentToday || []).map((r: { phone: string }) => r.phone));
    console.log(`[CRON DEDUP] 오늘 이미 발송: ${alreadySentPhones.size}명`);

    // ── 9. 동일인물 그룹화 ───────────────────────────────────────────
    const groupMap = new Map<string, GroupedTarget>();

    for (const row of todayTargets) {
      const baseName = (row.profiles.name || "").replace(/[0-9]/g, "").trim();
      const phone    = row.profiles.phone || "";
      const key      = `${baseName}__${phone}`;

      if (alreadySentPhones.has(phone)) {
        console.log(`[CRON DEDUP] 이미 발송 → 스킵: ${baseName}`);
        continue;
      }

      const [_y, actM, actD] = row.actualDateStr.split("-").map(Number);
      const actualPaymentDateStr = `${actM}월 ${actD}일`;

      if (groupMap.has(key)) {
        const ex = groupMap.get(key)!;
        ex.totalTuition += row.tuition_amount || 0;
        ex.lessonIds.push(row.id);
        if (row.category && !ex.categories.includes(row.category)) ex.categories.push(row.category);
        if (row.actualDateStr < ex.logDate) { ex.logDate = row.actualDateStr; ex.actualPaymentDateStr = actualPaymentDateStr; }
      } else {
        groupMap.set(key, {
          baseName, phone,
          totalTuition: row.tuition_amount || 0,
          paymentDate: row.payment_date,
          actualPaymentDateStr,
          logDate: todayStr,
          categories: row.category ? [row.category] : [],
          lessonIds: [row.id],
        });
      }
    }

    // ── 이번 달 납부 완료 스킵 ─────────────────────────────────────────
    const allTargets = Array.from(groupMap.values());
    const currentMonthStart = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const allLessonIds = allTargets.flatMap((t) => t.lessonIds);
    const alreadyPaidPhones = new Set<string>();

    if (allLessonIds.length > 0) {
      const { data: paidThisMonth, error: paidCheckError } = await supabase
        .from("lesson_history").select("lesson_id")
        .in("lesson_id", allLessonIds).eq("status", "결제 완료").gte("completed_date", currentMonthStart);

      if (paidCheckError) {
        console.error("[CRON ERROR] 납부 확인 조회 실패:", { code: paidCheckError.code, message: paidCheckError.message });
        await sendTelegram(tgToken, tgChatId, buildErrorMessage("이번달 납부 확인 조회 실패", {
          errorCode: paidCheckError.code, errorMessage: paidCheckError.message, time: now.toISOString(),
        }));
      }

      const paidLessonIds = new Set((paidThisMonth || []).map((r: { lesson_id: string }) => r.lesson_id));
      for (const t of allTargets) {
        if (t.lessonIds.some((id) => paidLessonIds.has(id))) {
          alreadyPaidPhones.add(t.phone);
          skippedPaidNames.push(t.baseName); // 브리핑용 이름 수집
          console.log(`[CRON SKIP] 납부 완료 → 스킵: ${t.baseName}`);
        }
      }
    }

    const alreadyPaidTargets = allTargets.filter((t) => alreadyPaidPhones.has(t.phone));
    if (alreadyPaidTargets.length > 0) {
      const { error: skipLogError } = await supabase.from("notification_log").insert(
        alreadyPaidTargets.map((t) => ({
          phone: t.phone, name: t.baseName, status: "skipped_already_paid",
          sent_date: todayStr, type: "auto_cron", created_at: new Date().toISOString(),
        }))
      );
      if (skipLogError) console.error("[CRON ERROR] 납부 스킵 로그 저장 실패:", { code: skipLogError.code, message: skipLogError.message });
    }

    const activeTargets = allTargets.filter((t) => !alreadyPaidPhones.has(t.phone));
    console.log(`[CRON PAID_SKIP] 납부완료 스킵: ${alreadyPaidTargets.length}명 | 발송 진행: ${activeTargets.length}명`);

    const zeroTuitionTargets = activeTargets.filter((t) => t.totalTuition <= 0);
    const targets            = activeTargets.filter((t) => t.totalTuition > 0);

    if (zeroTuitionTargets.length > 0) {
      console.log(`[CRON SKIP] 0원 → 스킵: ${zeroTuitionTargets.map(t => t.baseName).join(", ")}`);
      zeroTuitionTargets.forEach(t => skippedZeroNames.push(t.baseName)); // 브리핑용 이름 수집
      const { error: zeroLogError } = await supabase.from("notification_log").insert(
        zeroTuitionTargets.map((t) => ({
          phone: t.phone, name: t.baseName, status: "skipped_zero_tuition",
          sent_date: todayStr, type: "auto_cron", created_at: new Date().toISOString(),
        }))
      );
      if (zeroLogError) console.error("[CRON ERROR] 0원 스킵 로그 저장 실패:", { code: zeroLogError.code, message: zeroLogError.message });
    }

    if (targets.length === 0) {
      console.log(`[CRON DONE] 최종 발송 대상 없음 — 0원스킵=${zeroTuitionTargets.length} 납부완료스킵=${alreadyPaidTargets.length}`);
      const skippedNames = [...skippedPaidNames, ...skippedZeroNames];
      if (isLastDayOfMonth) {
        await sendUnpaidBriefing(supabase, tgToken, tgChatId, todayYear, todayMonth, todayStr, appUrl);
      }
      await Promise.all([
        sendTelegram(tgToken, tgChatId, buildBriefingMessage({
          todayStr, dayLabel, successNames: [], failNames: [], skippedNames,
        })),
        saveCronLog(supabase, { today_str: todayStr, total_tried: 0, success_count: 0, fail_count: 0 }),
      ]);
      return NextResponse.json({
        message: "오전 10시 자동 발송 완료 — 발송 대상 없음", sent: 0,
        skippedZero: zeroTuitionTargets.length, skippedAlreadyPaid: alreadyPaidTargets.length, todayDay,
      });
    }

    console.log(`[CRON SOLAPI] 발송 시작: ${targets.length}명 → ${targets.map(t => t.baseName).join(", ")}`);

    // ── 10. Solapi SDK 초기화 ─────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let solapiService: any = null;
    try {
      const { SolapiMessageService } = await import("solapi");
      solapiService = new SolapiMessageService(apiKey, apiSecret);
      console.log("[CRON SOLAPI] SDK 초기화 완료");
    } catch (sdkErr) {
      const msg = `Solapi SDK 로드 실패: ${String(sdkErr)}`;
      console.error("[CRON ERROR]", msg);
      await Promise.all([
        sendTelegram(tgToken, tgChatId, buildErrorMessage("Solapi SDK 초기화 실패", { errorMessage: String(sdkErr), time: now.toISOString() })),
        saveCronLog(supabase, { today_str: todayStr, total_tried: targets.length, success_count: 0, fail_count: targets.length, error_summary: msg }),
      ]);
      return NextResponse.json({ error: "Solapi SDK 초기화 실패", detail: String(sdkErr) }, { status: 500 });
    }

    // ── 11. 알림톡 발송 루프 ──────────────────────────────────────────
    let success = 0;
    let fail = 0;
    const logs: { phone: string; name: string; status: string; logDate: string }[] = [];

    for (const target of targets) {
      const phone = target.phone.replace(/[^0-9]/g, "");
      if (phone.length < 10) {
        console.error(`[CRON ERROR] 전화번호 오류: ${target.baseName} | phone="${target.phone}"`);
        failNames.push(target.baseName);
        fail++;
        logs.push({ phone, name: target.baseName, status: "invalid_phone", logDate: target.logDate });
        continue;
      }

      // 발송 직전 이중 방어막
      const { data: doubleCheck, error: doubleCheckError } = await supabase
        .from("notification_log").select("id")
        .eq("phone", phone).eq("sent_date", todayStr).in("status", ["success", "manual_success"]).limit(1);

      if (doubleCheckError) {
        console.error(`[CRON ERROR] 이중체크 실패 (${target.baseName}):`, { code: doubleCheckError.code, message: doubleCheckError.message });
      }
      if (doubleCheck && doubleCheck.length > 0) {
        console.log(`[CRON DEDUP] 이중체크 — 이미 발송, 스킵: ${target.baseName}`);
        continue;
      }

      try {
        console.log(`[CRON SOLAPI] 발송: ${target.baseName} | phone=${phone} | 수강료=${target.totalTuition} | 결제일=${target.actualPaymentDateStr}`);
        await solapiService.sendOne({
          to: phone, from: senderPhone,
          kakaoOptions: {
            pfId, templateId,
            variables: {
              "#{이름}":    target.baseName,
              "#{수강료}":  target.totalTuition.toLocaleString("ko-KR"),
              "#{결제일}":  target.actualPaymentDateStr,
              "#{계좌번호}": bankAccount,
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        console.log(`[CRON SOLAPI] 성공: ${target.baseName}`);
        successNames.push(target.baseName); // 브리핑용
        success++;
        logs.push({ phone, name: target.baseName, status: "success", logDate: target.logDate });
      } catch (err) {
        const errMsg  = err instanceof Error ? err.message : String(err);
        const errCode = (err as { code?: string })?.code ?? "UNKNOWN";
        console.error(`[CRON ERROR] 발송 실패 (${target.baseName}):`, { code: errCode, message: errMsg, phone, pfId, templateId });
        failNames.push(target.baseName); // 브리핑용
        fail++;
        logs.push({ phone, name: target.baseName, status: "fail", logDate: target.logDate });
      }
    }

    // ── 12. notification_log 기록 ─────────────────────────────────────
    if (logs.length > 0) {
      const { error: logError } = await supabase.from("notification_log").insert(
        logs.map((l) => ({
          phone: l.phone, name: l.name, status: l.status,
          sent_date: todayStr, type: "auto_cron", created_at: new Date().toISOString(),
        }))
      );
      if (logError) {
        console.error("[CRON ERROR] notification_log 저장 실패:", { code: logError.code, message: logError.message });
        await sendTelegram(tgToken, tgChatId, buildErrorMessage("notification_log INSERT 실패", {
          errorCode: logError.code, errorMessage: logError.message, time: now.toISOString(),
        }));
      } else {
        console.log(`[CRON LOG] notification_log 저장: ${logs.length}건`);
      }
    }

    // ── 13. 발송 실패 에러 알림 (실패 건이 있을 때만) ─────────────────
    if (failNames.length > 0) {
      const failDetail = failNames.join(", ");
      await sendTelegram(tgToken, tgChatId, buildErrorMessage(
        `알림톡 발송 실패 ${failNames.length}건`,
        { errorMessage: `실패 대상: ${failDetail}`, 성공: success, 실패: fail, 전체: targets.length, time: now.toISOString() }
      ));
    }

    // ── 14. 일일 브리핑 발송 ─────────────────────────────────────────
    const skippedNames = [...skippedPaidNames, ...skippedZeroNames];
    const briefing = buildBriefingMessage({ todayStr, dayLabel, successNames, failNames, skippedNames });

    // ── 15. cron_logs 저장 ────────────────────────────────────────────
    const isFridayPreSend = isFriday && (satDay !== null || sunDay !== null);
    const errorSummary = failNames.length > 0
      ? `발송 실패(${failNames.length}건): ${failNames.join(", ")}`
      : null;

    // ── 16. 말일: 미납자 요약 텔레그램 브리핑 ─────────────────────────
    if (isLastDayOfMonth) {
      await sendUnpaidBriefing(supabase, tgToken, tgChatId, todayYear, todayMonth, todayStr, appUrl);
    }

    await Promise.all([
      sendTelegram(tgToken, tgChatId, briefing),
      saveCronLog(supabase, {
        today_str: todayStr,
        total_tried:   targets.length,
        success_count: success,
        fail_count:    fail,
        error_summary: errorSummary,
      }),
    ]);

    console.log(`[CRON DONE] 성공=${success} / 실패=${fail} / 납부스킵=${alreadyPaidTargets.length} / 0원스킵=${zeroTuitionTargets.length}`);
    return NextResponse.json({
      message: isFridayPreSend
        ? `금요일 선발송 완료 (${todayStr} — 토:${satDateStr}, 일:${sunDateStr})`
        : `오전 10시 자동 발송 완료 (${todayStr})`,
      todayDay, todayStr, dayOfWeek, isFridayPreSend,
      success, fail, total: targets.length,
      skippedZero: zeroTuitionTargets.length,
      skippedAlreadyPaid: alreadyPaidTargets.length,
    });

  } catch (err: unknown) {
    const errMsg   = err instanceof Error ? err.message : "알 수 없는 오류";
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error("[CRON ERROR] 예기치 못한 오류:", { message: errMsg, stack: errStack });
    await Promise.all([
      sendTelegram(tgToken, tgChatId, buildErrorMessage("크론 예기치 못한 오류", {
        errorMessage: errMsg, time: now.toISOString(),
      })),
      saveCronLog(supabase, { today_str: todayStr, total_tried: 0, success_count: 0, fail_count: 0, error_summary: errMsg }),
    ]);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
