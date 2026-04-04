/**
 * 외부수입 기타 섹션 동기화 스크립트 (Upsert)
 *
 * 대상: LESSON_DATA.xlsx → external_income 테이블
 * 대상 섹션: 각 '외부*년' 시트의 '기타' 섹션만 (선생님 섹션 스킵)
 * 추출 컬럼: 카테고리(col0), 이름(col1), 유입경로(col2), 날짜(월헤더+일), 금액(만원)
 *            col3 '내용'은 완전히 무시
 * 관리 타입: 체험비, 외부강의, 강사수수료, 공연비, 기타
 *
 * Upsert 키: (income_date, amount, type) → 3-way 매칭
 *            type이 다른 경우 (income_date, amount) 2-way 폴백
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/sync_external_income.ts
 *   npx ts-node --project scripts/tsconfig.json scripts/sync_external_income.ts --dry-run
 *   npx ts-node --project scripts/tsconfig.json scripts/sync_external_income.ts --inspect
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ────────────────────────────────────────────────────
// 1. 환경 설정
// ────────────────────────────────────────────────────

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
const INSPECT = process.argv.includes("--inspect");
const EXCEL_PATH = path.join(__dirname, "..", "LESSON_DATA.xlsx");

// ────────────────────────────────────────────────────
// 2. 타입 정의
// ────────────────────────────────────────────────────

interface ExcelGitaRow {
  type: string;         // 카테고리 → DB type 값
  description: string;  // 이름
  notes: string;        // 유입경로
  incomeDate: string;   // YYYY-MM-DD
  amountWon: number;    // 원 단위 (만원 × 10000)
  sheetName: string;
}

interface DbExternalIncome {
  id: string;
  type: string;
  description: string | null;
  notes: string | null;
  amount: number;
  income_date: string;
}

// ────────────────────────────────────────────────────
// 3. 상수
// ────────────────────────────────────────────────────

const MANAGED_TYPES = ["체험비", "외부강의", "강사수수료", "공연비", "기타"];

/** 대상 시트 패턴 */
const YEAR_PATTERNS: Array<{ pattern: RegExp; year: number }> = [
  { pattern: /외부\s*23년/, year: 2023 },
  { pattern: /외부\s*24년/, year: 2024 },
  { pattern: /외부\s*25년/, year: 2025 },
  { pattern: /외부\s*26년/, year: 2026 },
];

// ────────────────────────────────────────────────────
// 4. 유틸리티
// ────────────────────────────────────────────────────

/** 해당 연/월의 마지막 날짜 (범위 초과 day 클램핑용) */
function clampDay(year: number, month: number, day: number): number {
  const maxDay = new Date(year, month, 0).getDate();
  return Math.min(Math.max(day, 1), maxDay);
}

/** 카테고리 정규화 — MANAGED_TYPES 중 하나인지 확인 */
function parseCategory(raw: any): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (MANAGED_TYPES.includes(s)) return s;
  // 오기입 처리
  const fixes: Record<string, string> = {
    "체 험 비": "체험비",
    "외 부 강 의": "외부강의",
    "강사 수수료": "강사수수료",
    "공 연 비": "공연비",
  };
  return fixes[s] ?? null;
}

// ────────────────────────────────────────────────────
// 5. 엑셀 파싱 — 기타 섹션
// ────────────────────────────────────────────────────

/**
 * Row 1 (헤더행)에서 "1월" 컬럼 위치를 찾아 monthStartCol 반환
 * 외부25년: 4 / 나머지: 9
 */
function detectMonthStartCol(headerRow: any[]): number {
  for (let i = 0; i < headerRow.length; i++) {
    if (String(headerRow[i] ?? "").trim() === "1월") return i;
  }
  return 9; // 기본값
}

/**
 * 시트에서 '기타' 섹션만 파싱하여 ExcelGitaRow[] 반환
 *
 * 컬럼 구조:
 *  col 0: 카테고리
 *  col 1: 이름
 *  col 2: 유입경로
 *  col 3: 내용 (무시)
 *  col 4~: 기타 고정 정보 (전화번호 등, 무시)
 *  monthStartCol + (m-1)*3     = 일(day) for month m
 *  monthStartCol + (m-1)*3 + 1 = 입금액(만원) for month m
 */
function parseGitaSection(
  wb: XLSX.WorkBook,
  sheetName: string,
  year: number
): ExcelGitaRow[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  });

  // ── 헤더행(Row 1)에서 monthStartCol 감지 ──
  const headerRow1 = rows[1] ?? [];
  const monthStartCol = detectMonthStartCol(headerRow1);

  if (INSPECT) {
    console.log(`  ${sheetName}: monthStartCol=${monthStartCol}, 전체 행=${rows.length}`);
  }

  // ── '기타' 섹션 시작행 탐색 ──
  let gitaStartRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    // col 0 또는 col 1이 정확히 "기타"이고 다른 핵심 컬럼이 비어 있는 행 → 섹션 레이블
    const col0 = String(row[0] ?? "").trim();
    const col1 = String(row[1] ?? "").trim();
    const isLabel = (col0 === "기타" && col1 === "") || (col0 === "기타" && typeof row[monthStartCol] === "number" && (row[monthStartCol] as number) === 0);
    if (isLabel) {
      gitaStartRow = i + 1; // 다음 행부터 데이터
      if (INSPECT) console.log(`  ${sheetName}: '기타' 레이블 at Row${i} → 데이터 Row${gitaStartRow}~`);
      break;
    }
  }

  if (gitaStartRow === -1) {
    console.log(`  ⚠️  ${sheetName}: '기타' 섹션 미발견 (스킵)`);
    return [];
  }

  // ── 데이터 행 파싱 ──
  const results: ExcelGitaRow[] = [];

  for (let i = gitaStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const type = parseCategory(row[0]);
    if (!type) continue; // 카테고리 없거나 미인식 → 스킵

    const description = String(row[1] ?? "").trim() || type;
    const notes = String(row[2] ?? "").trim(); // 유입경로 (col3 내용은 무시)

    // 월별 데이터 스캔 (month 1..12)
    for (let m = 1; m <= 12; m++) {
      const dayCol = monthStartCol + (m - 1) * 3;
      const amtCol = dayCol + 1;

      const dayVal = row[dayCol];
      const amtVal = row[amtCol];

      if (amtVal == null || amtVal === "" || amtVal === 0) continue;
      const amountMan = typeof amtVal === "number" ? amtVal : parseFloat(String(amtVal).replace(/,/g, ""));
      if (isNaN(amountMan) || amountMan <= 0) continue;

      let day = 1;
      if (typeof dayVal === "number" && dayVal >= 1 && dayVal <= 31) {
        day = dayVal;
      } else if (typeof dayVal === "string") {
        const parsed = parseInt(dayVal);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) day = parsed;
      }

      const clampedDay = clampDay(year, m, day);
      const incomeDate = `${year}-${String(m).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
      const amountWon = Math.round(amountMan * 10000);

      results.push({ type, description, notes, incomeDate, amountWon, sheetName });

      if (INSPECT) {
        console.log(
          `  [Row${i}] type=${type}, 이름=${description}, 날짜=${incomeDate}, 금액=${amountWon.toLocaleString()}원`
        );
      }
    }
  }

  return results;
}

// ────────────────────────────────────────────────────
// 6. DB 기존 데이터 로드
// ────────────────────────────────────────────────────

async function loadExistingRecords(): Promise<DbExternalIncome[]> {
  const { data, error } = await supabase
    .from("external_income")
    .select("id, type, description, notes, amount, income_date")
    .in("type", MANAGED_TYPES);

  if (error) {
    console.error("❌ 기존 external_income 조회 실패:", error.message);
    return [];
  }
  return data || [];
}

// ────────────────────────────────────────────────────
// 7. Upsert 로직
// ────────────────────────────────────────────────────

interface UpsertStats {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

async function upsertExternalIncome(
  excelRows: ExcelGitaRow[],
  existingDb: DbExternalIncome[]
): Promise<UpsertStats> {
  const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };

  for (const row of excelRows) {
    // ── 1차: (income_date, amount, type) 3-way 매칭 ──
    let match = existingDb.find(
      (db) =>
        db.income_date === row.incomeDate &&
        db.amount === row.amountWon &&
        db.type === row.type
    );

    // ── 2차 폴백: type이 수정된 경우 (income_date, amount) 매칭 ──
    if (!match) {
      const candidates = existingDb.filter(
        (db) =>
          db.income_date === row.incomeDate &&
          db.amount === row.amountWon &&
          MANAGED_TYPES.includes(db.type)
      );
      if (candidates.length === 1) {
        match = candidates[0];
        if (match.type !== row.type) {
          console.log(
            `  ↩️  타입 수정 감지: [${match.type}] → [${row.type}] (${row.incomeDate}, ${(row.amountWon / 10000).toFixed(1)}만원)`
          );
        }
      }
      // 2개 이상 후보 → 매칭 불가, INSERT로 처리
    }

    if (match) {
      // ── UPDATE 여부 확인 ──
      const typeChanged = match.type !== row.type;
      const descChanged = (match.description ?? "") !== row.description;
      const notesChanged = (match.notes ?? "") !== row.notes;

      if (!typeChanged && !descChanged && !notesChanged) {
        stats.skipped++;
        continue;
      }

      const changes: string[] = [];
      if (typeChanged) changes.push(`type: "${match.type}" → "${row.type}"`);
      if (descChanged) changes.push(`이름: "${match.description}" → "${row.description}"`);
      if (notesChanged) changes.push(`유입경로: "${match.notes}" → "${row.notes}"`);

      console.log(
        `  ✏️  UPDATE [${row.incomeDate}] ${(row.amountWon / 10000).toFixed(1)}만원 — ${changes.join(", ")}`
      );

      if (!DRY_RUN) {
        const { error } = await supabase
          .from("external_income")
          .update({
            type: row.type,
            description: row.description,
            notes: row.notes || null,
          })
          .eq("id", match.id);

        if (error) {
          console.error(`    ❌ UPDATE 실패 (id=${match.id}):`, error.message);
          stats.errors++;
        } else {
          match.type = row.type;
          match.description = row.description;
          match.notes = row.notes || null;
          stats.updated++;
        }
      } else {
        stats.updated++;
      }
    } else {
      // ── INSERT ──
      console.log(
        `  ➕ INSERT: type=${row.type}, 이름=${row.description}, 경로=${row.notes || "-"}, 날짜=${row.incomeDate}, 금액=${(row.amountWon / 10000).toFixed(1)}만원`
      );

      if (!DRY_RUN) {
        const { data: inserted, error } = await supabase
          .from("external_income")
          .insert({
            type: row.type,
            description: row.description,
            notes: row.notes || null,
            amount: row.amountWon,
            income_date: row.incomeDate,
          })
          .select("id, type, description, notes, amount, income_date")
          .single();

        if (error) {
          console.error(`    ❌ INSERT 실패 (${row.incomeDate} ${row.type}):`, error.message);
          stats.errors++;
        } else if (inserted) {
          existingDb.push(inserted);
          stats.inserted++;
        }
      } else {
        stats.inserted++;
      }
    }
  }

  return stats;
}

// ────────────────────────────────────────────────────
// 8. 메인 실행
// ────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" 외부수입 기타섹션 → Supabase 동기화 (Upsert)");
  if (DRY_RUN) console.log(" (DRY RUN — DB 변경 없음)");
  if (INSPECT) console.log(" (INSPECT — 파싱 상세 출력)");
  console.log("═══════════════════════════════════════════\n");

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ 엑셀 파일 없음: ${EXCEL_PATH}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(EXCEL_PATH);
  console.log(`📊 엑셀 로드 완료. 시트: ${wb.SheetNames.join(", ")}\n`);

  // 대상 시트 탐색
  const targetSheets: Array<{ sheetName: string; year: number }> = [];
  for (const { pattern, year } of YEAR_PATTERNS) {
    const found = wb.SheetNames.find((n) => pattern.test(n));
    if (found) {
      targetSheets.push({ sheetName: found, year });
    } else {
      console.log(`  ⚠️  ${year}년 외부수입 시트 미발견`);
    }
  }

  if (targetSheets.length === 0) {
    console.error("❌ 처리할 외부수입 시트 없음");
    process.exit(1);
  }
  console.log(`🗂️  처리 대상: ${targetSheets.map((s) => s.sheetName).join(", ")}\n`);

  // ── Step 1: 엑셀 파싱 ──
  console.log("📋 엑셀 파싱 (기타 섹션만)...");
  const allExcelRows: ExcelGitaRow[] = [];

  for (const { sheetName, year } of targetSheets) {
    const rows = parseGitaSection(wb, sheetName, year);
    console.log(`  ${sheetName}: ${rows.length}건`);
    allExcelRows.push(...rows);
  }

  console.log(`\n  총 엑셀 데이터: ${allExcelRows.length}건`);

  if (allExcelRows.length === 0) {
    console.log("  ℹ️  파싱된 데이터 없음. --inspect 플래그로 구조를 확인하세요.");
    return;
  }

  // 타입별 집계
  const typeCounts = allExcelRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log("  타입별:", typeCounts);

  const totalWon = allExcelRows.reduce((s, r) => s + r.amountWon, 0);
  console.log(`  총 금액: ${(totalWon / 10000).toLocaleString()}만원`);

  // ── Step 2: DB 기존 데이터 로드 ──
  console.log("\n📥 DB 기존 데이터 로드...");
  const existingDb = await loadExistingRecords();
  console.log(`  기존 외부수입 (관리 타입): ${existingDb.length}건`);

  const dbTypeCounts = existingDb.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log("  DB 타입별:", dbTypeCounts);

  // ── Step 3: Upsert 실행 ──
  console.log(`\n🔄 Upsert 실행${DRY_RUN ? " [DRY RUN]" : ""}...`);
  const stats = await upsertExternalIncome(allExcelRows, existingDb);

  // ── 결과 요약 ──
  console.log("\n═══════════════════════════════════════════");
  console.log(" 동기화 완료!");
  console.log("═══════════════════════════════════════════");
  console.log(`  ➕ INSERT: ${stats.inserted}건`);
  console.log(`  ✏️  UPDATE: ${stats.updated}건`);
  console.log(`  ✅ 변경없음 (SKIP): ${stats.skipped}건`);
  if (stats.errors > 0) console.log(`  ❌ 오류: ${stats.errors}건`);
  console.log(`  📌 엑셀 총 처리: ${allExcelRows.length}건`);
  if (DRY_RUN) {
    console.log("\n  ⚠️  DRY RUN — DB에 반영되지 않았습니다.");
    console.log("  실행: npx ts-node --project scripts/tsconfig.json scripts/sync_external_income.ts");
  }
  console.log("");
}

main().catch((err) => {
  console.error("❌ 치명적 오류:", err);
  process.exit(1);
});
