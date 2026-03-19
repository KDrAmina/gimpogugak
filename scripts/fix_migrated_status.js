/**
 * 마이그레이션으로 생성된 프로필을 모두 inactive로 변경
 *
 * 식별 기준: email이 '@migration.local'로 끝나는 계정
 * 기존 DB 인원(37명)은 절대 변경하지 않음
 *
 * 실행: node scripts/fix_migrated_status.js
 */

const fs = require("fs");
const path = require("path");

// .env.local 로드
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
}

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // 1. 전체 프로필 조회
  const { data: allProfiles, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, name, email, phone, status");

  if (fetchErr) {
    console.error("❌ 프로필 조회 실패:", fetchErr.message);
    process.exit(1);
  }

  // 2. 마이그레이션 프로필 vs 기존 프로필 분류
  const migrated = allProfiles.filter(
    (p) => p.email && p.email.endsWith("@migration.local")
  );
  const existing = allProfiles.filter(
    (p) => !p.email || !p.email.endsWith("@migration.local")
  );

  console.log(`📊 전체 프로필: ${allProfiles.length}명`);
  console.log(`  기존 인원: ${existing.length}명 (변경 없음)`);
  console.log(`  마이그레이션 인원: ${migrated.length}명`);

  // 기존 인원 상태 확인 (안전 점검)
  const existingActive = existing.filter((p) => p.status === "active");
  console.log(`  기존 active: ${existingActive.length}명 → 유지`);

  // 3. 마이그레이션 프로필 중 아직 inactive가 아닌 것만 업데이트
  const toFix = migrated.filter((p) => p.status !== "inactive");
  console.log(`\n🔧 수정 대상: ${toFix.length}명 (현재 inactive 아닌 마이그레이션 프로필)`);

  if (toFix.length === 0) {
    console.log("✅ 이미 모두 inactive입니다. 수정할 것 없음.");
    return;
  }

  // 상태별 현황
  const statusCounts = {};
  for (const p of toFix) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }
  console.log("  현재 상태 분포:", statusCounts);

  // 4. 일괄 업데이트 (마이그레이션 프로필 ID 목록)
  const ids = toFix.map((p) => p.id);

  const { data: updated, error: updateErr } = await supabase
    .from("profiles")
    .update({ status: "inactive" })
    .in("id", ids)
    .select("id, name, status");

  if (updateErr) {
    console.error("❌ 업데이트 실패:", updateErr.message);
    process.exit(1);
  }

  console.log(`\n✅ ${updated.length}명 → inactive 변경 완료`);

  // 5. 변경된 학생 목록
  for (const p of updated) {
    console.log(`  ${p.name} → ${p.status}`);
  }

  // 6. 최종 확인 — 기존 인원 상태 재검증
  const { data: verify } = await supabase
    .from("profiles")
    .select("id, name, status")
    .not("email", "like", "%@migration.local");

  const verifyActive = (verify || []).filter((p) => p.status === "active");
  console.log(`\n🔒 기존 인원 검증: ${verifyActive.length}명 active 유지 (변경 전 ${existingActive.length}명)`);
  if (verifyActive.length === existingActive.length) {
    console.log("✅ 기존 인원 상태 보존 확인 완료");
  } else {
    console.error("⚠️  기존 인원 수가 변경됨! 확인 필요!");
  }
}

main().catch((err) => {
  console.error("❌ 예상치 못한 오류:", err);
  process.exit(1);
});
