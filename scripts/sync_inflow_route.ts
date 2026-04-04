/**
 * 수강생 유입경로(inflow_route) Upsert 스크립트
 *
 * 소스: cleaned_inflow_data.csv (이름, 전화번호, 카테고리, 유입경로)
 * 대상: profiles 테이블 inflow_route 컬럼
 * 키:   이름 + 전화번호 (전화번호 없으면 이름만)
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/sync_inflow_route.ts
 *   npx ts-node --project scripts/tsconfig.json scripts/sync_inflow_route.ts --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── 환경변수 로드 ──
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
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL 또는 SERVICE_ROLE_KEY 누락");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = process.argv.includes("--dry-run");

// CSV 경로 (작업 폴더 우선, 없으면 Desktop)
const CSV_PATHS = [
  path.join(__dirname, "..", "cleaned_inflow_data.csv"),
  path.join("C:\\Users\\JUN\\Desktop", "cleaned_inflow_data.csv"),
];

interface CsvRow {
  name: string;
  phone: string;
  category: string;
  inflow: string;
}

// ── CSV 파싱 ──
function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const lines = content.split(/\r?\n/).filter(Boolean);
  lines.shift(); // 헤더 제거

  return lines.map((line) => {
    // 이름이 따옴표로 감싸진 경우 처리 (예: "아름,다움")
    let name = "", rest = line;
    if (line.startsWith('"')) {
      const closeIdx = line.indexOf('"', 1);
      name = line.slice(1, closeIdx);
      rest = line.slice(closeIdx + 2); // skip closing " and comma
    } else {
      const commaIdx = line.indexOf(",");
      name = line.slice(0, commaIdx);
      rest = line.slice(commaIdx + 1);
    }

    const parts = rest.split(",");
    const phone  = (parts[0] ?? "").trim();
    const category = (parts[1] ?? "").trim();
    const inflow = (parts[2] ?? "").trim();
    return { name: name.trim(), phone, category, inflow };
  }).filter((r) => r.name);
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" 수강생 유입경로 → Supabase profiles Upsert");
  if (DRY_RUN) console.log(" (DRY RUN)");
  console.log("═══════════════════════════════════════════\n");

  // CSV 찾기
  const csvPath = CSV_PATHS.find((p) => fs.existsSync(p));
  if (!csvPath) {
    console.error("❌ cleaned_inflow_data.csv 없음 (작업 폴더 또는 Desktop 확인)");
    process.exit(1);
  }
  const csvRows = parseCsv(csvPath);
  console.log(`📋 CSV 로드: ${csvPath}`);
  console.log(`  총 ${csvRows.length}건\n`);

  // ── profiles 전체 로드 ──
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, name, phone, inflow_route");

  if (profErr) {
    // inflow_route 컬럼이 없을 때 → 컬럼 추가 안내 후 종료
    if (profErr.message.includes("inflow_route") || profErr.code === "42703") {
      console.error("❌ profiles 테이블에 inflow_route 컬럼이 없습니다.");
      console.error("  Supabase SQL Editor에서 다음 쿼리를 실행해주세요:");
      console.error("  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS inflow_route text;");
      process.exit(1);
    }
    console.error("❌ profiles 조회 실패:", profErr.message);
    process.exit(1);
  }

  const allProfiles = profiles ?? [];
  console.log(`📥 DB 프로필 로드: ${allProfiles.length}건\n`);

  // ── 매칭 및 업데이트 ──
  let updated = 0, skipped = 0, notFound = 0;

  for (const row of csvRows) {
    // 1차: 이름 + 전화번호 매칭
    let match = allProfiles.find(
      (p) => p.name === row.name && p.phone === row.phone
    );

    // 2차: 이름만 매칭 (전화번호 없거나 DB에 다른 형식)
    if (!match) {
      const candidates = allProfiles.filter((p) => p.name === row.name);
      if (candidates.length === 1) match = candidates[0];
      else if (candidates.length > 1 && row.phone) {
        // 전화번호 부분 일치
        match = candidates.find((p) => p.phone?.replace(/-/g, "") === row.phone.replace(/-/g, ""));
      } else if (candidates.length > 1) {
        match = candidates[0]; // 애매하면 첫 번째
      }
    }

    if (!match) {
      console.log(`  ❓ 미발견: ${row.name} (${row.phone}) → ${row.inflow}`);
      notFound++;
      continue;
    }

    // 이미 동일한 값이면 스킵
    const currentInflow = (match as any).inflow_route ?? "";
    if (currentInflow === row.inflow) {
      skipped++;
      continue;
    }

    console.log(
      `  ✏️  UPDATE: ${row.name} | "${currentInflow || "(빈칸)"}" → "${row.inflow}"`
    );

    if (!DRY_RUN) {
      const { error } = await supabase
        .from("profiles")
        .update({ inflow_route: row.inflow })
        .eq("id", match.id);

      if (error) {
        console.error(`    ❌ 실패 (${row.name}):`, error.message);
      } else {
        updated++;
      }
    } else {
      updated++;
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(" 완료!");
  console.log("═══════════════════════════════════════════");
  console.log(`  ✏️  UPDATE: ${updated}건`);
  console.log(`  ✅ 변경없음: ${skipped}건`);
  console.log(`  ❓ DB 미발견: ${notFound}건`);
  if (DRY_RUN) console.log("\n  ⚠️  DRY RUN — DB 반영 안 됨");
  console.log("");
}

main().catch((err) => {
  console.error("❌ 오류:", err);
  process.exit(1);
});
