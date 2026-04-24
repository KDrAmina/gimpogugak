import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

export type UnpaidMember = {
  userId: string;
  name: string;
  phone: string;
  isAlimtalkEnabled: boolean;
  totalTuition: number;
  paymentDate: string | null;
  lessonIds: string[];
  categories: string[];
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, status").eq("id", user.id).single();
  if (profile?.role !== "admin" || profile?.status !== "active") {
    return NextResponse.json({ error: "관리자 권한 필요" }, { status: 403 });
  }

  // KST 이번 달 범위
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = kstNow.getUTCFullYear();
  const m = String(kstNow.getUTCMonth() + 1).padStart(2, "0");
  const currentMonthStart = `${y}-${m}-01`;

  // 활성 수강생 전체 조회
  const { data, error } = await supabase
    .from("lessons")
    .select(`id, user_id, category, tuition_amount, payment_date,
             profiles!inner(name, phone, status, is_alimtalk_enabled)`)
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as LessonRow[];
  const allLessonIds = rows.map(r => r.id);

  // 이번 달 납부 완료된 lesson_id 목록
  const paidLessonIds = new Set<string>();
  if (allLessonIds.length > 0) {
    const { data: paid } = await supabase
      .from("lesson_history")
      .select("lesson_id")
      .in("lesson_id", allLessonIds)
      .eq("status", "결제 완료")
      .gte("completed_date", currentMonthStart);
    (paid ?? []).forEach((r: { lesson_id: string }) => paidLessonIds.add(r.lesson_id));
  }

  // user별 그룹화
  const userMap = new Map<string, {
    userId: string;
    name: string;
    phone: string;
    isAlimtalkEnabled: boolean;
    totalTuition: number;
    paymentDate: string | null;
    lessonIds: string[];
    categories: string[];
    anyPaid: boolean;
  }>();

  for (const row of rows) {
    const p = row.profiles;
    if (p?.status !== "active" || !p.phone) continue;

    const uid = row.user_id;
    const isPaid = paidLessonIds.has(row.id);

    if (!userMap.has(uid)) {
      userMap.set(uid, {
        userId: uid,
        name: p.name,
        phone: p.phone,
        isAlimtalkEnabled: p.is_alimtalk_enabled !== false,
        totalTuition: 0,
        paymentDate: row.payment_date,
        lessonIds: [],
        categories: [],
        anyPaid: false,
      });
    }

    const entry = userMap.get(uid)!;
    entry.lessonIds.push(row.id);
    entry.totalTuition += row.tuition_amount ?? 0;
    if (row.category && !entry.categories.includes(row.category)) {
      entry.categories.push(row.category);
    }
    if (!entry.paymentDate) entry.paymentDate = row.payment_date;
    if (isPaid) entry.anyPaid = true;
  }

  // 미납 = 이번 달 납부 완료 기록 없음 + 수강료 > 0
  const unpaidMembers: UnpaidMember[] = [];
  for (const entry of userMap.values()) {
    if (!entry.anyPaid && entry.totalTuition > 0) {
      const { anyPaid: _anyPaid, ...rest } = entry;
      unpaidMembers.push(rest);
    }
  }

  unpaidMembers.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return NextResponse.json({ unpaidMembers, month: `${y}-${m}` });
}
