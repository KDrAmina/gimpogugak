import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Target = {
  name: string;
  phone: string;
  tuition: number;
  paymentDate: string | null;
};

export async function POST(req: NextRequest) {
  // 관리자 인증 확인
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile?.status !== "active") {
    return NextResponse.json({ error: "관리자 권한 필요" }, { status: 403 });
  }

  // 환경변수 런타임 로드 (함수 내부에서만 접근)
  const apiKey = process.env.SOLAPI_API_KEY as string;
  const apiSecret = process.env.SOLAPI_API_SECRET as string;
  const pfId = process.env.SOLAPI_PF_ID as string;
  const templateId = process.env.SOLAPI_TEMPLATE_ID as string;
  const senderPhone = process.env.SOLAPI_SENDER_PHONE as string;

  console.log("알림톡 환경변수 로드 상태:", { apiKey: !!apiKey, apiSecret: !!apiSecret, pfId: !!pfId, templateId: !!templateId, senderPhone: !!senderPhone });

  const missing: string[] = [];
  if (!apiKey) missing.push("SOLAPI_API_KEY");
  if (!apiSecret) missing.push("SOLAPI_API_SECRET");
  if (!pfId) missing.push("SOLAPI_PF_ID");
  if (!templateId) missing.push("SOLAPI_TEMPLATE_ID");
  if (!senderPhone) missing.push("SOLAPI_SENDER_PHONE");

  if (missing.length > 0) {
    console.error("Solapi 환경변수 누락:", missing.join(", "));
    return NextResponse.json(
      { error: `발송 오류: ${missing.join(", ")} 가 누락되었습니다.` },
      { status: 500 }
    );
  }

  // KST 오늘 날짜 (notification_log sent_date 기록용)
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;

  try {
    const body = await req.json();
    const { targets, scheduledDate } = body as {
      targets: Target[];
      scheduledDate: string | null;
    };

    if (!targets || targets.length === 0) {
      return NextResponse.json({ error: "발송 대상이 없습니다." }, { status: 400 });
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
        logs.push({ phone, name: target.name, status: "manual_fail" });
        continue;
      }

      // 결제일 포맷: MM월 DD일
      let paymentDateStr = "-";
      if (target.paymentDate) {
        const d = new Date(target.paymentDate + "T00:00:00");
        paymentDateStr = `${d.getMonth() + 1}월 ${d.getDate()}일`;
      }

      const messageParams: {
        to: string;
        from: string;
        kakaoOptions: Record<string, unknown>;
        scheduledDate?: string;
      } = {
        to: phone,
        from: senderPhone,
        kakaoOptions: {
          pfId,
          templateId,
          variables: {
            "#{이름}": target.name,
            "#{수강료}": target.tuition.toLocaleString("ko-KR"),
            "#{결제일}": paymentDateStr,
          },
        },
      };

      // 예약 발송: KST → ISO 변환
      if (scheduledDate) {
        const kstDate = new Date(scheduledDate);
        messageParams.scheduledDate = kstDate.toISOString();
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await messageService.sendOne(messageParams as any);
        success++;
        logs.push({ phone, name: target.name, status: "manual_success" });
      } catch (err) {
        console.error(`알림톡 발송 실패 (${target.name}):`, err);
        fail++;
        logs.push({ phone, name: target.name, status: "manual_fail" });
      }
    }

    // 수동 발송 기록을 notification_log에 INSERT (예약 발송은 즉시 기록)
    if (logs.length > 0 && !scheduledDate) {
      const logInserts = logs.map((l) => ({
        phone: l.phone,
        name: l.name,
        status: l.status,
        sent_date: todayStr,
        type: "manual",
        created_at: new Date().toISOString(),
      }));
      const { error: logError } = await supabase
        .from("notification_log")
        .insert(logInserts);
      if (logError) console.error("수동 발송 로그 저장 실패:", logError);
    }

    return NextResponse.json({ success, fail });
  } catch (err: any) {
    console.error("알림톡 API 오류:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 }
    );
  }
}
