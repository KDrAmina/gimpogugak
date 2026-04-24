import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 말일 리마인드(독촉) 템플릿
const DEFAULT_PF_ID       = "KA01PF260331040320508LV0zMRKw5rq";
const DEFAULT_TEMPLATE_ID = "KA01TP260424035702323wmcDqS5jfvJ";

type Target = {
  name: string;
  phone: string;
  tuition: number;
  paymentDate: string | null;
  lessonIds?: string[];
};

export async function POST(req: NextRequest) {
  // 관리자 인증
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile?.status !== "active") {
    return NextResponse.json({ error: "관리자 권한 필요" }, { status: 403 });
  }

  const apiKey     = process.env.SOLAPI_API_KEY as string;
  const apiSecret  = process.env.SOLAPI_API_SECRET as string;
  const pfId       = process.env.SOLAPI_PF_ID ?? DEFAULT_PF_ID;
  const templateId = process.env.SOLAPI_TEMPLATE_ID_DUNNING ?? DEFAULT_TEMPLATE_ID;
  const senderPhone = process.env.SOLAPI_SENDER_PHONE as string;

  const missing: string[] = [];
  if (!apiKey)      missing.push("SOLAPI_API_KEY");
  if (!apiSecret)   missing.push("SOLAPI_API_SECRET");
  if (!senderPhone) missing.push("SOLAPI_SENDER_PHONE");
  if (missing.length > 0) {
    return NextResponse.json({ error: `환경변수 누락: ${missing.join(", ")}` }, { status: 500 });
  }

  // 계좌번호 조회
  let bankAccount = "";
  try {
    const { data: setting } = await supabase
      .from("settings").select("value").eq("key", "bank_account").single();
    bankAccount = setting?.value ?? "";
  } catch {
    // settings 테이블 미존재 시 무시
  }

  // KST 오늘 날짜
  const kstNow  = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;

  const body = await req.json();
  const { targets } = body as { targets: Target[] };
  if (!targets || targets.length === 0) {
    return NextResponse.json({ error: "발송 대상이 없습니다." }, { status: 400 });
  }

  // 오늘 이미 독촉 발송한 번호 확인
  const { data: sentToday } = await supabase
    .from("notification_log").select("phone")
    .eq("sent_date", todayStr).in("status", ["dunning_success"]);
  const alreadySentSet = new Set<string>(
    (sentToday ?? []).map((r: { phone: string }) => r.phone)
  );

  const { SolapiMessageService } = await import("solapi");
  const messageService = new SolapiMessageService(apiKey, apiSecret);

  let success = 0, fail = 0, skippedDuplicate = 0;
  const logs: { phone: string; name: string; status: string }[] = [];

  for (const target of targets) {
    const phone = target.phone.replace(/[^0-9]/g, "");
    if (phone.length < 10) {
      fail++;
      logs.push({ phone, name: target.name, status: "dunning_fail" });
      continue;
    }

    if (alreadySentSet.has(phone)) {
      skippedDuplicate++;
      continue;
    }

    let paymentDateStr = "-";
    if (target.paymentDate) {
      const d = new Date(target.paymentDate + "T00:00:00");
      paymentDateStr = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await messageService.sendOne({
        to: phone, from: senderPhone,
        kakaoOptions: {
          pfId, templateId,
          variables: {
            "#{이름}":    target.name,
            "#{수강료}":  target.tuition.toLocaleString("ko-KR"),
            "#{결제일}":  paymentDateStr,
            "#{계좌번호}": bankAccount,
          },
        },
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      success++;
      logs.push({ phone, name: target.name, status: "dunning_success" });
    } catch (err) {
      console.error(`[DUNNING] 발송 실패 (${target.name}):`, err);
      fail++;
      logs.push({ phone, name: target.name, status: "dunning_fail" });
    }
  }

  if (logs.length > 0) {
    await supabase.from("notification_log").insert(
      logs.map(l => ({
        phone: l.phone, name: l.name, status: l.status,
        sent_date: todayStr, type: "manual", created_at: new Date().toISOString(),
      }))
    );
  }

  return NextResponse.json({ success, fail, skippedDuplicate });
}
