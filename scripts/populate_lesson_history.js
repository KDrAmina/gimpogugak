/**
 * v4.5 — 마이그레이션 lesson_history 생성
 *
 * migration_preview.json의 payment_history →
 * lesson_history 테이블에 INSERT (캘린더에 표시되도록)
 *
 * 매핑:
 *   payment_history[].payment_date  → lesson_history.completed_date
 *   payment_history[].amount        → (참고용, 실제 컬럼 없음)
 *   순번(1,2,3...)                  → lesson_history.session_number
 *   "결제 완료"                     → lesson_history.status
 *
 * 실행: node scripts/populate_lesson_history.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");

// .env.local 로드
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DRY_RUN = process.argv.includes("--dry-run");
const PREVIEW_PATH = path.join(__dirname, "..", "migration_preview.json");

async function main() {
  if (DRY_RUN) console.log("🔍 DRY RUN 모드\n");

  // 1. Preview 로드
  const preview = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf-8"));
  const students = preview.students;

  // 2. DB에서 마이그레이션 프로필 + lessons 조회
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email, phone")
    .like("email", "%@migration.local");

  const profileMap = new Map();
  for (const p of profiles) {
    profileMap.set(p.name, p);
    if (p.phone) profileMap.set(p.phone, p);
  }

  console.log(`📊 마이그레이션 프로필: ${profiles.length}명`);

  // 모든 마이그레이션 lessons 조회
  const migratedIds = profiles.map((p) => p.id);
  const { data: allLessons } = await supabase
    .from("lessons")
    .select("id, user_id, category")
    .in("user_id", migratedIds);

  console.log(`📊 마이그레이션 lessons: ${allLessons.length}건`);

  // lessons를 user_id + category로 인덱싱
  const lessonMap = new Map();
  for (const l of allLessons) {
    const key = `${l.user_id}:${l.category}`;
    lessonMap.set(key, l);
  }

  // 3. 기존 lesson_history 중 마이그레이션 lessons에 속하는 것 확인
  const migratedLessonIds = allLessons.map((l) => l.id);
  const { data: existingHistory } = await supabase
    .from("lesson_history")
    .select("id, lesson_id, completed_date")
    .in("lesson_id", migratedLessonIds.length > 0 ? migratedLessonIds : ["__none__"]);

  const existingSet = new Set(
    (existingHistory || []).map((h) => `${h.lesson_id}:${h.completed_date}`)
  );
  console.log(`📊 기존 lesson_history (마이그레이션): ${(existingHistory || []).length}건`);

  // 4. payment_history → lesson_history INSERT 준비
  const inserts = [];
  let skipped = 0;
  let noLesson = 0;

  for (const student of students) {
    const { profile, lessons: studentLessons, payment_history } = student;
    if (!payment_history || payment_history.length === 0) continue;

    // 프로필 찾기
    const dbProfile =
      profileMap.get(profile.name) ||
      (profile.phone && profileMap.get(profile.phone));

    if (!dbProfile) continue; // 기존 인원은 건너뜀

    // 해당 프로필의 첫 번째 lesson 사용 (카테고리 매칭 시도)
    const userLessons = allLessons.filter((l) => l.user_id === dbProfile.id);
    if (userLessons.length === 0) {
      noLesson++;
      continue;
    }

    // 결제 내역을 시간순으로 정렬
    const sortedPayments = [...payment_history].sort((a, b) =>
      a.payment_date.localeCompare(b.payment_date)
    );

    // 첫 번째 lesson에 매핑 (카테고리가 여러 개면 첫 번째)
    const primaryLesson = userLessons[0];

    for (let idx = 0; idx < sortedPayments.length; idx++) {
      const p = sortedPayments[idx];
      const completedDate = p.payment_date;

      // 날짜 유효성 검사 (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(completedDate)) continue;

      // 중복 방지
      const dupKey = `${primaryLesson.id}:${completedDate}`;
      if (existingSet.has(dupKey)) {
        skipped++;
        continue;
      }
      existingSet.add(dupKey);

      inserts.push({
        lesson_id: primaryLesson.id,
        session_number: idx + 1,
        completed_date: completedDate,
        status: "결제 완료",
      });
    }
  }

  console.log(`\n📋 INSERT 예정: ${inserts.length}건`);
  console.log(`  건너뜀 (중복): ${skipped}건`);
  console.log(`  lesson 없음: ${noLesson}명`);

  if (inserts.length === 0) {
    console.log("ℹ️  삽입할 데이터 없음.");
    return;
  }

  // 연도별 분포
  const yearDist = {};
  for (const ins of inserts) {
    const y = ins.completed_date.slice(0, 4);
    yearDist[y] = (yearDist[y] || 0) + 1;
  }
  console.log("  연도별:", yearDist);

  if (DRY_RUN) {
    console.log("\n🔍 DRY RUN 완료. 실제 반영하려면 --dry-run 없이 실행하세요.");
    // 샘플 출력
    console.log("\n샘플 (처음 10건):");
    for (const ins of inserts.slice(0, 10)) {
      console.log(`  lesson_id: ${ins.lesson_id.slice(0, 8)}... | ${ins.completed_date} | #${ins.session_number} | ${ins.status}`);
    }
    return;
  }

  // 5. 배치 INSERT (50건씩)
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("lesson_history").insert(batch);

    if (error) {
      console.error(`  ❌ 배치 ${Math.floor(i / BATCH_SIZE) + 1} 실패:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\n✅ 삽입 완료: ${inserted}건 (오류: ${errors}건)`);

  // 6. 검증 — 2024년 데이터 확인
  const { data: verify2024 } = await supabase
    .from("lesson_history")
    .select("id, completed_date, status, lessons(category, profiles(name))")
    .gte("completed_date", "2024-01-01")
    .lte("completed_date", "2024-12-31")
    .limit(10);

  console.log(`\n📅 2024년 lesson_history 검증 (최대 10건):`);
  if (verify2024 && verify2024.length > 0) {
    for (const h of verify2024) {
      const name = h.lessons?.profiles?.name || "?";
      const cat = h.lessons?.category || "?";
      console.log(`  ${h.completed_date} | ${name} | ${cat} | ${h.status}`);
    }
  } else {
    console.log("  ⚠️  2024년 데이터 없음");
  }
}

main().catch((err) => {
  console.error("❌ 오류:", err);
  process.exit(1);
});
