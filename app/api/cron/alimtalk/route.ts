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
 * ── 모니터링 안전장치 ───────────────────────────────────────────────
 * 1. ERROR_WEBHOOK_URL 환경변수가 설정된 경우, [CRON ERROR] 발생 즉시
 *    POST 웹훅으로 오류 내용을 전송합니다 (Slack/Discord/기타 호환).
 * 2. 실행 완료 또는 오류 종료 시 Supabase cron_logs 테이블에 결과를 기록합니다.
 * ────────────────────────────────────────────────────────────────
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── 웹훅 알림 헬퍼 ─────────────────────────────────────────────────────────
/**
 * ERROR_WEBHOOK_URL 으로 오류 알림을 전송합니다.
 *
 * payload 포맷:
 *   { "text": "...", "content": "..." }
 *   → "text"   : Slack Incoming Webhook 호환
 *   → "content": Discord Webhook 호환
 *   → 기타 제네릭 HTTP Webhook 에서도 JSON body 로 수신 가능
 *
 * 웹훅 전송 자체의 실패는 console.error 로만 기록하며 크론 흐름을 중단하지 않습니다.
 */
async function sendErrorWebhook(
  webhookUrl: string | undefined,
  title: string,
  details: {
    time?: string;
    name?: string;
    errorCode?: string;
    errorMessage?: string;
    [key: string]: unknown;
  }
): Promise<void> {
  if (!webhookUrl) return;

  const time = details.time ?? new Date().toISOString();
  const lines: string[] = [
    `🚨 *[크론 알림톡 오류]* ${title}`,
    `• 시간: ${time}`,
  ];
  if (details.name)         lines.push(`• 수강생: ${details.name}`);
  if (details.errorCode)    lines.push(`• 오류 코드: ${details.errorCode}`);
  if (details.errorMessage) lines.push(`• 오류 내용: ${details.errorMessage}`);

  // 추가 필드 (DB hint 등)
  const extraKeys = Object.keys(details).filter(
    (k) => !["time", "name", "errorCode", "errorMessage"].includes(k)
  );
  for (const k of extraKeys) {
    if (details[k] !== undefined && details[k] !== null) {
      lines.push(`• ${k}: ${String(details[k])}`);
    }
  }

  const message = lines.join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,    // Slack 호환
        content: message, // Discord 호환
      }),
    });
  } catch (webhookErr) {
    // 웹훅 전송 실패는 크론 동작에 영향 없음 — 조용히 기록만
    console.error("[CRON WEBHOOK] 웹훅 전송 실패:", String(webhookErr));
  }
}

// ── cron_logs DB 기록 헬퍼 ─────────────────────────────────────────────────
/**
 * cron_logs 테이블에 실행 결과를 INSERT 합니다.
 * 테이블이 없는 경우(42P01) 조용히 무시하며 크론 흐름을 중단하지 않습니다.
 *
 * 테이블 생성 SQL → /supabase/migrations/create_cron_logs.sql 참조
 */
async function saveCronLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof createClient<any>>,
  log: {
    run_at: string;
    today_str: string;
    total: number;
    success: number;
    fail: number;
    skipped: number;
    status: "completed" | "error" | "no_target" | "weekend";
    error_summary?: string | null;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from("cron_logs").insert({
      run_at:        log.run_at,
      today_str:     log.today_str,
      total:         log.total,
      success:       log.success,
      fail:          log.fail,
      skipped:       log.skipped,
      status:        log.status,
      error_summary: log.error_summary ?? null,
    });
    if (error) {
      // 42P01: 테이블 미존재 — 마이그레이션 전 단계이므로 조용히 무시
      if (error.code !== "42P01") {
        console.error("[CRON LOG] cron_logs INSERT 실패:", {
          code: error.code,
          message: error.message,
        });
      }
    } else {
      console.log(`[CRON LOG] cron_logs 저장 완료: status=${log.status} | success=${log.success} | fail=${log.fail}`);
    }
  } catch (e) {
    console.error("[CRON LOG] cron_logs INSERT 예외:", String(e));
  }
}

// ── Vercel Cron 인증 헤더 검증 ─────────────────────────────────────────────
function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

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
  /** 알림톡 템플릿 #{결제일} 변수에 표시할 실제 날짜 문자열 (예: "4월 5일") */
  actualPaymentDateStr: string;
  /** notification_log에 기록할 sent_date (금요일 선발송은 오늘 날짜로 통일) */
  logDate: string;
  categories: string[];
  lessonIds: string[];
};

export async function GET(req: Request) {
  // ── 1. Vercel 환경에서만 CRON_SECRET 인증 ──────────────────────────
  if (process.env.VERCEL && !verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. 환경변수 로드 ───────────────────────────────────────────────
  const supabaseUrl      = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const apiKey           = process.env.SOLAPI_API_KEY as string;
  const apiSecret        = process.env.SOLAPI_API_SECRET as string;
  const pfId             = process.env.SOLAPI_PF_ID as string;
  const templateId       = process.env.SOLAPI_TEMPLATE_ID as string;
  const senderPhone      = process.env.SOLAPI_SENDER_PHONE as string;
  const webhookUrl       = process.env.ERROR_WEBHOOK_URL; // 미설정 시 undefined → 웹훅 비활성

  console.log("크론 알림톡 환경변수 로드 상태:", {
    apiKey: !!apiKey, apiSecret: !!apiSecret, pfId: !!pfId,
    templateId: !!templateId, senderPhone: !!senderPhone,
    supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey,
    webhookEnabled: !!webhookUrl,
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    const errMsg = "Supabase 환경변수 누락";
    console.error("[CRON ERROR]", errMsg);
    await sendErrorWebhook(webhookUrl, errMsg, {
      time: new Date().toISOString(),
      errorMessage: "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정",
    });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }

  const missingSolapi: string[] = [];
  if (!apiKey)      missingSolapi.push("SOLAPI_API_KEY");
  if (!apiSecret)   missingSolapi.push("SOLAPI_API_SECRET");
  if (!pfId)        missingSolapi.push("SOLAPI_PF_ID");
  if (!templateId)  missingSolapi.push("SOLAPI_TEMPLATE_ID");
  if (!senderPhone) missingSolapi.push("SOLAPI_SENDER_PHONE");

  if (missingSolapi.length > 0) {
    const errMsg = `Solapi 환경변수 누락: ${missingSolapi.join(", ")}`;
    console.error("[CRON ERROR]", errMsg);
    await sendErrorWebhook(webhookUrl, "Solapi 환경변수 누락", {
      time: new Date().toISOString(),
      errorMessage: errMsg,
    });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }

  // Service Role 키로 RLS 우회 (Cron은 사용자 세션 없음)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 실행 시작 시각 (cron_logs.run_at 에 기록)
  const runAt = new Date().toISOString();

  // ── 3. KST 기준 오늘 날짜·요일 계산 ──────────────────────────────
  /**
   * Vercel 서버는 UTC 기준으로 동작합니다.
   * KST(UTC+9)로 보정하기 위해 9시간(ms)을 더한 뒤 UTC 메서드로 읽습니다.
   *
   * ⚠️ .getDate() / .getFullYear() 등 "로컬 시간" 메서드는 절대 사용하지 않습니다.
   *    Vercel 환경에서 로컬=UTC이지만, 명시적으로 getUTC* 를 써서 의도를 고정합니다.
   */
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);

  const todayYear  = kstNow.getUTCFullYear();
  const todayMonth = kstNow.getUTCMonth() + 1; // 1-based
  const todayDay   = kstNow.getUTCDate();
  const todayStr   = `${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;

  // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  const dayOfWeek = kstNow.getUTCDay();

  console.log(`[CRON START] KST 기준 날짜: ${todayStr} (${["일","월","화","수","목","금","토"][dayOfWeek]}요일) | UTC: ${now.toISOString()}`);

  // ── 말일 보정 포함 결제일 일치 함수 ──────────────────────────────
  /**
   * alimtalk/page.tsx 의 matchesPayDay 와 동일한 로직.
   * payment_date 의 Day 값이 해당 달의 마지막 날을 초과하면 말일로 보정합니다.
   *
   * 예) payDay=31, 4월(30일) → 31 > 30 → 말일(30)로 간주 → 4월 30일에 발송 ✓
   * 예) payDay=31, 4월 16일  → 31 ≠ 16 & 16 ≠ lastDay(30)          → 미발송 ✓
   */
  function matchesPayDay(payDay: number, targetYear: number, targetMonth: number, targetDay: number): boolean {
    if (payDay === targetDay) return true;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    if (payDay > lastDay && targetDay === lastDay) return true;
    return false;
  }

  /**
   * payment_date 문자열("YYYY-MM-DD")에서 Day 숫자를 안전하게 추출합니다.
   * Date 객체 파싱을 사용하지 않으므로 타임존에 의한 날짜 오인식이 없습니다.
   */
  function extractPayDay(paymentDate: string | null): number {
    if (!paymentDate) return 0;
    const parts = paymentDate.split("-");
    const day = parseInt(parts[2] ?? "0", 10);
    return isNaN(day) ? 0 : day;
  }

  // ── 4. 토·일요일: 즉시 종료 ───────────────────────────────────────
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`[CRON SKIP] 주말(${todayStr}) — 금요일 선발송으로 이미 처리되었으므로 발송 없음`);
    await saveCronLog(supabase, {
      run_at: runAt, today_str: todayStr,
      total: 0, success: 0, fail: 0, skipped: 0,
      status: "weekend",
    });
    return NextResponse.json({
      message: `주말(${todayStr}) 발송 없음 — 금요일에 선발송 완료`,
      sent: 0, skipped: true,
    });
  }

  // ── 5. 금요일: 이번 주 토·일요일 날짜(Day) 사전 계산 ────────────────
  const isFriday = dayOfWeek === 5;

  let satYear: number | null = null;
  let satMonth: number | null = null;
  let satDay: number | null = null;
  let sunYear: number | null = null;
  let sunMonth: number | null = null;
  let sunDay: number | null = null;
  let satDateStr: string | null = null;
  let sunDateStr: string | null = null;

  if (isFriday) {
    const MS_DAY = 24 * 60 * 60 * 1000;
    const satDate = new Date(kstNow.getTime() + MS_DAY);
    const sunDate = new Date(kstNow.getTime() + 2 * MS_DAY);

    satYear  = satDate.getUTCFullYear();
    satMonth = satDate.getUTCMonth() + 1;
    satDay   = satDate.getUTCDate();
    sunYear  = sunDate.getUTCFullYear();
    sunMonth = sunDate.getUTCMonth() + 1;
    sunDay   = sunDate.getUTCDate();

    satDateStr = `${satYear}-${String(satMonth).padStart(2, "0")}-${String(satDay).padStart(2, "0")}`;
    sunDateStr = `${sunYear}-${String(sunMonth).padStart(2, "0")}-${String(sunDay).padStart(2, "0")}`;

    console.log(`[CRON FRIDAY] 선발송 대상: 오늘(${todayStr}) + 토(${satDateStr}) + 일(${sunDateStr})`);
  }

  try {
    // ── 6. 활성 수강생 조회 ───────────────────────────────────────────
    const { data, error } = await supabase
      .from("lessons")
      .select(`
        id,
        user_id,
        category,
        tuition_amount,
        payment_date,
        profiles!inner(name, phone, status, is_alimtalk_enabled)
      `)
      .eq("is_active", true);

    if (error) {
      const errMsg = `DB 조회 오류: ${error.message}`;
      console.error("[CRON ERROR] DB 조회 오류:", {
        code: error.code, message: error.message,
        details: error.details, hint: error.hint,
      });
      await Promise.all([
        sendErrorWebhook(webhookUrl, "활성 수강생 DB 조회 실패", {
          time: now.toISOString(),
          errorCode: error.code,
          errorMessage: error.message,
          hint: error.hint ?? undefined,
        }),
        saveCronLog(supabase, {
          run_at: runAt, today_str: todayStr,
          total: 0, success: 0, fail: 0, skipped: 0,
          status: "error", error_summary: errMsg,
        }),
      ]);
      return NextResponse.json({ error: "DB 조회 실패", detail: error.message }, { status: 500 });
    }

    const rawRows = (data || []) as unknown as LessonRow[];
    console.log(`[CRON DB] 활성 lesson 조회 결과: ${rawRows.length}건`);

    const uniqueLessonMap = new Map<string, LessonRow>();
    for (const row of rawRows) {
      if (!uniqueLessonMap.has(row.id)) uniqueLessonMap.set(row.id, row);
    }
    const rows = Array.from(uniqueLessonMap.values());
    console.log(`[CRON DB] 중복 제거 후: ${rows.length}건`);

    // ── 7. 발송 대상 필터링 (말일 보정 + 타임존 안전 추출) ──────────────
    type FilteredRow = LessonRow & { actualDateStr: string };
    const todayTargets: FilteredRow[] = [];
    let skippedNoPhone = 0, skippedInactive = 0, skippedDisabled = 0, skippedNoPayDay = 0, skippedNoMatch = 0;

    for (const r of rows) {
      const name = r.profiles?.name ?? "(이름없음)";

      if (!r.payment_date) {
        skippedNoPayDay++;
        console.log(`[CRON FILTER] 결제일 없음 → 스킵: ${name}`);
        continue;
      }
      if (!r.profiles?.phone) {
        skippedNoPhone++;
        console.log(`[CRON FILTER] 전화번호 없음 → 스킵: ${name}`);
        continue;
      }
      if (r.profiles.status !== "active") {
        skippedInactive++;
        console.log(`[CRON FILTER] 비활성 프로필(${r.profiles.status}) → 스킵: ${name}`);
        continue;
      }
      if (r.profiles.is_alimtalk_enabled === false) {
        skippedDisabled++;
        console.log(`[CRON FILTER] 알림톡 OFF → 스킵: ${name}`);
        continue;
      }

      const payDay = extractPayDay(r.payment_date);
      if (payDay === 0) {
        skippedNoPayDay++;
        console.log(`[CRON FILTER] payment_date 파싱 실패(${r.payment_date}) → 스킵: ${name}`);
        continue;
      }

      const matchesToday = matchesPayDay(payDay, todayYear, todayMonth, todayDay);
      const matchesSat = isFriday && satYear !== null && satMonth !== null && satDay !== null
        ? matchesPayDay(payDay, satYear, satMonth, satDay) : false;
      const matchesSun = isFriday && sunYear !== null && sunMonth !== null && sunDay !== null
        ? matchesPayDay(payDay, sunYear, sunMonth, sunDay) : false;

      if (matchesToday) {
        console.log(`[CRON MATCH] 오늘(${todayStr}) 결제일 일치 → 대상: ${name} | payDay=${payDay}`);
        todayTargets.push({ ...r, actualDateStr: todayStr });
      } else if (matchesSat) {
        console.log(`[CRON MATCH] 토요일(${satDateStr}) 선발송 → 포함: ${name} | payDay=${payDay}`);
        todayTargets.push({ ...r, actualDateStr: satDateStr! });
      } else if (matchesSun) {
        console.log(`[CRON MATCH] 일요일(${sunDateStr}) 선발송 → 포함: ${name} | payDay=${payDay}`);
        todayTargets.push({ ...r, actualDateStr: sunDateStr! });
      } else {
        skippedNoMatch++;
      }
    }

    console.log(`[CRON FILTER 요약] 전체=${rows.length} | 대상=${todayTargets.length} | 결제일없음=${skippedNoPayDay} | 전화없음=${skippedNoPhone} | 비활성=${skippedInactive} | 알림톡OFF=${skippedDisabled} | 날짜불일치=${skippedNoMatch}`);

    if (todayTargets.length === 0) {
      const coverageMsg = isFriday
        ? `오늘(${todayStr})/토(${satDateStr})/일(${sunDateStr})`
        : `오늘(${todayStr})`;
      console.log(`[CRON DONE] 발송 대상 없음 — todayDay=${todayDay}`);
      await saveCronLog(supabase, {
        run_at: runAt, today_str: todayStr,
        total: 0, success: 0, fail: 0,
        skipped: skippedNoPayDay + skippedNoPhone + skippedInactive + skippedDisabled + skippedNoMatch,
        status: "no_target",
      });
      return NextResponse.json({
        message: `${coverageMsg} 발송 대상 없음`,
        sent: 0, todayDay,
        filterSummary: { total: rows.length, skippedNoPayDay, skippedNoPhone, skippedInactive, skippedDisabled, skippedNoMatch },
      });
    }

    // ── 8. 중복 발송 방지 ─────────────────────────────────────────────
    const { data: sentToday, error: sentTodayError } = await supabase
      .from("notification_log")
      .select("phone")
      .eq("sent_date", todayStr)
      .in("status", ["success", "manual_success"]);

    if (sentTodayError) {
      console.error("[CRON ERROR] 발송 이력 조회 실패:", {
        code: sentTodayError.code, message: sentTodayError.message,
      });
      await sendErrorWebhook(webhookUrl, "발송 이력 조회 실패", {
        time: now.toISOString(),
        errorCode: sentTodayError.code,
        errorMessage: sentTodayError.message,
      });
    }

    const alreadySentPhones = new Set(
      (sentToday || []).map((r: { phone: string }) => r.phone)
    );
    console.log(`[CRON DEDUP] 오늘(${todayStr}) 이미 발송 완료: ${alreadySentPhones.size}명`);

    // ── 9. 동일인물 그룹화 ───────────────────────────────────────────
    const groupMap = new Map<string, GroupedTarget>();

    for (const row of todayTargets) {
      const rawName  = row.profiles.name || "";
      const baseName = rawName.replace(/[0-9]/g, "").trim();
      const phone    = row.profiles.phone || "";
      const key      = `${baseName}__${phone}`;

      if (alreadySentPhones.has(phone)) {
        console.log(`[CRON DEDUP] 이미 발송 완료 → 스킵: ${baseName}`);
        continue;
      }

      const [_actY, actM, actD] = row.actualDateStr.split("-").map(Number);
      const actualPaymentDateStr = `${actM}월 ${actD}일`;

      if (groupMap.has(key)) {
        const existing = groupMap.get(key)!;
        existing.totalTuition += row.tuition_amount || 0;
        existing.lessonIds.push(row.id);
        if (row.category && !existing.categories.includes(row.category)) {
          existing.categories.push(row.category);
        }
        if (row.actualDateStr < existing.logDate) {
          existing.logDate = row.actualDateStr;
          existing.actualPaymentDateStr = actualPaymentDateStr;
        }
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
        .from("lesson_history")
        .select("lesson_id")
        .in("lesson_id", allLessonIds)
        .eq("status", "결제 완료")
        .gte("completed_date", currentMonthStart);

      if (paidCheckError) {
        console.error("[CRON ERROR] 이번달 납부 확인 조회 실패:", {
          code: paidCheckError.code, message: paidCheckError.message,
        });
        await sendErrorWebhook(webhookUrl, "이번달 납부 확인 조회 실패", {
          time: now.toISOString(),
          errorCode: paidCheckError.code,
          errorMessage: paidCheckError.message,
        });
      }

      const paidLessonIds = new Set(
        (paidThisMonth || []).map((r: { lesson_id: string }) => r.lesson_id)
      );
      for (const target of allTargets) {
        if (target.lessonIds.some((id) => paidLessonIds.has(id))) {
          alreadyPaidPhones.add(target.phone);
          console.log(`[CRON SKIP] 이번달 납부 완료 → 스킵: ${target.baseName}`);
        }
      }
    }

    const alreadyPaidTargets = allTargets.filter((t) => alreadyPaidPhones.has(t.phone));
    if (alreadyPaidTargets.length > 0) {
      const skipInserts = alreadyPaidTargets.map((t) => ({
        phone: t.phone, name: t.baseName,
        status: "skipped_already_paid", sent_date: todayStr,
        type: "auto_cron", created_at: new Date().toISOString(),
      }));
      const { error: skipLogError } = await supabase.from("notification_log").insert(skipInserts);
      if (skipLogError) {
        console.error("[CRON ERROR] 납부 완료 스킵 로그 저장 실패:", {
          code: skipLogError.code, message: skipLogError.message,
        });
      }
    }

    const activeTargets = allTargets.filter((t) => !alreadyPaidPhones.has(t.phone));
    console.log(`[CRON PAID_SKIP] 납부완료 스킵: ${alreadyPaidTargets.length}명 | 발송 진행: ${activeTargets.length}명`);

    const zeroTuitionTargets = activeTargets.filter((t) => t.totalTuition <= 0);
    const targets = activeTargets.filter((t) => t.totalTuition > 0);
    if (zeroTuitionTargets.length > 0) {
      console.log(`[CRON SKIP] 수강료 0원 → 스킵: ${zeroTuitionTargets.map(t => t.baseName).join(", ")}`);
    }

    if (zeroTuitionTargets.length > 0) {
      const zeroInserts = zeroTuitionTargets.map((t) => ({
        phone: t.phone, name: t.baseName,
        status: "skipped_zero_tuition", sent_date: todayStr,
        type: "auto_cron", created_at: new Date().toISOString(),
      }));
      const { error: zeroLogError } = await supabase.from("notification_log").insert(zeroInserts);
      if (zeroLogError) {
        console.error("[CRON ERROR] 0원 스킵 로그 저장 실패:", {
          code: zeroLogError.code, message: zeroLogError.message,
        });
      }
    }

    if (targets.length === 0) {
      console.log(`[CRON DONE] 최종 발송 대상 없음 — 0원스킵=${zeroTuitionTargets.length} / 납부완료스킵=${alreadyPaidTargets.length}`);
      await saveCronLog(supabase, {
        run_at: runAt, today_str: todayStr,
        total: 0, success: 0, fail: 0,
        skipped: alreadyPaidTargets.length + zeroTuitionTargets.length,
        status: "no_target",
      });
      return NextResponse.json({
        message: `오전 10시 자동 발송 완료 — 발송 대상 없음`,
        sent: 0,
        skippedZero: zeroTuitionTargets.length,
        skippedAlreadyPaid: alreadyPaidTargets.length,
        todayDay,
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
      const errMsg = `Solapi SDK 로드 실패: ${String(sdkErr)}`;
      console.error("[CRON ERROR]", errMsg);
      await Promise.all([
        sendErrorWebhook(webhookUrl, "Solapi SDK 초기화 실패", {
          time: now.toISOString(),
          errorMessage: String(sdkErr),
        }),
        saveCronLog(supabase, {
          run_at: runAt, today_str: todayStr,
          total: targets.length, success: 0, fail: targets.length, skipped: 0,
          status: "error", error_summary: errMsg,
        }),
      ]);
      return NextResponse.json({ error: "Solapi SDK 초기화 실패", detail: String(sdkErr) }, { status: 500 });
    }

    // ── 11. 알림톡 발송 루프 ──────────────────────────────────────────
    let success = 0;
    let fail = 0;
    const logs: { phone: string; name: string; status: string; logDate: string }[] = [];

    // 발송 중 발생한 에러를 모아 웹훅으로 일괄 전송 (건당 웹훅 과다 방지)
    const sendErrors: { name: string; code: string; message: string }[] = [];

    for (const target of targets) {
      const phone = target.phone.replace(/[^0-9]/g, "");
      if (phone.length < 10) {
        console.error(`[CRON ERROR] 전화번호 형식 오류: ${target.baseName} | phone="${target.phone}"`);
        sendErrors.push({ name: target.baseName, code: "INVALID_PHONE", message: `전화번호 형식 오류: "${target.phone}"` });
        fail++;
        logs.push({ phone, name: target.baseName, status: "invalid_phone", logDate: target.logDate });
        continue;
      }

      // 이중 방어막: 발송 직전 DB 재확인
      const { data: doubleCheck, error: doubleCheckError } = await supabase
        .from("notification_log")
        .select("id")
        .eq("phone", phone)
        .eq("sent_date", todayStr)
        .in("status", ["success", "manual_success"])
        .limit(1);

      if (doubleCheckError) {
        console.error(`[CRON ERROR] 이중체크 DB 조회 실패 (${target.baseName}):`, {
          code: doubleCheckError.code, message: doubleCheckError.message,
        });
      }
      if (doubleCheck && doubleCheck.length > 0) {
        console.log(`[CRON DEDUP] 발송 직전 이중체크 — 이미 발송됨, 스킵: ${target.baseName}`);
        continue;
      }

      try {
        console.log(`[CRON SOLAPI] 발송 시도: ${target.baseName} | phone=${phone} | 수강료=${target.totalTuition} | 결제일=${target.actualPaymentDateStr}`);
        await solapiService.sendOne({
          to: phone,
          from: senderPhone,
          kakaoOptions: {
            pfId, templateId,
            variables: {
              "#{이름}": target.baseName,
              "#{수강료}": target.totalTuition.toLocaleString("ko-KR"),
              "#{결제일}": target.actualPaymentDateStr,
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        console.log(`[CRON SOLAPI] 발송 성공: ${target.baseName}`);
        success++;
        logs.push({ phone, name: target.baseName, status: "success", logDate: target.logDate });
      } catch (err) {
        const errMsg  = err instanceof Error ? err.message : String(err);
        const errCode = (err as { code?: string })?.code ?? "UNKNOWN";
        console.error(`[CRON ERROR] 알림톡 발송 실패 (${target.baseName}):`, {
          code: errCode, message: errMsg, phone, pfId, templateId,
        });
        sendErrors.push({ name: target.baseName, code: errCode, message: errMsg });
        fail++;
        logs.push({ phone, name: target.baseName, status: "fail", logDate: target.logDate });
      }
    }

    // 발송 실패 건이 있으면 웹훅으로 일괄 알림
    if (sendErrors.length > 0) {
      const failSummary = sendErrors
        .map((e) => `${e.name}(${e.code}: ${e.message})`)
        .join(" / ");
      await sendErrorWebhook(webhookUrl, `알림톡 발송 실패 ${sendErrors.length}건`, {
        time: now.toISOString(),
        errorMessage: failSummary,
        성공: success,
        실패: fail,
        전체: targets.length,
      });
    }

    // ── 12. notification_log 기록 ─────────────────────────────────────
    const logInserts = logs.map((l) => ({
      phone: l.phone, name: l.name, status: l.status,
      sent_date: todayStr, type: "auto_cron",
      created_at: new Date().toISOString(),
    }));

    if (logInserts.length > 0) {
      const { error: logError } = await supabase.from("notification_log").insert(logInserts);
      if (logError) {
        console.error("[CRON ERROR] 발송 로그 저장 실패:", {
          code: logError.code, message: logError.message, details: logError.details,
        });
        await sendErrorWebhook(webhookUrl, "notification_log INSERT 실패", {
          time: now.toISOString(),
          errorCode: logError.code,
          errorMessage: logError.message,
        });
      } else {
        console.log(`[CRON LOG] notification_log 저장 완료: ${logInserts.length}건`);
      }
    }

    // ── 13. cron_logs 실행 결과 저장 ─────────────────────────────────
    const isFridayPreSend = isFriday && (satDay !== null || sunDay !== null);
    const finalSkipped = alreadyPaidTargets.length + zeroTuitionTargets.length;
    await saveCronLog(supabase, {
      run_at: runAt, today_str: todayStr,
      total: targets.length, success, fail, skipped: finalSkipped,
      status: fail === 0 ? "completed" : "error",
      error_summary: sendErrors.length > 0
        ? sendErrors.map((e) => `${e.name}: ${e.code}`).join(", ")
        : null,
    });

    console.log(`[CRON DONE] 완료 — 성공=${success} / 실패=${fail} / 0원스킵=${zeroTuitionTargets.length} / 납부완료스킵=${alreadyPaidTargets.length}`);
    return NextResponse.json({
      message: isFridayPreSend
        ? `금요일 선발송 완료 (${todayStr} — 토:${satDateStr}, 일:${sunDateStr} 포함)`
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
      sendErrorWebhook(webhookUrl, "크론 예기치 못한 오류", {
        time: now.toISOString(),
        errorMessage: errMsg,
      }),
      saveCronLog(supabase, {
        run_at: runAt, today_str: todayStr,
        total: 0, success: 0, fail: 0, skipped: 0,
        status: "error", error_summary: errMsg,
      }),
    ]);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
