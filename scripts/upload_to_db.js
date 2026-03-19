/**
 * migration_preview.json → Supabase DB 업로드 스크립트
 *
 * 실행 전 반드시:
 * 1. migration_preview.json 을 직접 열어서 데이터를 검증하세요
 * 2. .env.local 에 SUPABASE_SERVICE_ROLE_KEY 를 추가하세요
 *    (Admin API 접근용 — NEXT_PUBLIC_ 접두사 없이)
 *
 * 실행: node scripts/upload_to_db.js [--dry-run]
 *
 * --dry-run: 실제 DB 변경 없이 어떤 작업이 수행될지 출력만 합니다
 */

const fs = require("fs");
const path = require("path");

// .env.local 수동 로드
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  }
}

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요"
  );
  console.error("   .env.local 에 SUPABASE_SERVICE_ROLE_KEY 를 추가하세요.");
  console.error(
    "   (Supabase Dashboard → Settings → API → service_role key)"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = process.argv.includes("--dry-run");
const PREVIEW_PATH = path.join(__dirname, "..", "migration_preview.json");

async function main() {
  if (DRY_RUN) {
    console.log("🔍 DRY RUN 모드 — 실제 DB 변경 없음\n");
  }

  // 1. Preview 파일 로드
  if (!fs.existsSync(PREVIEW_PATH)) {
    console.error("❌ migration_preview.json 파일이 없습니다.");
    console.error("   먼저 node scripts/migrate_members.js 를 실행하세요.");
    process.exit(1);
  }

  const preview = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf-8"));
  // 복수이름 분리는 migrate_members.js 에서 이미 처리됨
  const students = preview.students;
  console.log(`📋 마이그레이션 대상: ${students.length}명\n`);

  // 2. 기존 profiles 조회 (전화번호 기준 중복 방지)
  let existingByPhone = new Map();
  let existingByName = new Map();

  if (!DRY_RUN) {
    const { data: existingProfiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, name, phone, email");

    if (profileErr) {
      console.error("❌ profiles 조회 실패:", profileErr.message);
      process.exit(1);
    }

    for (const p of existingProfiles || []) {
      if (p.phone) existingByPhone.set(p.phone, p);
      existingByName.set(p.name, p);
    }
    console.log(`📊 기존 DB profiles: ${(existingProfiles || []).length}명\n`);
  }

  // 통계
  const stats = {
    profiles_created: 0,
    profiles_skipped: 0,
    lessons_created: 0,
    lessons_skipped: 0,
    errors: [],
  };

  // 3. 학생별 처리
  for (const student of students) {
    const { profile, lessons } = student;
    const logPrefix = `[${profile.name}]`;

    // ── 3a. 프로필 처리 ──
    let profileId = null;

    if (!DRY_RUN) {
      // 기존 프로필 찾기
      const existingProfile =
        (profile.phone && existingByPhone.get(profile.phone)) ||
        existingByName.get(profile.name);

      if (existingProfile) {
        profileId = existingProfile.id;
        console.log(
          `  ⏭️  ${logPrefix} 기존 프로필 발견 (${existingProfile.email || existingProfile.phone}) → 건너뜀`
        );
        stats.profiles_skipped++;
      } else {
        // auth user 생성 → profile 업데이트
        const dummyEmail = `migrated_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@migration.local`;
        const { data: authUser, error: authErr } =
          await supabase.auth.admin.createUser({
            email: dummyEmail,
            password: `Migrated!${Math.random().toString(36).slice(2, 14)}`,
            email_confirm: true,
            user_metadata: { name: profile.name, migrated: true },
          });

        if (authErr) {
          console.error(`  ❌ ${logPrefix} auth user 생성 실패:`, authErr.message);
          stats.errors.push({ name: profile.name, error: authErr.message });
          continue; // 프로필 없으면 lesson도 불가
        }

        profileId = authUser.user.id;

        const { error: updateErr } = await supabase
          .from("profiles")
          .update({
            name: profile.name,
            phone: profile.phone,
            role: "user",
            status: profile.status,
          })
          .eq("id", profileId);

        if (updateErr) {
          console.error(`  ❌ ${logPrefix} profile 업데이트 실패:`, updateErr.message);
          stats.errors.push({ name: profile.name, error: updateErr.message });
          continue;
        }

        console.log(
          `  ✅ ${logPrefix} 프로필 생성 (id: ${profileId.slice(0, 8)}..., status: ${profile.status})`
        );
        stats.profiles_created++;

        // 캐시 갱신 (같은 전화번호의 후속 학생이 중복 생성되지 않도록)
        if (profile.phone) existingByPhone.set(profile.phone, { id: profileId, ...profile });
        existingByName.set(profile.name, { id: profileId, ...profile });
      }
    } else {
      // DRY RUN: 프로필 시뮬레이션
      console.log(
        `  ➕ ${logPrefix} 프로필 생성 예정 (phone: ${profile.phone || "없음"}, status: ${profile.status})`
      );
      stats.profiles_created++;
    }

    // ── 3b. Lesson 처리 (dry-run에서도 카운트) ──
    for (const lesson of lessons) {
      if (!DRY_RUN) {
        // 기존 lesson 확인
        const { data: existingLesson } = await supabase
          .from("lessons")
          .select("id")
          .eq("user_id", profileId)
          .eq("category", lesson.category)
          .maybeSingle();

        if (existingLesson) {
          console.log(`    ⏭️  ${logPrefix} 수업 [${lesson.category}] 이미 존재 → 건너뜀`);
          stats.lessons_skipped++;
          continue;
        }

        const { error: lessonErr } = await supabase.from("lessons").insert({
          user_id: profileId,
          category: lesson.category,
          tuition_amount: lesson.tuition_amount,
          is_active: lesson.is_active,
          payment_date: lesson.payment_date,
          current_session: 0,
        });

        if (lessonErr) {
          console.error(`    ❌ ${logPrefix} 수업 [${lesson.category}] 생성 실패:`, lessonErr.message);
          stats.errors.push({ name: profile.name, category: lesson.category, error: lessonErr.message });
          continue;
        }

        console.log(
          `    ✅ ${logPrefix} 수업 [${lesson.category}] 생성 (₩${lesson.tuition_amount.toLocaleString()}, active: ${lesson.is_active})`
        );
      } else {
        // DRY RUN: 수업 시뮬레이션
        console.log(
          `    📝 ${logPrefix} 수업 [${lesson.category}] 생성 예정 (₩${lesson.tuition_amount.toLocaleString()}, active: ${lesson.is_active})`
        );
      }
      stats.lessons_created++;
    }
  }

  // 4. 결과 요약
  console.log("\n" + "=".repeat(50));
  console.log("📊 마이그레이션 결과");
  console.log("=".repeat(50));
  console.log(`  프로필 생성: ${stats.profiles_created}`);
  console.log(`  프로필 건너뜀 (이미 존재): ${stats.profiles_skipped}`);
  console.log(`  수업 생성: ${stats.lessons_created}`);
  if (stats.lessons_skipped > 0) {
    console.log(`  수업 건너뜀 (이미 존재): ${stats.lessons_skipped}`);
  }
  if (stats.errors.length > 0) {
    console.log(`  ❌ 오류: ${stats.errors.length}건`);
    for (const err of stats.errors) {
      console.log(`    - ${err.name}: ${err.error}`);
    }
  }
  if (DRY_RUN) {
    console.log(
      "\n🔍 DRY RUN 완료. 실제 반영하려면 --dry-run 없이 실행하세요."
    );
  }
}

main().catch((err) => {
  console.error("❌ 예상치 못한 오류:", err);
  process.exit(1);
});
