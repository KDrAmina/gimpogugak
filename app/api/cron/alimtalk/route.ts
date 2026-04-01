import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Vercel Cron: 매일 KST 오전 10시(UTC 01:00) 실행
 * payment_date의 '일(Day)'이 오늘(KST)과 일치하는 활성 수강생에게 알림톡 자동 발송
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron 인증 헤더 검증
function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
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
  categories: string[];
  lessonIds: string[];
};

export async function GET(req: Request) {
  // Vercel Cron 인증 (프로덕션에서만)
  if (process.env.VERCEL && !verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 환경변수 런타임 로드 (함수 내부에서만 접근)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const apiKey = process.env.SOLAPI_API_KEY as string;
  const apiSecret = process.env.SOLAPI_API_SECRET as string;
  const pfId = process.env.SOLAPI_PF_ID as string;
  const templateId = process.env.SOLAPI_TEMPLATE_ID as string;
  const senderPhone = process.env.SOLAPI_SENDER_PHONE as string;

  console.log("크론 알림톡 환경변수 로드 상태:", { apiKey: !!apiKey, apiSecret: !!apiSecret, pfId: !!pfId, templateId: !!templateId, senderPhone: !!senderPhone, supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey });

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Supabase 환경변수 누락" },
      { status: 500 }
    );
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

  // KST 기준 오늘 날짜의 '일(Day)' 계산
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const todayDay = kstNow.getUTCDate();
  const todayStr = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;

  try {
    // 활성 수강생 중 payment_date가 있는 레슨 조회
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

    const rows = (data || []) as unknown as LessonRow[];

    // payment_date의 '일'이 오늘과 일치하는 수강생 필터 (수동 제외 대상 원천 차단)
    const todayTargets = rows.filter((r) => {
      if (!r.payment_date || !r.profiles?.phone || r.profiles.status !== "active") {
        return false;
      }
      if (r.profiles.is_alimtalk_enabled === false) {
        return false;
      }
      const payDay = new Date(r.payment_date + "T00:00:00").getDate();
      return payDay === todayDay;
    });

    if (todayTargets.length === 0) {
      return NextResponse.json({
        message: `오늘(${todayStr}) 발송 대상 없음`,
        sent: 0,
        todayDay,
      });
    }

    // 중복 발송 방지: 오늘 이미 발송된 수강생 확인
    const { data: sentToday } = await supabase
      .from("notification_log")
      .select("phone")
      .eq("sent_date", todayStr)
      .eq("type", "auto_cron");

    const alreadySentPhones = new Set(
      (sentToday || []).map((r: { phone: string }) => r.phone)
    );

    // 동일인물 그룹화 (이름 숫자 제거 + 연락처)
    const groupMap = new Map<string, GroupedTarget>();

    for (const row of todayTargets) {
      const rawName = row.profiles.name || "";
      const baseName = rawName.replace(/[0-9]/g, "").trim();
      const phone = row.profiles.phone || "";
      const key = `${baseName}__${phone}`;

      if (alreadySentPhones.has(phone)) continue;

      if (groupMap.has(key)) {
        const existing = groupMap.get(key)!;
        // 동일 lesson ID 중복 합산 방지
        if (!existing.lessonIds.includes(row.id)) {
          existing.totalTuition += row.tuition_amount || 0;
          existing.lessonIds.push(row.id);
        }
        if (row.category && !existing.categories.includes(row.category)) {
          existing.categories.push(row.category);
        }
      } else {
        groupMap.set(key, {
          baseName,
          phone,
          totalTuition: row.tuition_amount || 0,
          paymentDate: row.payment_date,
          categories: row.category ? [row.category] : [],
          lessonIds: [row.id],
        });
      }
    }

    // 수강료 0원 이하인 대상 제외
    const targets = Array.from(groupMap.values()).filter(
      (t) => t.totalTuition > 0
    );

    if (targets.length === 0) {
      return NextResponse.json({
        message: `오늘(${todayStr}) 발송 대상은 있으나 모두 발송 완료`,
        sent: 0,
        todayDay,
      });
    }

    // Solapi SDK 동적 import
    const { SolapiMessageService } = await import("solapi");
    const messageService = new SolapiMessageService(apiKey, apiSecret);

    let success = 0;
    let fail = 0;
    const logs: { phone: string; name: string; status: string }[] = [];

    for (const target of targets) {
      const phone = target.phone.replace(/[^0-9]/g, "");
      if (phone.length < 10) {
        fail++;
        logs.push({ phone, name: target.baseName, status: "invalid_phone" });
        continue;
      }

      let paymentDateStr = "-";
      if (target.paymentDate) {
        const d = new Date(target.paymentDate + "T00:00:00");
        paymentDateStr = `${d.getMonth() + 1}월 ${d.getDate()}일`;
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
              "#{결제일}": paymentDateStr,
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        success++;
        logs.push({ phone, name: target.baseName, status: "success" });
      } catch (err) {
        console.error(`알림톡 발송 실패 (${target.baseName}):`, err);
        fail++;
        logs.push({ phone, name: target.baseName, status: "fail" });
      }
    }

    // notification_log에 발송 기록 저장
    const logInserts = logs.map((l) => ({
      phone: l.phone,
      name: l.name,
      status: l.status,
      sent_date: todayStr,
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

    return NextResponse.json({
      message: `자동 발송 완료 (${todayStr})`,
      todayDay,
      success,
      fail,
      total: targets.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("Cron 알림톡 오류:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
