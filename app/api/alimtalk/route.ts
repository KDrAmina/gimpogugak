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

  // 환경변수 체크 — 정적 접근 (Next.js 빌드 타임 치환 필수)
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const pfId = process.env.SOLAPI_PF_ID;
  const templateId = process.env.SOLAPI_TEMPLATE_ID;
  const senderPhone = process.env.SOLAPI_SENDER_PHONE;

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

    for (const target of targets) {
      const phone = target.phone.replace(/[^0-9]/g, "");
      if (phone.length < 10) {
        fail++;
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
            "#{수강료}": target.tuition.toLocaleString(),
            "#{결제일}": paymentDateStr,
          },
        },
      };

      // 예약 발송: KST → ISO 변환
      if (scheduledDate) {
        // scheduledDate는 "YYYY-MM-DDTHH:mm" 형식 (사용자 로컬, KST 기준)
        const kstDate = new Date(scheduledDate);
        messageParams.scheduledDate = kstDate.toISOString();
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await messageService.sendOne(messageParams as any);
        success++;
      } catch (err) {
        console.error(`알림톡 발송 실패 (${target.name}):`, err);
        fail++;
      }
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
