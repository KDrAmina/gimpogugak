/**
 * LESSON_DATA.xlsx → Supabase 롤백 & 재마이그레이션 (v4.7.26)
 *
 * ─ STEP 1: 절대 시간 기준 완전 롤백 (2026-04-02 00:00:00 KST 이후 생성 전량 삭제)
 *   · external_income 전량 DELETE
 *   · is_active=false lessons 전량 DELETE (lesson_history CASCADE)
 *   · lesson_history 전량 DELETE (민다현 제외)
 *   · 이율/이윤 잘못된 프로필 (010-2718-0838) 완전 DELETE
 *
 * ─ STEP 2: 완전 픽스 재마이그레이션
 *   Fix 1. lessons INSERT 시 status 컬럼 사용 금지 (is_active만 사용)
 *   Fix 2. 외부24년: '대금' 또는 '해금' 포함 행만 → 강사수수료
 *   Fix 3. 외부25/26년: 체험비/기타/강사수수료 분류 유지
 *   Fix 4. 활성 수강생 26년 데이터 완전 스킵 (민다현 제외)
 *   Fix 5. 이율/이윤 → 기존 010-9968-3256 프로필에 lesson_history만 삽입
 *   Fix 6. 유지연 25년 → is_active=false 강제
 *   Fix 7. 신규 프로필 status='active' 명시
 *   Fix 8. 외부수입 중복 제거: date+type+amount+description 동일 항목 1개만 INSERT
 *   Fix 9. 과거 수강생 일괄 승인: 마이그레이션된 모든 프로필 status='active' 강제
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/rollback_and_migrate.ts
 *   npx ts-node --project scripts/tsconfig.json scripts/rollback_and_migrate.ts --dry-run
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
const EXCEL_PATH = path.join(__dirname, "..", "LESSON_DATA.xlsx");

// 2026-04-02 00:00:00 KST = 2026-04-01 15:00:00 UTC
// 이 시각 이후 생성된 모든 마이그레이션 데이터를 STEP 1에서 전량 삭제한다.
const ROLLBACK_SINCE = "2026-04-01T15:00:00.000Z";

// ────────────────────────────────────────────────────
// 2. 타입 정의
// ────────────────────────────────────────────────────

interface MonthlyPayment {
  month: number;
  day: number;
  amount: number; // 만원 단위
}

interface RawStudentRow {
  name: string;
  phone: string | null;
  excelCategory: string;
  baseRate: number;
  year: number;
  payments: MonthlyPayment[];
}

interface CategorySegment {
  category: string;
  payments: MonthlyPayment[];
  tuitionWon: number;
}

interface ExternalIncomeRow {
  type: string;       // '체험비' | '기타' | '강사수수료'
  description: string;
  year: number;
  month: number;
  day: number;
  amountMan: number;  // 만원
}

interface ExistingProfile {
  id: string;
  name: string;
  phone: string | null;
}

interface PersonRecord {
  name: string;
  phone: string | null;
  yearData: Map<number, Map<string, MonthlyPayment[]>>;
  baseRates: Map<number, Map<string, number>>;
}

// ────────────────────────────────────────────────────
// 3. 상수
// ────────────────────────────────────────────────────

const YEAR_MAP: Record<string, number> = {
  "23년": 2023, "24년": 2024, "25년": 2025, "26년": 2026,
};

const CATEGORY_FIX: Record<string, string> = {
  성안개인: "성인개인", 성안단체: "성인단체",
};

const SKIP_WORDS = [
  "총", "투자", "외부", "과목", "입금", "휴식", "합창", "악기", "구로",
  "평균", "수강인원", "24년도", "NI", "합창휴식", "외부24년", "외부25년",
  "외부26년", "악기대여", "악기25년", "총인원",
];

const WRONG_FREE_PHONE   = "010-2718-0838"; // 잘못된 이율/이윤 번호 (롤백 + 금지)
const FREE_STUDENT_REAL_PHONE = "010-9968-3256"; // DB 실제 이율/이윤 번호
const FREE_STUDENT_EXCEL_NAMES = ["이율,이윤", "이율", "이윤"];

const MINDAHYUN_PHONE = "010-9795-9202"; // 민다현: 완전 덮어쓰기
const YOOJIYEON_PHONE = "010-3858-4019"; // 유지연: 25년 1건만, 종료됨 강제

// ────────────────────────────────────────────────────
// 4. 유틸리티
// ────────────────────────────────────────────────────

function normalizePhone(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\s/g, "");
  if (/^01[0-9]-?\d{3,4}-?\d{4}$/.test(s)) {
    const d = s.replace(/-/g, "");
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  return null;
}

function normalizeCategory(raw: string): string {
  return CATEGORY_FIX[raw.trim()] || raw.trim();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, new Date(year, month, 0).getDate());
}

/** YYYY-MM-DD 형식의 정확한 날짜 문자열 생성 (Fix 5) */
function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(clampDay(year, month, day)).padStart(2, "0")}`;
}

function isStudentRow(row: any[]): boolean {
  const col1 = row[1];
  if (!col1 || typeof col1 !== "string" || col1.trim().length < 2) return false;
  const col0 = String(row[0] ?? "").trim();
  for (const w of SKIP_WORDS) {
    if (col0 === w || col1.trim() === w) return false;
  }
  const skipPrefixes = [
    "어린이 개인", "성인 개인", "어린이 단체", "성인 단체",
    "어린이개인", "성인개인", "어린이단체", "성인단체",
    "개인", "단체", "어린이", "성인",
  ];
  return !skipPrefixes.includes(col0);
}

// ────────────────────────────────────────────────────
// 5. 외부수입 타입 분류 (Fix 5)
// ────────────────────────────────────────────────────

/**
 * 설명 텍스트를 보고 외부수입 타입을 결정
 * - '체험' 포함 → '체험비'
 * - '연금' 또는 '기타' 포함 → '기타'
 * - 그 외 → '강사수수료'
 */
function classifyIncomeType(text: string): string {
  if (text.includes("체험")) return "체험비";
  if (text.includes("연금") || text.includes("기타")) return "기타";
  return "강사수수료";
}

/**
 * 외부수입 시트 행이 수입 행인지 판단
 * - col0 또는 col1에 수입 관련 키워드 포함 여부로 판단
 */
function isExternalIncomeRow(row: any[]): boolean {
  const c0 = String(row[0] ?? "").trim();
  const c1 = String(row[1] ?? "").trim();
  const keywords = ["강사수수료", "체험", "연금", "기타", "수입"];
  return keywords.some((kw) => c0.includes(kw) || c1.includes(kw));
}

/**
 * 외부수입 행에서 description과 type을 추출
 * Excel 구조:
 *   패턴A: col0="수입", col1=설명(강사수수료/체험/기타 등)
 *   패턴B: col0=타입키워드(강사수수료 등), col1=상세설명
 *   패턴C: col1=타입키워드, col0 또는 col4/col3=상세설명
 */
function extractExternalMeta(row: any[]): { description: string; type: string } {
  const c0 = String(row[0] ?? "").trim();
  const c1 = String(row[1] ?? "").trim();

  let description = "";
  let typeSource = "";

  if (c0 === "수입") {
    // 패턴A: col0="수입", col1에 내용
    typeSource = c1;
    description = c1 || "수입";
  } else if (["강사수수료", "체험비", "체험", "연금", "기타"].some((kw) => c0.includes(kw))) {
    // 패턴B: col0이 타입, col1이 상세 설명
    typeSource = c0;
    description = c1 || c0;
  } else if (["강사수수료", "체험비", "체험", "연금", "기타"].some((kw) => c1.includes(kw))) {
    // 패턴C: col1이 타입, col0 또는 col4/col3에 상세 설명
    typeSource = c1;
    description = c0 || String(row[4] ?? row[3] ?? c1).trim();
  } else {
    // 기타: 모든 내용을 합쳐 분류
    typeSource = c0 + " " + c1;
    description = c0 || c1 || "외부수입";
  }

  return {
    description: description || typeSource,
    type: classifyIncomeType(typeSource + " " + description),
  };
}

// ────────────────────────────────────────────────────
// 6. 엑셀 파싱 — 수강 시트
// ────────────────────────────────────────────────────

function parseStudentSheet(wb: XLSX.WorkBook, sheetName: string): RawStudentRow[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const year = YEAR_MAP[sheetName];
  const results: RawStudentRow[] = [];

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 8) continue;
    if (!isStudentRow(row)) continue;

    const name = String(row[1]).trim();
    const phone = normalizePhone(row[2]);
    const excelCategory = normalizeCategory(String(row[3] ?? ""));
    const baseRate = typeof row[5] === "number" ? row[5] : 0;

    const payments: MonthlyPayment[] = [];
    for (let m = 0; m < 12; m++) {
      const dateVal = row[7 + m * 2];
      const amountVal = row[8 + m * 2];
      if (amountVal != null && typeof amountVal === "number" && amountVal > 0) {
        let day = 1;
        if (typeof dateVal === "number" && dateVal >= 1 && dateVal <= 31) {
          day = dateVal;
        } else if (typeof dateVal === "string") {
          const m2 = dateVal.match(/(\d+)/);
          if (m2) day = parseInt(m2[1]);
        }
        payments.push({ month: m + 1, day, amount: amountVal });
      }
    }

    if (payments.length === 0 && baseRate === 0) continue;
    results.push({ name, phone, excelCategory, baseRate, year, payments });
  }
  return results;
}

// ────────────────────────────────────────────────────
// 7. 엑셀 파싱 — 외부수입 시트
// ────────────────────────────────────────────────────

/**
 * 외부24년 전용 파서
 * - '대금' 또는 '해금' 단어가 포함된 행만 수집 → 전부 강사수수료
 * - 나머지 모든 행은 무시
 */
function parseExternal24Sheet(wb: XLSX.WorkBook): ExternalIncomeRow[] {
  const ws = wb.Sheets["외부24년"];
  if (!ws) return [];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const results: ExternalIncomeRow[] = [];

  for (const row of rows) {
    if (!row) continue;

    const c0 = String(row[0] ?? "").trim();
    const c1 = String(row[1] ?? "").trim();
    const rowText = c0 + " " + c1;

    // 대금 또는 해금이 포함된 행만 처리
    if (!rowText.includes("대금") && !rowText.includes("해금")) continue;

    const description = c1 || c0 || "강사수수료";
    const type = "강사수수료";

    // monthBaseIdx=9 (외부24년 컬럼 구조)
    let foundAny = false;
    for (let m = 0; m < 12; m++) {
      const dateCol   = 9 + m * 3;
      const amountCol = 9 + m * 3 + 1;
      const dateVal   = row[dateCol];
      const amountVal = row[amountCol];

      if (amountVal != null && typeof amountVal === "number" && amountVal > 0) {
        let day = 1;
        if (typeof dateVal === "number" && dateVal >= 1 && dateVal <= 31) {
          day = dateVal;
        }
        results.push({ type, description, year: 2024, month: m + 1, day, amountMan: amountVal });
        foundAny = true;
      }
    }

    if (foundAny) {
      console.log(`    → [${type}] "${description}"`);
    }
  }
  return results;
}

/**
 * 외부25년, 외부26년 파서
 * - 체험비 / 기타 / 강사수수료 분류 유지
 *
 * @param monthBaseIdx 월 데이터 시작 컬럼 인덱스
 *   - 외부25년: 8, 외부26년: 9
 */
function parseExternalSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  year: number,
  monthBaseIdx: number
): ExternalIncomeRow[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const results: ExternalIncomeRow[] = [];

  for (const row of rows) {
    if (!row) continue;
    if (!isExternalIncomeRow(row)) continue;

    const { description, type } = extractExternalMeta(row);

    let foundAny = false;
    for (let m = 0; m < 12; m++) {
      const dateCol   = monthBaseIdx + m * 3;
      const amountCol = monthBaseIdx + m * 3 + 1;
      const dateVal   = row[dateCol];
      const amountVal = row[amountCol];

      if (amountVal != null && typeof amountVal === "number" && amountVal > 0) {
        let day = 1;
        if (typeof dateVal === "number" && dateVal >= 1 && dateVal <= 31) {
          day = dateVal;
        }
        results.push({ type, description, year, month: m + 1, day, amountMan: amountVal });
        foundAny = true;
      }
    }

    if (foundAny) {
      console.log(`    → [${type}] "${description}"`);
    }
  }
  return results;
}

// ────────────────────────────────────────────────────
// 8. 학생 그룹핑
// ────────────────────────────────────────────────────

function groupStudents(rows: RawStudentRow[]): Map<string, PersonRecord> {
  const map = new Map<string, PersonRecord>();
  for (const row of rows) {
    if (!row.phone) continue;
    const key = `${row.phone}::${row.name}`;
    let person = map.get(key);
    if (!person) {
      person = { name: row.name, phone: row.phone, yearData: new Map(), baseRates: new Map() };
      map.set(key, person);
    }
    if (!person.yearData.has(row.year)) {
      person.yearData.set(row.year, new Map());
      person.baseRates.set(row.year, new Map());
    }
    const yearCats  = person.yearData.get(row.year)!;
    const yearRates = person.baseRates.get(row.year)!;
    const cat = row.excelCategory;
    if (!yearCats.has(cat)) yearCats.set(cat, []);
    if (!yearRates.has(cat)) yearRates.set(cat, row.baseRate);
    const existing = yearCats.get(cat)!;
    for (const p of row.payments) {
      const found = existing.find((e) => e.month === p.month);
      if (found) {
        found.amount += p.amount;
        if (p.day > found.day) found.day = p.day;
      } else {
        existing.push({ ...p });
      }
    }
  }
  return map;
}

// ────────────────────────────────────────────────────
// 9. 카테고리 세그먼트 결정
// ────────────────────────────────────────────────────

function determineCategorySegments(
  payments: MonthlyPayment[],
  excelCategory: string,
  baseRate: number
): CategorySegment[] {
  if (payments.length === 0) {
    return [{ category: excelCategory, payments: [], tuitionWon: baseRate * 10000 }];
  }
  const amounts = [...new Set(payments.map((p) => p.amount))].sort((a, b) => a - b);
  if (amounts.length === 1) {
    return [{ category: excelCategory, payments, tuitionWon: amounts[0] * 10000 }];
  }
  if (!excelCategory.includes("어린이")) {
    return [{ category: excelCategory, payments, tuitionWon: payments[payments.length - 1].amount * 10000 }];
  }
  if (amounts.length === 2) {
    const [low, high] = amounts;
    if (low === 10 && high === 20) return [
      { category: "어린이단체", payments: payments.filter(p => p.amount === 10), tuitionWon: 100000 },
      { category: "어린이개인", payments: payments.filter(p => p.amount === 20), tuitionWon: 200000 },
    ];
    if (low === 20 && high === 30) return [
      { category: "어린이개인", payments: payments.filter(p => p.amount === 20), tuitionWon: 200000 },
      { category: "어린이개인, 어린이단체", payments: payments.filter(p => p.amount === 30), tuitionWon: 300000 },
    ];
    if (low === 15 && high === 20) return [
      { category: "어린이개인", payments: payments.filter(p => p.amount === 15), tuitionWon: 150000 },
      { category: "어린이개인, 어린이단체", payments: payments.filter(p => p.amount === 20), tuitionWon: 200000 },
    ];
    if (low === 10 && high === 30) return [
      { category: "어린이단체", payments: payments.filter(p => p.amount === 10), tuitionWon: 100000 },
      { category: "어린이개인, 어린이단체", payments: payments.filter(p => p.amount === 30), tuitionWon: 300000 },
    ];
  }
  return [{ category: excelCategory, payments, tuitionWon: payments[payments.length - 1].amount * 10000 }];
}

// ────────────────────────────────────────────────────
// 10. DB 조회
// ────────────────────────────────────────────────────

async function loadExistingProfiles(): Promise<ExistingProfile[]> {
  const { data, error } = await supabase.from("profiles").select("id, name, phone");
  if (error) { console.error("❌ 프로필 조회 실패:", error.message); return []; }
  return data || [];
}

async function loadActiveStudentPhones(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("lessons")
    .select("profiles!inner(phone)")
    .eq("is_active", true);
  if (error) { console.error("❌ 활성 수강생 조회 실패:", error.message); return new Set(); }
  const phones = new Set<string>();
  for (const row of data || []) {
    const phone = (row as any).profiles?.phone;
    if (phone) phones.add(phone);
  }
  return phones;
}

// ────────────────────────────────────────────────────
// 11. STEP 1 — 절대 시간 기준 완전 롤백
// ────────────────────────────────────────────────────

/**
 * rollbackAll: 2026-04-02 00:00:00 KST(= ROLLBACK_SINCE) 이후 생성된
 * 모든 마이그레이션 잔재를 DB에서 완전히 제거한다.
 *
 * 삭제 순서:
 *   [1] external_income 전량
 *   [2] is_active=false lessons (+ lesson_history CASCADE)
 *   [3] lesson_history 전량 (민다현 제외)
 *   [4] 이율/이윤 잘못된 프로필 (010-2718-0838) + 연관 데이터
 */
async function rollbackAll(): Promise<void> {
  console.log(`  📅 삭제 기준: 2026-04-02 00:00:00 KST 이후 생성된 모든 데이터\n`);
  if (DRY_RUN) { console.log("  [DRY] 롤백 전체 스킵"); return; }

  let totalDeleted = 0;

  // ── [1] external_income 전량 삭제 ──────────────────
  const { error: e1, count: c1 } = await supabase
    .from("external_income")
    .delete({ count: "exact" })
    .gte("created_at", ROLLBACK_SINCE);
  if (e1) console.error("  ❌ [1] external_income 삭제 실패:", e1.message);
  else {
    const n = c1 ?? 0;
    totalDeleted += n;
    console.log(`  ✅ [1] external_income 삭제: ${n}건`);
  }

  // ── [2] is_active=false lessons + lesson_history CASCADE ──
  const { data: closedLessons } = await supabase
    .from("lessons").select("id")
    .eq("is_active", false)
    .gte("created_at", ROLLBACK_SINCE);
  if (closedLessons && closedLessons.length > 0) {
    const ids = closedLessons.map((l: any) => l.id);
    const { count: hc } = await supabase
      .from("lesson_history").delete({ count: "exact" }).in("lesson_id", ids);
    const { error: e2, count: c2 } = await supabase
      .from("lessons").delete({ count: "exact" }).in("id", ids);
    if (e2) console.error("  ❌ [2] lessons 삭제 실패:", e2.message);
    else {
      const n = (c2 ?? ids.length);
      totalDeleted += n;
      console.log(`  ✅ [2] is_active=false lessons 삭제: ${n}건 (lesson_history ${hc ?? 0}건 CASCADE)`);
    }
  } else {
    console.log("  ℹ️  [2] 삭제할 is_active=false lessons 없음");
  }

  // ── [3] lesson_history 전량 삭제 (민다현 제외) ─────
  const { data: mindaProfiles } = await supabase
    .from("profiles").select("id").like("name", "%민다현%");
  const mindaProfileIds = (mindaProfiles || []).map((p: any) => p.id);
  let mindaLessonIds: string[] = [];
  if (mindaProfileIds.length > 0) {
    const { data: ml } = await supabase
      .from("lessons").select("id").in("user_id", mindaProfileIds);
    mindaLessonIds = (ml || []).map((l: any) => l.id);
  }

  const { data: histAll } = await supabase
    .from("lesson_history").select("id, lesson_id")
    .gte("created_at", ROLLBACK_SINCE);
  const histToDelete = (histAll || [])
    .filter((h: any) => !mindaLessonIds.includes(h.lesson_id))
    .map((h: any) => h.id);
  const mindaKept = (histAll?.length ?? 0) - histToDelete.length;

  if (histToDelete.length > 0) {
    const { error: e3, count: c3 } = await supabase
      .from("lesson_history").delete({ count: "exact" }).in("id", histToDelete);
    if (e3) console.error("  ❌ [3] lesson_history 삭제 실패:", e3.message);
    else {
      const n = c3 ?? histToDelete.length;
      totalDeleted += n;
      console.log(`  ✅ [3] lesson_history 삭제: ${n}건 (민다현 ${mindaKept}건 보존)`);
    }
  } else {
    console.log("  ℹ️  [3] 삭제할 lesson_history 없음");
  }

  // ── [4] 이율/이윤 잘못된 프로필 (010-2718-0838) 완전 삭제 ──
  const { data: wrongProfiles } = await supabase
    .from("profiles").select("id, name").eq("phone", WRONG_FREE_PHONE);
  if (wrongProfiles && wrongProfiles.length > 0) {
    for (const profile of wrongProfiles) {
      const { data: wLessons } = await supabase
        .from("lessons").select("id").eq("user_id", profile.id);
      if (wLessons && wLessons.length > 0) {
        const wIds = wLessons.map((l: any) => l.id);
        await supabase.from("lesson_history").delete().in("lesson_id", wIds);
        await supabase.from("lessons").delete().in("id", wIds);
      }
      await supabase.from("profiles").delete().eq("id", profile.id);
      const { error: authErr } = await supabase.auth.admin.deleteUser(profile.id);
      if (authErr) console.warn(`  ⚠️  [4] Auth 삭제 실패 (${profile.id}):`, authErr.message);
      console.log(`  ✅ [4] 잘못된 이율/이윤 프로필 삭제: ${(profile as any).name}`);
      totalDeleted++;
    }
  } else {
    console.log("  ℹ️  [4] 잘못된 이율/이윤 프로필 없음");
  }

  console.log(`\n  🗑️  2026-04-02 이후 생성된 쓰레기 데이터 ${totalDeleted}건 삭제 완료`);
}

// ────────────────────────────────────────────────────
// 12. 민다현 초기화
// ────────────────────────────────────────────────────

async function clearMindahyun(profiles: ExistingProfile[]): Promise<void> {
  const profile = profiles.find((p) => p.phone === MINDAHYUN_PHONE);
  if (!profile) {
    console.log("  ℹ️  민다현 기존 프로필 없음 (신규 생성 예정)");
    return;
  }
  console.log(`  🗑️  민다현 기존 수업 전량 삭제 (${profile.id})`);
  if (DRY_RUN) return;

  const { data: lessons } = await supabase
    .from("lessons").select("id").eq("user_id", profile.id);
  if (lessons && lessons.length > 0) {
    const ids = lessons.map((l: any) => l.id);
    const { count: hc } = await supabase
      .from("lesson_history").delete({ count: "exact" }).in("lesson_id", ids);
    await supabase.from("lessons").delete().eq("user_id", profile.id);
    console.log(`     → lesson_history ${hc ?? 0}건 + lessons ${ids.length}건 삭제`);
  }
}

// ────────────────────────────────────────────────────
// 13. 프로필 조회/생성
// ────────────────────────────────────────────────────

async function getOrCreateProfile(
  name: string,
  phone: string,
  existingProfiles: ExistingProfile[],
  preloadedIds: Set<string>
): Promise<{ id: string; wasExisting: boolean } | null> {
  // 1. 캐시에서 phone+name 매칭
  const phoneMatches = existingProfiles.filter((p) => p.phone === phone);
  if (phoneMatches.length > 0) {
    const exact = phoneMatches.find(
      (p) => p.name === name || name.includes(p.name) || p.name.includes(name)
    );
    if (exact) return { id: exact.id, wasExisting: preloadedIds.has(exact.id) };
  }

  if (DRY_RUN) {
    console.log(`    [DRY] 프로필 생성 예정: ${name} (${phone})`);
    return { id: `dry_${phone}_${name}`, wasExisting: false };
  }

  // 2. DB 직접 재확인 (캐시 누락 방어)
  const { data: dbCheck } = await supabase
    .from("profiles").select("id, name, phone").eq("phone", phone);
  if (dbCheck && dbCheck.length > 0) {
    const exact = dbCheck.find(
      (p: any) => p.name === name || name.includes(p.name) || p.name.includes(name)
    );
    if (exact) {
      existingProfiles.push({ id: exact.id, name: exact.name, phone: exact.phone });
      return { id: exact.id, wasExisting: preloadedIds.has(exact.id) };
    }
  }

  // 3. Auth 유저 생성
  const email = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@migrate.local`;
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: `Migrate!${Date.now()}`,
    email_confirm: true,
    user_metadata: { name, phone },
  });

  if (authErr || !authData.user) {
    console.error(`    ❌ Auth 유저 생성 실패 (${name}):`, authErr?.message);
    return null;
  }

  const userId = authData.user.id;

  // Fix 3: status='active' 명시로 승인 완료 처리
  const { error: profileErr } = await supabase.from("profiles").upsert(
    { id: userId, name, phone, role: "user", status: "active" },
    { onConflict: "id" }
  );

  if (profileErr) {
    console.error(`    ❌ 프로필 UPSERT 실패 (${name}):`, profileErr.message);
    return null;
  }

  existingProfiles.push({ id: userId, name, phone });
  return { id: userId, wasExisting: false };
}

// ────────────────────────────────────────────────────
// 14. 기존 종료된 수업 삭제 (멱등성)
// ────────────────────────────────────────────────────

async function clearClosedLessons(profileId: string): Promise<number> {
  const { data: old } = await supabase
    .from("lessons").select("id")
    .eq("user_id", profileId).eq("is_active", false);

  if (!old || old.length === 0) return 0;

  const ids = old.map((l: any) => l.id);
  await supabase.from("lesson_history").delete().in("lesson_id", ids);
  const { error } = await supabase.from("lessons").delete().in("id", ids);
  if (error) {
    console.error(`    ❌ 종료된 수업 삭제 실패:`, error.message);
    return 0;
  }
  return ids.length;
}

// ────────────────────────────────────────────────────
// 15. 수업 & 이력 생성
// ────────────────────────────────────────────────────

let lessonCount = 0;
let historyCount = 0;
let externalCount = 0;

async function createLessonWithHistory(
  profileId: string,
  category: string,
  tuitionWon: number,
  payments: MonthlyPayment[],
  year: number,
  isActive: boolean
): Promise<void> {
  if (payments.length === 0) return;

  const sorted = [...payments].sort((a, b) => a.month - b.month || a.day - b.day);
  const last = sorted[sorted.length - 1];
  const paymentDate = toDateStr(year, last.month, last.day);

  if (DRY_RUN) {
    console.log(`    [DRY] lesson: ${category} ${year}년, ${tuitionWon}원, ${payments.length}건, active=${isActive}`);
    lessonCount++;
    historyCount += payments.length;
    return;
  }

  const { data: lessonData, error: lessonErr } = await supabase
    .from("lessons")
    .insert({
      user_id: profileId,
      category,
      current_session: 0,
      tuition_amount: tuitionWon,
      payment_date: paymentDate,
      is_active: isActive,
    })
    .select("id")
    .single();

  if (lessonErr || !lessonData) {
    console.error(`    ❌ lesson INSERT 실패 (${category} ${year}년):`, lessonErr?.message);
    return;
  }
  lessonCount++;

  const historyRows = sorted.map((p) => ({
    lesson_id: lessonData.id,
    session_number: 0,
    completed_date: toDateStr(year, p.month, p.day),
    user_id: profileId,
    status: "결제 완료",
    tuition_snapshot: p.amount * 10000,
    category_snapshot: category,
  }));

  for (let i = 0; i < historyRows.length; i += 500) {
    const batch = historyRows.slice(i, i + 500);
    const { error: histErr } = await supabase.from("lesson_history").insert(batch);
    if (histErr) console.error(`    ❌ lesson_history INSERT 실패:`, histErr.message);
    else historyCount += batch.length;
  }
}

// ────────────────────────────────────────────────────
// 16. 특수 케이스: 유지연 25년 조정 (Fix 4)
// ────────────────────────────────────────────────────

function handleYoojiyeon(persons: Map<string, PersonRecord>): void {
  for (const [, person] of persons) {
    if (person.phone !== YOOJIYEON_PHONE || !person.name.includes("유지연")) continue;

    const year2025 = person.yearData.get(2025);
    if (year2025) {
      for (const [cat, payments] of year2025) {
        if (payments.length > 0) {
          const first = [...payments].sort((a, b) => a.month - b.month)[0];
          year2025.set(cat, [{ month: first.month, day: first.day, amount: 80 }]);
          console.log(`  ℹ️  유지연 25년 → 80만원 1건 (${first.month}월) [is_active=false 강제]`);
        }
      }
    }
    // 유지연은 26년 데이터 무조건 제거
    if (person.yearData.has(2026)) {
      person.yearData.delete(2026);
      console.log("  ℹ️  유지연 26년 데이터 제거");
    }
    break;
  }
}

// ────────────────────────────────────────────────────
// 17. 특수 케이스: 이율/이윤 — 기존 프로필에 lesson_history만 삽입 (Fix 1)
// ────────────────────────────────────────────────────

async function handleFreeStudents(existingProfiles: ExistingProfile[]): Promise<void> {
  console.log("\n🆓 무료 수강생 처리 (이율, 이윤)...");

  // Fix 1: 절대 새 프로필 생성 금지 — 기존 010-9968-3256 프로필 찾기
  const realProfile = existingProfiles.find((p) => p.phone === FREE_STUDENT_REAL_PHONE);
  if (!realProfile) {
    console.error(`  ❌ 이율/이윤 기존 프로필 없음 (${FREE_STUDENT_REAL_PHONE}) — DB에 이 번호로 등록된 프로필이 있는지 확인 필요`);
    return;
  }
  console.log(`  ✅ 기존 프로필 매핑: "${realProfile.name}" (${realProfile.id})`);

  if (DRY_RUN) {
    console.log("  [DRY] 2025-01 ~ 2026-04 lesson_history 16건 삽입 예정 (0원)");
    historyCount += 16;
    return;
  }

  // 기존 활성 lesson 찾기
  const { data: activeLessons } = await supabase
    .from("lessons")
    .select("id, category")
    .eq("user_id", realProfile.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  let lessonId: string;

  if (activeLessons && activeLessons.length > 0) {
    lessonId = activeLessons[0].id;
    console.log(`  ✅ 기존 활성 lesson 사용: ${lessonId} (${(activeLessons[0] as any).category})`);
  } else {
    console.log("  ⚠️  활성 lesson 없음 → 어린이단체 lesson 신규 생성");
    const { data: newLesson, error: lErr } = await supabase
      .from("lessons")
      .insert({
        user_id: realProfile.id,
        category: "어린이단체",
        current_session: 0,
        tuition_amount: 0,
        payment_date: "2026-04-01",
        is_active: true,
      })
      .select("id")
      .single();

    if (lErr || !newLesson) {
      console.error("  ❌ 무료 수강생 lesson 생성 실패:", lErr?.message);
      return;
    }
    lessonId = newLesson.id;
    lessonCount++;
  }

  // 이미 존재하는 completed_date 확인 (중복 방지)
  const { data: existingHistory } = await supabase
    .from("lesson_history")
    .select("completed_date")
    .eq("lesson_id", lessonId);

  const existingDates = new Set(
    (existingHistory || []).map((h: any) => String(h.completed_date).slice(0, 10))
  );

  // 2025년 1~12월, 2026년 1~4월
  const allMonths: { year: number; month: number }[] = [];
  for (let m = 1; m <= 12; m++) allMonths.push({ year: 2025, month: m });
  for (let m = 1; m <= 4;  m++) allMonths.push({ year: 2026, month: m });

  const newRows = allMonths
    .filter(({ year, month }) => !existingDates.has(toDateStr(year, month, 1)))
    .map(({ year, month }) => ({
      lesson_id: lessonId,
      session_number: 0,
      completed_date: toDateStr(year, month, 1),
      user_id: realProfile.id,
      status: "결제 완료",
      tuition_snapshot: 0,
      category_snapshot: "어린이단체",
    }));

  if (newRows.length === 0) {
    console.log("  ℹ️  lesson_history 이미 완전히 삽입됨, 스킵");
    return;
  }

  const { error: hErr } = await supabase.from("lesson_history").insert(newRows);
  if (hErr) console.error("  ❌ lesson_history INSERT 실패:", hErr.message);
  else {
    historyCount += newRows.length;
    console.log(`  ✅ lesson_history ${newRows.length}건 삽입 완료 (${existingDates.size}건은 이미 존재, 스킵)`);
  }
}

// ────────────────────────────────────────────────────
// 18. 외부수입 중복 제거 + INSERT
// ────────────────────────────────────────────────────

/**
 * date+type+amount+description 조합이 완전히 동일한 항목이 있으면
 * 첫 번째 항목만 남기고 나머지를 제거한다 (Fix 8).
 */
function deduplicateExternalIncome(records: ExternalIncomeRow[]): ExternalIncomeRow[] {
  const seen = new Set<string>();
  const result: ExternalIncomeRow[] = [];
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2,"0")}-${String(r.day).padStart(2,"0")}|${r.type}|${r.amountMan}|${r.description}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(r);
    }
  }
  const removed = records.length - result.length;
  if (removed > 0) console.log(`  🔍 외부수입 중복 제거: ${removed}건 → ${result.length}건 남음`);
  return result;
}

async function insertExternalIncome(records: ExternalIncomeRow[]): Promise<void> {
  if (records.length === 0) return;

  const deduplicated = deduplicateExternalIncome(records);

  const rows = deduplicated.map((r) => ({
    type: r.type,
    description: r.description || r.type,
    amount: Math.round(r.amountMan * 10000),
    income_date: toDateStr(r.year, r.month, r.day),
    notes: null,
  }));

  if (DRY_RUN) {
    for (const r of rows) {
      console.log(`  [DRY] 외부수입: [${r.type}] ${r.description}, ${r.amount}원, ${r.income_date}`);
    }
    externalCount += rows.length;
    return;
  }

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("external_income").insert(batch);
    if (error) {
      console.error(`  ❌ external_income 배치 INSERT 실패:`, error.message);
      for (const row of batch) {
        const { error: sErr } = await supabase.from("external_income").insert(row);
        if (sErr) console.error(`    ❌ ${row.income_date} ${row.type}: ${sErr.message}`);
        else externalCount++;
      }
    } else {
      externalCount += batch.length;
    }
  }
}

// ────────────────────────────────────────────────────
// 19. 과거 수강생 일괄 승인 처리 (Fix 9)
// ────────────────────────────────────────────────────

/**
 * 마이그레이션된 프로필 중 status != 'active'인 것을 모두 'active'로 업데이트.
 * 관리자 '승인 대기' 목록에서 과거 수강생들이 사라진다.
 */
async function approveAllMigratedProfiles(profileIds: string[]): Promise<void> {
  if (profileIds.length === 0) return;
  console.log(`\n👤 과거 수강생 일괄 승인 처리 (대상: ${profileIds.length}명)...`);
  if (DRY_RUN) { console.log("  [DRY] 스킵"); return; }

  // 500개 배치 단위로 업데이트
  let approved = 0;
  for (let i = 0; i < profileIds.length; i += 500) {
    const batch = profileIds.slice(i, i + 500);
    const { error, count } = await supabase
      .from("profiles")
      .update({ status: "active" })
      .in("id", batch)
      .neq("status", "active");
    if (error) console.error("  ❌ 일괄 승인 실패:", error.message);
    else approved += count ?? 0;
  }
  console.log(`  ✅ ${approved}명 → status='active' 업데이트 완료 (승인 대기 목록에서 제거)`);
}

// ────────────────────────────────────────────────────
// 20. 메인 실행
// ────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" 김포국악원 롤백 & 재마이그레이션 (v4.7.26)");
  console.log(DRY_RUN ? " (DRY RUN — DB 변경 없음)" : " (LIVE — DB 반영)");
  console.log("═══════════════════════════════════════════════════════\n");

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ 엑셀 파일 없음: ${EXCEL_PATH}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(EXCEL_PATH);
  console.log(`📊 엑셀 로드: ${wb.SheetNames.join(", ")}\n`);

  // ════════════════════════════════════════════════
  // STEP 1: 절대 시간 기준 완전 롤백
  // ════════════════════════════════════════════════
  console.log("┌──────────────────────────────────────────────────────┐");
  console.log("│  STEP 1: 절대 시간 롤백 (2026-04-02 00:00 KST 이후)  │");
  console.log("└──────────────────────────────────────────────────────┘");

  await rollbackAll();

  // ════════════════════════════════════════════════
  // STEP 2: DB 최신 상태 로드 (롤백 이후)
  // ════════════════════════════════════════════════
  console.log("\n📥 DB 상태 로드...");
  const existingProfiles = await loadExistingProfiles();
  const activePhones = await loadActiveStudentPhones(); // is_active=true 수강생 전화번호
  const preloadedIds = new Set(existingProfiles.map((p) => p.id));
  console.log(`  프로필 ${existingProfiles.length}개, 현재 활성 수강생 ${activePhones.size}명`);

  // 민다현: is_active=true 포함 전량 삭제 후 엑셀 기준 재생성
  console.log("\n🗑️  민다현 기존 데이터 전량 정리...");
  await clearMindahyun(existingProfiles);

  // ════════════════════════════════════════════════
  // STEP 3: 엑셀 파싱
  // ════════════════════════════════════════════════
  console.log("\n📋 수강 시트 파싱...");
  const allStudentRows: RawStudentRow[] = [];
  for (const sheetName of ["23년", "24년", "25년", "26년"]) {
    const parsed = parseStudentSheet(wb, sheetName);
    console.log(`  ${sheetName}: ${parsed.length}개 행`);
    allStudentRows.push(...parsed);
  }
  console.log(`  합계: ${allStudentRows.length}개 행`);

  // ════════════════════════════════════════════════
  // STEP 4: 학생 그룹핑 & 특수 케이스
  // ════════════════════════════════════════════════
  console.log("\n👥 학생 그룹핑...");
  const persons = groupStudents(allStudentRows);
  console.log(`  고유 인물: ${persons.size}명`);

  console.log("\n⚙️  특수 케이스 처리...");
  // Fix 4: 유지연 25년 80만원 1건 + 종료됨 강제
  handleYoojiyeon(persons);

  // 이율/이윤 관련 → persons에서 제거 (별도 처리)
  for (const [key, person] of persons) {
    if (!person.phone) continue;
    const isWrong = person.phone === WRONG_FREE_PHONE;
    const isReal  = person.phone === FREE_STUDENT_REAL_PHONE;
    const isByName = FREE_STUDENT_EXCEL_NAMES.some(
      (n) => person.name === n || person.name.includes(n)
    );
    if (isWrong || isReal || isByName) {
      persons.delete(key);
      console.log(`  ℹ️  이율/이윤 관련 분리: ${person.name} (${person.phone})`);
    }
  }

  // ════════════════════════════════════════════════
  // STEP 5: 수강 데이터 마이그레이션
  // ════════════════════════════════════════════════
  console.log("\n┌──────────────────────────────────────────────────┐");
  console.log("│  STEP 5: 수강 데이터 마이그레이션                │");
  console.log("└──────────────────────────────────────────────────┘");

  let profileCreated = 0;
  let profileReused  = 0;
  let personIndex    = 0;
  let skippedYear26  = 0;
  const migratedProfileIds: string[] = []; // Fix 9: 승인 처리용 ID 수집

  for (const [, person] of persons) {
    personIndex++;

    const result = await getOrCreateProfile(
      person.name, person.phone!, existingProfiles, preloadedIds
    );
    if (!result) {
      console.error(`  ⚠️  ${person.name} (${person.phone}) 프로필 처리 실패, 스킵`);
      continue;
    }

    const { id: profileId, wasExisting } = result;
    wasExisting ? profileReused++ : profileCreated++;
    migratedProfileIds.push(profileId); // Fix 9: 수집

    const yearsStr = Array.from(person.yearData.keys()).sort().join(", ");
    console.log(
      `  [${personIndex}/${persons.size}] ${person.name} (${person.phone}) — ${yearsStr}년 ${wasExisting ? "(기존)" : "(신규)"}`
    );

    // 기존 종료된 수업 삭제 (멱등성)
    if (!DRY_RUN) {
      const deleted = await clearClosedLessons(profileId);
      if (deleted > 0) console.log(`    🗑️  종료된 수업 ${deleted}건 삭제`);
    }

    // 연도별 수업 생성
    for (const [year, catMap] of person.yearData) {
      // ★ Fix 2: 활성 수강생의 26년 데이터 완전 스킵 (민다현 제외) ★
      if (year === 2026
        && activePhones.has(person.phone!)
        && person.phone !== MINDAHYUN_PHONE) {
        skippedYear26++;
        console.log(`    ⏭️  ${year}년 스킵 (현재 활성 수강생)`);
        continue;
      }

      for (const [excelCat, payments] of catMap) {
        if (payments.length === 0) continue;

        const baseRate = person.baseRates.get(year)?.get(excelCat) ?? 0;
        const segments = determineCategorySegments(payments, excelCat, baseRate);

        for (const seg of segments) {
          if (seg.payments.length === 0) continue;

          const validCategories = [
            "성인단체", "성인개인", "어린이개인", "어린이단체", "어린이개인, 어린이단체",
          ];
          if (!validCategories.includes(seg.category)) continue;

          // 모든 마이그레이션 레코드 기본: is_active=false (종료됨)
          // Fix 4: 유지연은 위에서 이미 26년 제거 + 25년 단일화 → 무조건 false
          let isActive = false;

          // 민다현만 최신 연도 is_active=true
          if (person.phone === MINDAHYUN_PHONE) {
            const maxYear = Math.max(...Array.from(person.yearData.keys()));
            if (year === maxYear) isActive = true;
          }

          await createLessonWithHistory(
            profileId, seg.category, seg.tuitionWon, seg.payments, year, isActive
          );
        }
      }
    }
  }

  // ════════════════════════════════════════════════
  // STEP 6: 이율/이윤 무료 수강생 처리
  // ════════════════════════════════════════════════
  await handleFreeStudents(existingProfiles);

  // ════════════════════════════════════════════════
  // STEP 7: 외부수입 마이그레이션 (Fix 5)
  // ════════════════════════════════════════════════
  console.log("\n┌──────────────────────────────────────────────────┐");
  console.log("│  STEP 7: 외부수입 마이그레이션 (체험비/기타/강사수수료) │");
  console.log("└──────────────────────────────────────────────────┘");

  const externalRecords: ExternalIncomeRow[] = [];

  console.log("  [외부24년] 파싱 중... (대금/해금 포함 행만 → 강사수수료)");
  const ext24 = parseExternal24Sheet(wb);
  console.log(`  외부24년: ${ext24.length}건`);
  externalRecords.push(...ext24);

  console.log("  [외부25년] 파싱 중...");
  const ext25 = parseExternalSheet(wb, "외부25년", 2025, 8);
  console.log(`  외부25년: ${ext25.length}건`);
  externalRecords.push(...ext25);

  console.log("  [외부26년] 파싱 중...");
  const ext26 = parseExternalSheet(wb, "외부26년", 2026, 9);
  console.log(`  외부26년: ${ext26.length}건`);
  externalRecords.push(...ext26);

  console.log(`  합계: ${externalRecords.length}건`);
  await insertExternalIncome(externalRecords);

  // ════════════════════════════════════════════════
  // STEP 8: 과거 수강생 일괄 승인 처리 (Fix 9)
  // ════════════════════════════════════════════════
  await approveAllMigratedProfiles(migratedProfileIds);

  // ════════════════════════════════════════════════
  // 결과 요약
  // ════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(" 완료!");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  📌 프로필 신규 생성:               ${profileCreated}개`);
  console.log(`  📌 프로필 재사용 (기존):            ${profileReused}개`);
  console.log(`  📌 26년 스킵 (활성 수강생):         ${skippedYear26}건`);
  console.log(`  📌 수업(lessons) 생성:             ${lessonCount}개`);
  console.log(`  📌 결제 이력(lesson_history) 생성: ${historyCount}개`);
  console.log(`  📌 외부수입(external_income) 생성: ${externalCount}개`);
  if (DRY_RUN) {
    console.log("\n  ⚠️  DRY RUN — 실제 DB에는 반영되지 않았습니다.");
    console.log("  실제 반영: npx ts-node --project scripts/tsconfig.json scripts/rollback_and_migrate.ts");
  }
  console.log("");
}

main().catch((err) => {
  console.error("❌ 치명적 오류:", err);
  process.exit(1);
});
