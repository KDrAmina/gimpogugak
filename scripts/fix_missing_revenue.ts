/**
 * 누락 수입 수동 보정 스크립트
 * 
 * [문제 원인]
 * 1. 윤미호(성인개인 20만원) - 24년 3~6월 이력이 마이그레이션에서 누락됨
 *    - 기존 DB에 성인단체(5만) 수업만 있었고, 성인개인(20만) 수업이 없었음
 *    - 누락: 3월 20만, 4월 20만, 5월 20만, 6월 20만
 *
 * 2. 유지연(성인개인 80만) - 25년 3월 이력 누락
 *    - 마이그레이션이 payments[0](2월)만 처리하고 3월(payments[1]) 누락
 *    - 누락: 3월 80만
 *
 * 3. 고인경(성인단체 10만) - 25년 3월 프로필+수업+이력 전부 없음
 *    - 엑셀에는 있지만 마이그레이션에서 완전히 누락됨
 *    - 누락: 3월 10만
 *
 * [기대 결과]
 * 24년 3월: 395만 → 415만 (+20만)
 * 24년 4월: 616만 → 636만 (+20만)
 * 24년 5월: 361만 → 381만 (+20만)
 * 24년 6월: 332만 → 352만 (+20만)
 * 25년 3월: 327만 → 417만 (+90만)
 */

import * as fs from "fs";
import * as path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DRY_RUN = process.argv.includes("--dry-run");

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(DRY_RUN ? "[DRY-RUN]" : "[LIVE]", "누락 수입 보정 시작");

  // ── 1. 윤미호 성인개인 20만원 수업 생성 및 3~6월 이력 삽입 ──────────────────
  console.log("\n[1] 윤미호 성인개인(20만) 수업 생성 + 24년 3~6월 이력 삽입...");
  
  const YUNMIHO_PROFILE_ID = "aa9a17a4-add1-44aa-aef0-3ae558036724";
  
  // 기존에 성인개인 20만 수업이 있는지 확인
  const { data: existingLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("user_id", YUNMIHO_PROFILE_ID)
    .eq("category", "성인개인")
    .maybeSingle();
  
  let lessonId: string;
  if (existingLesson) {
    lessonId = existingLesson.id;
    console.log("  ✅ 기존 성인개인 수업 재사용:", lessonId.slice(0,8)+"...");
  } else {
    if (!DRY_RUN) {
      const { data: newLesson, error } = await supabase
        .from("lessons")
        .insert({
          user_id: YUNMIHO_PROFILE_ID,
          category: "성인개인",
          tuition_amount: 200000,
          is_active: false,
          payment_date: "2024-03-09",
          current_session: 4,
        })
        .select("id")
        .single();
      if (error) { console.error("  ❌ 수업 생성 실패:", error.message); process.exit(1); }
      lessonId = newLesson.id;
      console.log("  ✅ 성인개인 수업 생성:", lessonId.slice(0,8)+"...");
    } else {
      lessonId = "dry-run-lesson-id";
      console.log("  [dry] 성인개인 수업 생성 예정");
    }
  }

  // 3~6월 이력 삽입
  const yunmihoEntries = [
    { completed_date: "2024-03-09", tuition_snapshot: 200000 },
    { completed_date: "2024-04-20", tuition_snapshot: 200000 },
    { completed_date: "2024-05-31", tuition_snapshot: 200000 },
    { completed_date: "2024-06-29", tuition_snapshot: 200000 },
  ];

  for (const entry of yunmihoEntries) {
    // 이미 있는지 확인
    const { data: existing } = await supabase
      .from("lesson_history")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("completed_date", entry.completed_date)
      .maybeSingle();
    
    if (existing) {
      console.log("  ⏭️  이미 존재 스킵:", entry.completed_date);
      continue;
    }

    if (!DRY_RUN) {
      const { error } = await supabase.from("lesson_history").insert({
        lesson_id: lessonId,
        session_number: 0,
        completed_date: entry.completed_date,
        tuition_snapshot: entry.tuition_snapshot,
        prepaid_month: null,
        status: "결제 완료",
      });
      if (error) { console.error("  ❌ 이력 삽입 실패:", entry.completed_date, error.message); }
      else { console.log("  ✅ 삽입:", entry.completed_date, entry.tuition_snapshot); }
    } else {
      console.log("  [dry] 삽입 예정:", entry.completed_date, entry.tuition_snapshot);
    }
  }

  // ── 2. 유지연 25년 3월 이력 삽입 ─────────────────────────────────────────
  console.log("\n[2] 유지연 25년 3월(80만) 이력 삽입...");
  const YOOJIYEON_LESSON_ID = "9e380b5e-a7af-496a-926c-7e3ffae7d687";

  const { data: existingYJ } = await supabase
    .from("lesson_history")
    .select("id")
    .eq("lesson_id", YOOJIYEON_LESSON_ID)
    .eq("completed_date", "2025-03-08")
    .maybeSingle();

  if (existingYJ) {
    console.log("  ⏭️  이미 존재, 스킵");
  } else if (!DRY_RUN) {
    const { error } = await supabase.from("lesson_history").insert({
      lesson_id: YOOJIYEON_LESSON_ID,
      session_number: 0,
      completed_date: "2025-03-08",
      tuition_snapshot: 800000,
      prepaid_month: null,
      status: "결제 완료",
    });
    if (error) { console.error("  ❌ 유지연 3월 삽입 실패:", error.message); }
    else { console.log("  ✅ 유지연 2025-03-08 800000 삽입 완료"); }
  } else {
    console.log("  [dry] 유지연 2025-03-08 800000 삽입 예정");
  }

  // ── 3. 고인경 프로필+수업+이력 생성 ──────────────────────────────────────
  console.log("\n[3] 고인경 프로필/수업/이력 생성...");

  const { data: existingGoinkyung } = await supabase
    .from("profiles")
    .select("id")
    .eq("name", "고인경")
    .maybeSingle();

  let goinkyungProfileId: string;
  if (existingGoinkyung) {
    goinkyungProfileId = existingGoinkyung.id;
    console.log("  ✅ 기존 프로필 재사용:", goinkyungProfileId.slice(0,8)+"...");
  } else {
    if (!DRY_RUN) {
      // auth user 생성
      const email = "goinkyung_2025@migrate.local";
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: Math.random().toString(36).slice(2) + "Aa1!",
        email_confirm: true,
      });
      if (authErr) { console.error("  ❌ auth 생성 실패:", authErr.message); process.exit(1); }
      goinkyungProfileId = authData.user.id;

      // profiles 생성
      const { error: profErr } = await supabase.from("profiles").upsert({
        id: goinkyungProfileId,
        name: "고인경",
        phone: null,
        role: "user",
        status: "active",
        email,
      }, { onConflict: "id" });
      if (profErr) { console.error("  ❌ profile 생성 실패:", profErr.message); }
      else { console.log("  ✅ 고인경 프로필 생성:", goinkyungProfileId.slice(0,8)+"..."); }
    } else {
      goinkyungProfileId = "dry-run-goinkyung-id";
      console.log("  [dry] 고인경 프로필 생성 예정");
    }
  }

  // 수업 생성
  const { data: existingGKLesson } = await supabase
    .from("lessons")
    .select("id")
    .eq("user_id", goinkyungProfileId)
    .eq("category", "성인단체")
    .maybeSingle();

  let gkLessonId: string;
  if (existingGKLesson) {
    gkLessonId = existingGKLesson.id;
    console.log("  ✅ 기존 수업 재사용");
  } else if (!DRY_RUN) {
    const { data: gkLesson, error: gkErr } = await supabase
      .from("lessons")
      .insert({
        user_id: goinkyungProfileId,
        category: "성인단체",
        tuition_amount: 100000,
        is_active: false,
        payment_date: "2025-03-16",
        current_session: 1,
      })
      .select("id")
      .single();
    if (gkErr) { console.error("  ❌ 수업 생성 실패:", gkErr.message); process.exit(1); }
    gkLessonId = gkLesson.id;
    console.log("  ✅ 고인경 수업 생성:", gkLessonId.slice(0,8)+"...");
  } else {
    gkLessonId = "dry-run-gk-lesson-id";
    console.log("  [dry] 고인경 수업 생성 예정");
  }

  // lesson_history 삽입
  const { data: existingGKHist } = await supabase
    .from("lesson_history")
    .select("id")
    .eq("lesson_id", gkLessonId)
    .eq("completed_date", "2025-03-16")
    .maybeSingle();

  if (existingGKHist) {
    console.log("  ⏭️  이미 존재, 스킵");
  } else if (!DRY_RUN) {
    const { error } = await supabase.from("lesson_history").insert({
      lesson_id: gkLessonId,
      session_number: 0,
      completed_date: "2025-03-16",
      tuition_snapshot: 100000,
      prepaid_month: null,
      status: "결제 완료",
    });
    if (error) { console.error("  ❌ 고인경 3월 삽입 실패:", error.message); }
    else { console.log("  ✅ 고인경 2025-03-16 100000 삽입 완료"); }
  } else {
    console.log("  [dry] 고인경 2025-03-16 100000 삽입 예정");
  }

  // ── 4. 결과 확인 ──────────────────────────────────────────────────────────
  console.log("\n[결과 확인]");
  if (!DRY_RUN) {
    const months = [
      { key: "2024-03", start: "2024-03-01", end: "2024-04-01" },
      { key: "2024-04", start: "2024-04-01", end: "2024-05-01" },
      { key: "2024-05", start: "2024-05-01", end: "2024-06-01" },
      { key: "2024-06", start: "2024-06-01", end: "2024-07-01" },
      { key: "2025-03", start: "2025-03-01", end: "2025-04-01" },
    ];
    for (const m of months) {
      const { data: r1 } = await supabase
        .from("lesson_history")
        .select("tuition_snapshot, lessons!inner(tuition_amount)")
        .gte("completed_date", m.start)
        .lt("completed_date", m.end)
        .is("prepaid_month", null)
        .eq("status", "결제 완료");
      const { data: r2 } = await supabase
        .from("lesson_history")
        .select("tuition_snapshot, lessons!inner(tuition_amount)")
        .eq("prepaid_month", m.key)
        .eq("status", "결제 완료");
      const all = [...(r1||[]), ...(r2||[])];
      const sum = all.reduce((s, r) => s + (r.tuition_snapshot > 0 ? r.tuition_snapshot : (r.lessons as any)?.tuition_amount || 0), 0);
      console.log("  "+m.key+": "+sum+"원 ("+sum/10000+"만원)");
    }
  }

  console.log("\n완료!");
}

main().catch(console.error);