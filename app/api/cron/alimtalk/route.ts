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
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);

  const todayDay = kstNow.getUTCDate();
  const todayStr = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;

  // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  const dayOfWeek = kstNow.getUTCDay();

  // ── 4. 토·일요일: 즉시 종료 (금요일 선발송으로 이미 처리됨) ────────
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`오늘(${todayStr})은 주말 — 금요일 선발송으로 이미 처리되었으므로 발송 없음`);
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
   * 말일 보정:
   *   예) 금=3월 28일 → 토=29, 일=30  (같은 달)
   *   예) 금=3월 30일 → 토=31, 일=4월 1일  (일요일이 다음 달로 넘어감)
   * → satDate·sunDate를 Date 객체로 직접 계산하므로 자동으로 월 경계 처리됨.
   */
  const isFriday = dayOfWeek === 5;

  let satDay: number | null = null;
  let sunDay: number | null = null;
  let satDateStr: string | null = null;
  let sunDateStr: string | null = null;

  if (isFriday) {
    const satDate = new Date(kstNow.getTime() + 24 * 60 * 60 * 1000);
    const sunDate = new Date(kstNow.getTime() + 48 * 60 * 60 * 1000);

    satDay = satDate.getUTCDate();
    sunDay = sunDate.getUTCDate();

    satDateStr = `${satDate.getUTCFullYear()}-${String(satDate.getUTCMonth() + 1).padStart(2, "0")}-${String(satDay).padStart(2, "0")}`;
    sunDateStr = `${sunDate.getUTCFullYear()}-${String(sunDate.getUTCMonth() + 1).padStart(2, "0")}-${String(sunDay).padStart(2, "0")}`;

    console.log(`금요일 선발송: 오늘(${todayStr}) + 토(${satDateStr}) + 일(${sunDateStr}) 대상 포함`);
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
      console.error("DB 조회 오류:", error);
      return NextResponse.json({ error: "DB 조회 실패" }, { status: 500 });
    }

    const rawRows = (data || []) as unknown as LessonRow[];

    // lesson.id 기준 중복 제거 (Cartesian Product 방지)
    const uniqueLessonMap = new Map<string, LessonRow>();
    for (const row of rawRows) {
      if (!uniqueLessonMap.has(row.id)) {
        uniqueLessonMap.set(row.id, row);
      }
    }
    const rows = Array.from(uniqueLessonMap.values());

    // ── 7. 오늘(+금요일이면 토·일) 발송 대상 필터링 ───────────────────
    /**
     * 각 row에 actualDateStr(실제 결제 예정 날짜 문자열)을 붙여 반환.
     * 이 값은 템플릿 #{결제일} 변수에 사용됩니다.
     *
     * 말일 보정 예시:
     *   payment_date = "2026-01-31" → payDay = 31
     *   금요일이 3월 29일이라면 satDay=30, sunDay=31
     *   → payDay(31) === sunDay(31) 이므로 일요일(3월 31일) 대상으로 포함
     *   → actualDateStr = "2026-03-31" (sunDateStr)
     *
     *   금요일이 3월 30일이라면 satDay=31, sunDay=1(4월 1일)
     *   → payDay(31) === satDay(31) 이므로 토요일(3월 31일) 대상으로 포함
     *   → payDay=1인 수강생은 sunDay(1)에 해당 → actualDateStr = sunDateStr(4월 1일)
     */
    type FilteredRow = LessonRow & { actualDateStr: string };
    const todayTargets: FilteredRow[] = [];

    for (const r of rows) {
      if (!r.payment_date || !r.profiles?.phone || r.profiles.status !== "active") continue;
      if (r.profiles.is_alimtalk_enabled === false) continue;

      const payDay = new Date(r.payment_date + "T00:00:00").getDate();

      if (payDay === todayDay) {
        todayTargets.push({ ...r, actualDateStr: todayStr });
      } else if (isFriday && satDay !== null && payDay === satDay) {
        // 토요일 선발송 대상: 실제 결제일은 satDateStr
        todayTargets.push({ ...r, actualDateStr: satDateStr! });
      } else if (isFriday && sunDay !== null && payDay === sunDay) {
        // 일요일 선발송 대상: 실제 결제일은 sunDateStr
        todayTargets.push({ ...r, actualDateStr: sunDateStr! });
      }
    }

    if (todayTargets.length === 0) {
      const coverageMsg = isFriday
        ? `오늘(${todayStr})/토(${satDateStr})/일(${sunDateStr})`
        : `오늘(${todayStr})`;
      return NextResponse.json({
        message: `${coverageMsg} 발송 대상 없음`,
        sent: 0,
        todayDay,
      });
    }

    // ── 8. 중복 발송 방지: 오늘 이미 발송된 수강생 확인 ─────────────────
    // ⚠️ type 필터 제거 — auto_cron·manual 구분 없이 성공 이력이 있으면 모두 차단
    // (수동 발송 후 크론이 재발송하거나 크론 후 수동이 재발송하는 버그 원천 차단)
    // KST todayStr로 비교하므로 UTC/KST 시차에 의한 날짜 오인식 없음
    const { data: sentToday } = await supabase
      .from("notification_log")
      .select("phone")
      .eq("sent_date", todayStr)
      .in("status", ["success", "manual_success"]);

    const alreadySentPhones = new Set(
      (sentToday || []).map((r: { phone: string }) => r.phone)
    );

    // ── 9. 동일인물 그룹화 (이름 숫자 제거 + 연락처) ────────────────────
    const groupMap = new Map<string, GroupedTarget>();

    for (const row of todayTargets) {
      const rawName = row.profiles.name || "";
      const baseName = rawName.replace(/[0-9]/g, "").trim();
      const phone = row.profiles.phone || "";
      const key = `${baseName}__${phone}`;

      if (alreadySentPhones.has(phone)) continue;

      // 실제 결제 예정 날짜 문자열 ("M월 D일" 형식)
      const actualDate = new Date(row.actualDateStr + "T00:00:00");
      const actualPaymentDateStr = `${actualDate.getUTCMonth() + 1}월 ${actualDate.getUTCDate()}일`;

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
      const { data: paidThisMonth } = await supabase
        .from("lesson_history")
        .select("lesson_id")
        .in("lesson_id", allLessonIds)
        .eq("status", "결제 완료")
        .gte("completed_date", currentMonthStart);

      const paidLessonIds = new Set(
        (paidThisMonth || []).map((r: { lesson_id: string }) => r.lesson_id)
      );

      for (const target of allTargets) {
        if (target.lessonIds.some((id) => paidLessonIds.has(id))) {
          alreadyPaidPhones.add(target.phone);
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
      if (skipLogError) console.error("납부 완료 스킵 로그 저장 실패:", skipLogError);
    }

    // 납부 완료 수강생 제외 후 이후 필터링 진행
    const activeTargets = allTargets.filter((t) => !alreadyPaidPhones.has(t.phone));

    // ── 수강료 0원 이하 → 발송 제외 + DB 기록 ──────────────────────────
    // 0원 대상자를 로그에 남겨 관리자가 "발송 없음"의 원인을 파악할 수 있게 함.
    // 테스트 발송 결과 알림창에서 "0원 제외: Y건"으로 표시됨.
    const zeroTuitionTargets = activeTargets.filter((t) => t.totalTuition <= 0);
    const targets = activeTargets.filter((t) => t.totalTuition > 0);

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
      return NextResponse.json({
        message: `오전 10시 자동 발송 완료 — 발송 대상 없음`,
        sent: 0,
        skippedZero: zeroTuitionTargets.length,
        skippedAlreadyPaid: alreadyPaidTargets.length,
        todayDay,
      });
    }

    // ── 10. Solapi SDK로 알림톡 발송 ─────────────────────────────────
    const { SolapiMessageService } = await import("solapi");
    const messageService = new SolapiMessageService(apiKey, apiSecret);

    let success = 0;
    let fail = 0;
    const logs: { phone: string; name: string; status: string; logDate: string }[] = [];

    for (const target of targets) {
      const phone = target.phone.replace(/[^0-9]/g, "");
      if (phone.length < 10) {
        fail++;
        logs.push({ phone, name: target.baseName, status: "invalid_phone", logDate: target.logDate });
        continue;
      }

      // ── 이중 방어막: 발송 직전 DB 재확인 ────────────────────────────────
      // 배치 체크(8단계) 이후 동시 실행 또는 수동 발송이 끼어든 경우까지 차단.
      // 수동 테스트 발송도 이 경로를 통과하므로 Bypass 불가.
      const { data: doubleCheck } = await supabase
        .from("notification_log")
        .select("id")
        .eq("phone", phone)
        .eq("sent_date", todayStr)
        .in("status", ["success", "manual_success"])
        .limit(1);

      if (doubleCheck && doubleCheck.length > 0) {
        // 이미 발송 완료 — 카운트 증가 없이 조용히 스킵 (로그 기록도 생략)
        continue;
      }

      try {
        await messageService.sendOne({
          to: phone,
          from: senderPhone,
          kakaoOptions: {
            pfId,
            templateId,
            variables: {
              "#{이름}": target.baseName,
              "#{수강료}": target.totalTuition.toLocaleString("ko-KR"),
              // 금요일 선발송 시 실제 결제 예정일(토/일)을 표시
              "#{결제일}": target.actualPaymentDateStr,
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        success++;
        logs.push({ phone, name: target.baseName, status: "success", logDate: target.logDate });
      } catch (err) {
        console.error(`알림톡 발송 실패 (${target.baseName}):`, err);
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
        console.error("발송 로그 저장 실패:", logError);
      }
    }

    const isFridayPreSend = isFriday && (satDay !== null || sunDay !== null);
    return NextResponse.json({
      message: isFridayPreSend
        ? `금요일 선발송 완료 (${todayStr} — 토:${satDateStr}, 일:${sunDateStr} 포함)`
        : `오전 10시 자동 발송 완료 (${todayStr})`,
      todayDay,
      dayOfWeek,
      isFridayPreSend,
      success,
      fail,
      total: targets.length,
      // 0원 제외 건수 — 관리자 UI 테스트 발송 결과 알림창에 표시됨
      skippedZero: zeroTuitionTargets.length,
      // 이번 달 납부 완료 수강생 제외 건수
      skippedAlreadyPaid: alreadyPaidTargets.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("Cron 알림톡 오류:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
