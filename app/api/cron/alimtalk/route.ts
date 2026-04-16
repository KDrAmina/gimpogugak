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
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron 인증 헤더 검증
function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // CRON_SECRET 미설정 시 Vercel 환경에서는 항상 거부 (의도치 않은 공개 접근 차단)
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const apiKey = process.env.SOLAPI_API_KEY as string;
  const apiSecret = process.env.SOLAPI_API_SECRET as string;
  const pfId = process.env.SOLAPI_PF_ID as string;
  const templateId = process.env.SOLAPI_TEMPLATE_ID as string;
  const senderPhone = process.env.SOLAPI_SENDER_PHONE as string;

  console.log("크론 알림톡 환경변수 로드 상태:", {
    apiKey: !!apiKey, apiSecret: !!apiSecret, pfId: !!pfId,
    templateId: !!templateId, senderPhone: !!senderPhone,
    supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey,
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase 환경변수 누락" }, { status: 500 });
  }

  const missingSolapi: string[] = [];
  if (!apiKey) missingSolapi.push("SOLAPI_API_KEY");
  if (!apiSecret) missingSolapi.push("SOLAPI_API_SECRET");
  if (!pfId) missingSolapi.push("SOLAPI_PF_ID");
  if (!templateId) missingSolapi.push("SOLAPI_TEMPLATE_ID");
  if (!senderPhone) missingSolapi.push("SOLAPI_SENDER_PHONE");

  if (missingSolapi.length > 0) {
    console.error("Solapi 환경변수 누락:", missingSolapi.join(", "));
    return NextResponse.json(
      { error: `발송 오류: ${missingSolapi.join(", ")} 가 누락되었습니다.` },
      { status: 500 }
    );
  }

  // Service Role 키로 RLS 우회 (Cron은 사용자 세션 없음)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const lastDay = new Date(targetYear, targetMonth, 0).getDate(); // targetMonth is 1-based; day=0 → 전달 말일
    if (payDay > lastDay && targetDay === lastDay) return true;
    return false;
  }

  /**
   * payment_date 문자열("YYYY-MM-DD")에서 Day 숫자를 안전하게 추출합니다.
   * Date 객체 파싱을 사용하지 않으므로 타임존에 의한 날짜 오인식이 없습니다.
   *
   * 예) "2026-04-16" → 16
   *     "2026-01-31" → 31
   *     null / 빈 문자열 → 0 (필터링됨)
   */
  function extractPayDay(paymentDate: string | null): number {
    if (!paymentDate) return 0;
    const parts = paymentDate.split("-");
    const day = parseInt(parts[2] ?? "0", 10);
    return isNaN(day) ? 0 : day;
  }

  // ── 4. 토·일요일: 즉시 종료 (금요일 선발송으로 이미 처리됨) ────────
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`[CRON SKIP] 주말(${todayStr}) — 금요일 선발송으로 이미 처리되었으므로 발송 없음`);
    return NextResponse.json({
      message: `주말(${todayStr}) 발송 없음 — 금요일에 선발송 완료`,
      sent: 0,
      skipped: true,
    });
  }

  // ── 5. 금요일: 이번 주 토·일요일 날짜(Day) 사전 계산 ────────────────
  /**
   * 금요일 선발송 로직:
   * 오늘(금), 내일(토), 모레(일) 결제일인 수강생 모두 포함.
   *
   * kstNow 에 24h / 48h 를 더한 뒤 getUTC* 로 읽으면 월 경계도 자동으로 처리됩니다.
   */
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
    // ⚠️ is_active=true 만 조회 → 과거 이력(is_active=false) 원천 차단
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
      console.error("[CRON ERROR] DB 조회 오류:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({ error: "DB 조회 실패", detail: error.message }, { status: 500 });
    }

    const rawRows = (data || []) as unknown as LessonRow[];
    console.log(`[CRON DB] 활성 lesson 조회 결과: ${rawRows.length}건`);

    // lesson.id 기준 중복 제거 (Cartesian Product 방지)
    const uniqueLessonMap = new Map<string, LessonRow>();
    for (const row of rawRows) {
      if (!uniqueLessonMap.has(row.id)) {
        uniqueLessonMap.set(row.id, row);
      }
    }
    const rows = Array.from(uniqueLessonMap.values());
    console.log(`[CRON DB] 중복 제거 후: ${rows.length}건`);

    // ── 7. 오늘(+금요일이면 토·일) 발송 대상 필터링 ───────────────────
    /**
     * [핵심 변경 사항]
     * 기존: `new Date(payment_date + "T00:00:00").getDate()`
     *   → Date 객체 생성 후 로컬 시간 기준 .getDate() 호출
     *   → Vercel(UTC) 환경에서는 결과가 맞지만, 타임존 의존적이라 위험
     *
     * 개선: `extractPayDay(payment_date)` — YYYY-MM-DD 에서 DD를 직접 파싱
     *   → Date 객체 파싱 없음 → 타임존 완전 독립
     *
     * [말일 보정]
     * 기존: `payDay === todayDay` 단순 비교 → 말일 수강생 영구 미발송 버그
     *   예) payment_date="2026-02-28", 3월 28일 → payDay=28, todayDay=28 → 발송 ✓
     *   예) payment_date="2026-01-31", 4월 30일 → payDay=31, todayDay=30 → 미발송 ✗ (버그!)
     *
     * 개선: `matchesPayDay()` — alimtalk/page.tsx 와 동일한 말일 보정 로직 적용
     *   예) payment_date="2026-01-31", 4월 30일 → payDay=31>30=lastDay → 발송 ✓
     */
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

      // ── 안전한 payDay 추출 (Date 파싱 없이 문자열에서 직접 추출) ──────
      const payDay = extractPayDay(r.payment_date);
      if (payDay === 0) {
        skippedNoPayDay++;
        console.log(`[CRON FILTER] payment_date 파싱 실패(${r.payment_date}) → 스킵: ${name}`);
        continue;
      }

      // ── 말일 보정 포함 결제일 일치 검사 ─────────────────────────────
      const matchesToday = matchesPayDay(payDay, todayYear, todayMonth, todayDay);
      const matchesSat = isFriday && satYear !== null && satMonth !== null && satDay !== null
        ? matchesPayDay(payDay, satYear, satMonth, satDay)
        : false;
      const matchesSun = isFriday && sunYear !== null && sunMonth !== null && sunDay !== null
        ? matchesPayDay(payDay, sunYear, sunMonth, sunDay)
        : false;

      if (matchesToday) {
        console.log(`[CRON MATCH] 오늘(${todayStr}) 결제일 일치 → 대상: ${name} | payDay=${payDay}`);
        todayTargets.push({ ...r, actualDateStr: todayStr });
      } else if (matchesSat) {
        console.log(`[CRON MATCH] 토요일(${satDateStr}) 선발송 대상 → 포함: ${name} | payDay=${payDay}`);
        todayTargets.push({ ...r, actualDateStr: satDateStr! });
      } else if (matchesSun) {
        console.log(`[CRON MATCH] 일요일(${sunDateStr}) 선발송 대상 → 포함: ${name} | payDay=${payDay}`);
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
      return NextResponse.json({
        message: `${coverageMsg} 발송 대상 없음`,
        sent: 0,
        todayDay,
        filterSummary: { total: rows.length, skippedNoPayDay, skippedNoPhone, skippedInactive, skippedDisabled, skippedNoMatch },
      });
    }

    // ── 8. 중복 발송 방지: 오늘 이미 발송된 수강생 확인 ─────────────────
    // ⚠️ type 필터 제거 — auto_cron·manual 구분 없이 성공 이력이 있으면 모두 차단
    // (수동 발송 후 크론이 재발송하거나 크론 후 수동이 재발송하는 버그 원천 차단)
    // KST todayStr로 비교하므로 UTC/KST 시차에 의한 날짜 오인식 없음
    const { data: sentToday, error: sentTodayError } = await supabase
      .from("notification_log")
      .select("phone")
      .eq("sent_date", todayStr)
      .in("status", ["success", "manual_success"]);

    if (sentTodayError) {
      console.error("[CRON ERROR] 발송 이력 조회 실패:", {
        code: sentTodayError.code,
        message: sentTodayError.message,
      });
    }

    const alreadySentPhones = new Set(
      (sentToday || []).map((r: { phone: string }) => r.phone)
    );
    console.log(`[CRON DEDUP] 오늘(${todayStr}) 이미 발송 완료: ${alreadySentPhones.size}명`);

    // ── 9. 동일인물 그룹화 (이름 숫자 제거 + 연락처) ────────────────────
    const groupMap = new Map<string, GroupedTarget>();

    for (const row of todayTargets) {
      const rawName = row.profiles.name || "";
      const baseName = rawName.replace(/[0-9]/g, "").trim();
      const phone = row.profiles.phone || "";
      const key = `${baseName}__${phone}`;

      if (alreadySentPhones.has(phone)) {
        console.log(`[CRON DEDUP] 이미 발송 완료 → 스킵: ${baseName}`);
        continue;
      }

      // 실제 결제 예정 날짜 문자열 ("M월 D일" 형식)
      // actualDateStr은 "YYYY-MM-DD" → 문자열에서 직접 파싱 (Date 객체 불필요)
      const [_actY, actM, actD] = row.actualDateStr.split("-").map(Number);
      const actualPaymentDateStr = `${actM}월 ${actD}일`;

      if (groupMap.has(key)) {
        const existing = groupMap.get(key)!;
        existing.totalTuition += row.tuition_amount || 0;
        existing.lessonIds.push(row.id);
        if (row.category && !existing.categories.includes(row.category)) {
          existing.categories.push(row.category);
        }
        // 복수 수업 시 가장 이른 actualDateStr 우선 (금요일에 금+토+일 혼합 그룹의 경우)
        if (row.actualDateStr < existing.logDate) {
          existing.logDate = row.actualDateStr;
          existing.actualPaymentDateStr = actualPaymentDateStr;
        }
      } else {
        groupMap.set(key, {
          baseName,
          phone,
          totalTuition: row.tuition_amount || 0,
          paymentDate: row.payment_date,
          actualPaymentDateStr,
          // 금요일 선발송도 오늘 날짜로 기록 → UI의 발송완료 배지가 오늘 조회에서 정상 표시됨
          logDate: todayStr,
          categories: row.category ? [row.category] : [],
          lessonIds: [row.id],
        });
      }
    }

    // ── 이번 달 이미 납부한 수강생 스마트 스킵 ────────────────────────────
    // lesson_history에서 이번 달(YYYY-MM) 결제 완료 기록이 있으면 발송 제외.
    // 결제일이 맞더라도 이미 선결제한 수강생에게 중복 알림 발송을 방지함.
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
          code: paidCheckError.code,
          message: paidCheckError.message,
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

    // 이미 납부한 수강생 스킵 로그 기록
    const alreadyPaidTargets = allTargets.filter((t) => alreadyPaidPhones.has(t.phone));
    if (alreadyPaidTargets.length > 0) {
      const skipInserts = alreadyPaidTargets.map((t) => ({
        phone: t.phone,
        name: t.baseName,
        status: "skipped_already_paid",
        sent_date: todayStr,
        type: "auto_cron",
        created_at: new Date().toISOString(),
      }));
      const { error: skipLogError } = await supabase.from("notification_log").insert(skipInserts);
      if (skipLogError) {
        console.error("[CRON ERROR] 납부 완료 스킵 로그 저장 실패:", {
          code: skipLogError.code,
          message: skipLogError.message,
        });
      }
    }

    // 납부 완료 수강생 제외 후 이후 필터링 진행
    const activeTargets = allTargets.filter((t) => !alreadyPaidPhones.has(t.phone));
    console.log(`[CRON PAID_SKIP] 납부완료 스킵: ${alreadyPaidTargets.length}명 | 발송 진행: ${activeTargets.length}명`);

    // ── 수강료 0원 이하 → 발송 제외 + DB 기록 ──────────────────────────
    // 0원 대상자를 로그에 남겨 관리자가 "발송 없음"의 원인을 파악할 수 있게 함.
    const zeroTuitionTargets = activeTargets.filter((t) => t.totalTuition <= 0);
    const targets = activeTargets.filter((t) => t.totalTuition > 0);
    if (zeroTuitionTargets.length > 0) {
      console.log(`[CRON SKIP] 수강료 0원 → 스킵: ${zeroTuitionTargets.map(t => t.baseName).join(", ")}`);
    }

    // 0원 스킵 대상도 notification_log에 기록 (사유 추적용)
    if (zeroTuitionTargets.length > 0) {
      const zeroInserts = zeroTuitionTargets.map((t) => ({
        phone: t.phone,
        name: t.baseName,
        status: "skipped_zero_tuition",
        sent_date: todayStr,
        type: "auto_cron",
        created_at: new Date().toISOString(),
      }));
      const { error: zeroLogError } = await supabase
        .from("notification_log")
        .insert(zeroInserts);
      if (zeroLogError) {
        console.error("0원 스킵 로그 저장 실패:", zeroLogError);
      }
    }

    if (targets.length === 0) {
      console.log(`[CRON DONE] 최종 발송 대상 없음 — 0원스킵=${zeroTuitionTargets.length} / 납부완료스킵=${alreadyPaidTargets.length}`);
      return NextResponse.json({
        message: `오전 10시 자동 발송 완료 — 발송 대상 없음`,
        sent: 0,
        skippedZero: zeroTuitionTargets.length,
        skippedAlreadyPaid: alreadyPaidTargets.length,
        todayDay,
      });
    }

    console.log(`[CRON SOLAPI] 발송 시작: ${targets.length}명 → ${targets.map(t => t.baseName).join(", ")}`);

    // ── 10. Solapi SDK로 알림톡 발송 ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let solapiService: any = null;
    try {
      const { SolapiMessageService } = await import("solapi");
      solapiService = new SolapiMessageService(apiKey, apiSecret);
      console.log("[CRON SOLAPI] SDK 초기화 완료");
    } catch (sdkErr) {
      console.error("[CRON ERROR] Solapi SDK 로드 실패:", sdkErr);
      return NextResponse.json({ error: "Solapi SDK 초기화 실패", detail: String(sdkErr) }, { status: 500 });
    }

    let success = 0;
    let fail = 0;
    const logs: { phone: string; name: string; status: string; logDate: string }[] = [];

    for (const target of targets) {
      const phone = target.phone.replace(/[^0-9]/g, "");
      if (phone.length < 10) {
        console.error(`[CRON ERROR] 전화번호 형식 오류 → 발송 불가: ${target.baseName} | phone="${target.phone}"`);
        fail++;
        logs.push({ phone, name: target.baseName, status: "invalid_phone", logDate: target.logDate });
        continue;
      }

      // ── 이중 방어막: 발송 직전 DB 재확인 ────────────────────────────────
      const { data: doubleCheck, error: doubleCheckError } = await supabase
        .from("notification_log")
        .select("id")
        .eq("phone", phone)
        .eq("sent_date", todayStr)
        .in("status", ["success", "manual_success"])
        .limit(1);

      if (doubleCheckError) {
        console.error(`[CRON ERROR] 이중체크 DB 조회 실패 (${target.baseName}):`, {
          code: doubleCheckError.code,
          message: doubleCheckError.message,
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
            pfId,
            templateId,
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
        const errMsg = err instanceof Error ? err.message : String(err);
        const errCode = (err as { code?: string })?.code ?? "UNKNOWN";
        console.error(`[CRON ERROR] 알림톡 발송 실패 (${target.baseName}):`, {
          code: errCode,
          message: errMsg,
          phone,
          pfId,
          templateId,
        });
        fail++;
        logs.push({ phone, name: target.baseName, status: "fail", logDate: target.logDate });
      }
    }

    // ── 11. notification_log 기록 ─────────────────────────────────────
    // 금요일 선발송도 sent_date = 오늘(금요일) 날짜로 통일 기록
    // → UI 페이지의 발송완료 배지가 오늘 날짜 조회에서 정상 표시됨
    const logInserts = logs.map((l) => ({
      phone: l.phone,
      name: l.name,
      status: l.status,
      sent_date: todayStr, // 항상 오늘(발송 실행 날짜) 기록
      type: "auto_cron",
      created_at: new Date().toISOString(),
    }));

    if (logInserts.length > 0) {
      const { error: logError } = await supabase
        .from("notification_log")
        .insert(logInserts);

      if (logError) {
        console.error("[CRON ERROR] 발송 로그 저장 실패:", {
          code: logError.code,
          message: logError.message,
          details: logError.details,
        });
      } else {
        console.log(`[CRON LOG] notification_log 저장 완료: ${logInserts.length}건`);
      }
    }

    const isFridayPreSend = isFriday && (satDay !== null || sunDay !== null);
    console.log(`[CRON DONE] 완료 — 성공=${success} / 실패=${fail} / 0원스킵=${zeroTuitionTargets.length} / 납부완료스킵=${alreadyPaidTargets.length}`);
    return NextResponse.json({
      message: isFridayPreSend
        ? `금요일 선발송 완료 (${todayStr} — 토:${satDateStr}, 일:${sunDateStr} 포함)`
        : `오전 10시 자동 발송 완료 (${todayStr})`,
      todayDay,
      todayStr,
      dayOfWeek,
      isFridayPreSend,
      success,
      fail,
      total: targets.length,
      skippedZero: zeroTuitionTargets.length,
      skippedAlreadyPaid: alreadyPaidTargets.length,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "알 수 없는 오류";
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error("[CRON ERROR] 예기치 못한 오류:", { message: errMsg, stack: errStack });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
