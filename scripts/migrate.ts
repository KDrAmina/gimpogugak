/**
 * LESSON_DATA.xlsx → Supabase 일괄 마이그레이션 스크립트
 *
 * 대상 시트: 23년, 24년, 25년, 26년 (수강 이력) / 외부24년, 외부25년, 외부26년 (외부수입)
 *
 * v4.7.22: 멱등성(idempotent) 대응 — 중복 실행해도 안전하도록 기존 마이그레이션 데이터를 먼저 삭제 후 재삽입
 *
 * 실행:
 *   npx ts-node --project scripts/tsconfig.json scripts/migrate.ts
 *   npx ts-node --project scripts/tsconfig.json scripts/migrate.ts --dry-run
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

// ────────────────────────────────────────────────────
// 2. 타입 정의
// ────────────────────────────────────────────────────

interface MonthlyPayment {
  month: number; // 1-12
  day: number; // 결제일
  amount: number; // 만원 단위
}

interface RawStudentRow {
  name: string;
  phone: string | null;
  excelCategory: string; // 엑셀 col3 원본
  baseRate: number; // col5 (만원)
  year: number;
  payments: MonthlyPayment[];
}

interface CategorySegment {
  category: string; // DB 카테고리
  payments: MonthlyPayment[];
  tuitionWon: number; // 원 단위 (대표 수강료)
}

interface ExternalIncomeRow {
  description: string;
  year: number;
  month: number;
  day: number;
  amountMan: number; // 만원
}

// ────────────────────────────────────────────────────
// 3. 상수 & 특수 케이스
// ────────────────────────────────────────────────────

const YEAR_MAP: Record<string, number> = {
  "23년": 2023,
  "24년": 2024,
  "25년": 2025,
  "26년": 2026,
};

const CATEGORY_FIX: Record<string, string> = {
  성안개인: "성인개인",
  성안단체: "성인단체",
};

/** col0/col1에 이 텍스트가 포함되면 학생 행이 아님 → 스킵 */
const SKIP_WORDS = [
  "총",
  "투자",
  "외부",
  "과목",
  "입금",
  "휴식",
  "합창",
  "악기",
  "구로",
  "평균",
  "수강인원",
  "24년도",
  "NI",
  "합창휴식",
  "외부24년",
  "외부25년",
  "외부26년",
  "악기대여",
  "악기25년",
  "총인원",
];

/** 이율/이윤 무료 수강생 전화번호 */
const FREE_STUDENT_PHONE = "010-2718-0838";
const FREE_STUDENT_NAMES = ["이율,이윤", "이율", "이윤"];

/** 민다현 전화번호 (DB 덮어쓰기 대상) */
const MINDAHYUN_PHONE = "010-9795-9202";

/** 유지연 전화번호 (25년도 특수 처리) */
const YOOJIYEON_PHONE = "010-3858-4019";

// ────────────────────────────────────────────────────
// 4. 엑셀 파싱 — 수강 시트
// ────────────────────────────────────────────────────

function normalizePhone(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\s/g, "");
  if (/^01[0-9]-?\d{3,4}-?\d{4}$/.test(s)) {
    // 하이픈 정규화
    const digits = s.replace(/-/g, "");
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return null;
}

function normalizeCategory(raw: string): string {
  const t = raw.trim();
  return CATEGORY_FIX[t] || t;
}

function isStudentRow(row: any[]): boolean {
  const col1 = row[1];
  if (!col1 || typeof col1 !== "string" || col1.trim().length < 2) return false;

  const col0Str = String(row[0] ?? "").trim();
  // col0이 숫자 번호이거나 빈값이거나 "심화","시창" 등 → OK
  // 스킵해야 할 키워드가 col0 또는 col1에 있으면 → 스킵
  for (const w of SKIP_WORDS) {
    if (col0Str === w || col1.trim() === w) return false;
  }
  if (col0Str === "어린이 개인" || col0Str === "성인 개인") return false;
  if (col0Str === "어린이 단체" || col0Str === "성인 단체") return false;
  if (col0Str === "어린이개인" || col0Str === "성인개인") return false;
  if (col0Str === "어린이단체" || col0Str === "성인단체") return false;
  if (col0Str === "개인" || col0Str === "단체") return false;
  if (col0Str === "어린이" || col0Str === "성인") return false;

  return true;
}

function parseStudentSheet(
  wb: XLSX.WorkBook,
  sheetName: string
): RawStudentRow[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  });
  const year = YEAR_MAP[sheetName];
  const results: RawStudentRow[] = [];

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 8) continue;
    if (!isStudentRow(row)) continue;

    const name = String(row[1]).trim();
    const phone = normalizePhone(row[2]);
    const rawCat = String(row[3] ?? "").trim();
    const excelCategory = normalizeCategory(rawCat);
    const baseRate = typeof row[5] === "number" ? row[5] : 0;

    // 카테고리가 유효한지 확인
    const validCats = [
      "성인단체",
      "성인개인",
      "어린이개인",
      "어린이단체",
    ];
    if (!validCats.includes(excelCategory)) {
      // "심화", "시창", "장구" 등의 특수 수업이거나 잘못된 값 → col3 무시하고 섹션 카테고리 사용
      // 여기서는 스킵하지 않고, 가능한 범위 내에서 추정
      // 완전히 무효한 경우만 스킵
      if (
        excelCategory &&
        !excelCategory.includes("어린이") &&
        !excelCategory.includes("성인") &&
        excelCategory.length > 0
      ) {
        // 비어있지 않은데 유효하지 않은 카테고리 → 스킵하지 말고 그대로 기록
        // (나중에 필터링)
      }
    }

    // 월별 결제 파싱
    const payments: MonthlyPayment[] = [];
    for (let m = 0; m < 12; m++) {
      const dateIdx = 7 + m * 2;
      const amountIdx = 8 + m * 2;
      const dateVal = row[dateIdx];
      const amountVal = row[amountIdx];

      if (
        amountVal != null &&
        typeof amountVal === "number" &&
        amountVal > 0
      ) {
        let day = 1;
        if (typeof dateVal === "number" && dateVal >= 1 && dateVal <= 31) {
          day = dateVal;
        } else if (typeof dateVal === "string") {
          const match = dateVal.match(/(\d+)/);
          if (match) day = parseInt(match[1]);
        }

        payments.push({ month: m + 1, day, amount: amountVal });
      }
    }

    if (payments.length === 0 && baseRate === 0) continue; // 빈 행 스킵

    results.push({ name, phone, excelCategory, baseRate, year, payments });
  }

  return results;
}

// ────────────────────────────────────────────────────
// 5. 카테고리 변동 감지 & 세그먼트 분리
// ────────────────────────────────────────────────────

function determineCategorySegments(
  payments: MonthlyPayment[],
  excelCategory: string,
  baseRate: number
): CategorySegment[] {
  if (payments.length === 0) {
    return [
      {
        category: excelCategory,
        payments: [],
        tuitionWon: baseRate * 10000,
      },
    ];
  }

  // 고유 금액 추출
  const amounts = [...new Set(payments.map((p) => p.amount))].sort(
    (a, b) => a - b
  );

  // 금액이 1가지 → 변동 없음 → 엑셀 카테고리 사용
  if (amounts.length === 1) {
    return [
      {
        category: excelCategory,
        payments,
        tuitionWon: amounts[0] * 10000,
      },
    ];
  }

  // 어린이 카테고리에서만 변동 규칙 적용
  if (!excelCategory.includes("어린이")) {
    // 성인은 변동 규칙 미적용 → 엑셀 카테고리 유지
    const lastAmount = payments[payments.length - 1].amount;
    return [
      {
        category: excelCategory,
        payments,
        tuitionWon: lastAmount * 10000,
      },
    ];
  }

  // 2가지 금액일 때 전환 규칙 적용
  if (amounts.length === 2) {
    const [low, high] = amounts;

    // 10 → 20: 10만=어린이단체, 20만=어린이개인
    if (low === 10 && high === 20) {
      return [
        {
          category: "어린이단체",
          payments: payments.filter((p) => p.amount === 10),
          tuitionWon: 100000,
        },
        {
          category: "어린이개인",
          payments: payments.filter((p) => p.amount === 20),
          tuitionWon: 200000,
        },
      ];
    }

    // 20 → 30: 30만=어린이개인,어린이단체
    if (low === 20 && high === 30) {
      return [
        {
          category: "어린이개인",
          payments: payments.filter((p) => p.amount === 20),
          tuitionWon: 200000,
        },
        {
          category: "어린이개인, 어린이단체",
          payments: payments.filter((p) => p.amount === 30),
          tuitionWon: 300000,
        },
      ];
    }

    // 15 → 20: 15만=어린이개인(할인), 20만=어린이개인,어린이단체
    if (low === 15 && high === 20) {
      return [
        {
          category: "어린이개인",
          payments: payments.filter((p) => p.amount === 15),
          tuitionWon: 150000,
        },
        {
          category: "어린이개인, 어린이단체",
          payments: payments.filter((p) => p.amount === 20),
          tuitionWon: 200000,
        },
      ];
    }

    // 10 → 30: 10만=어린이단체, 30만=어린이개인,어린이단체
    if (low === 10 && high === 30) {
      return [
        {
          category: "어린이단체",
          payments: payments.filter((p) => p.amount === 10),
          tuitionWon: 100000,
        },
        {
          category: "어린이개인, 어린이단체",
          payments: payments.filter((p) => p.amount === 30),
          tuitionWon: 300000,
        },
      ];
    }
  }

  // 그 외 → 엑셀 카테고리 유지
  const lastAmount = payments[payments.length - 1].amount;
  return [
    {
      category: excelCategory,
      payments,
      tuitionWon: lastAmount * 10000,
    },
  ];
}

// ────────────────────────────────────────────────────
// 6. 학생 그룹핑 & 병합
// ────────────────────────────────────────────────────

interface PersonRecord {
  name: string;
  phone: string | null;
  /** year → category → payments */
  yearData: Map<number, Map<string, MonthlyPayment[]>>;
  /** year → category → baseRate */
  baseRates: Map<number, Map<string, number>>;
}

function groupStudents(rows: RawStudentRow[]): Map<string, PersonRecord> {
  const map = new Map<string, PersonRecord>();

  for (const row of rows) {
    if (!row.phone) continue; // 전화번호 없으면 스킵

    // phone:name 으로 인물 식별
    const key = `${row.phone}::${row.name}`;
    let person = map.get(key);
    if (!person) {
      person = {
        name: row.name,
        phone: row.phone,
        yearData: new Map(),
        baseRates: new Map(),
      };
      map.set(key, person);
    }

    // 연도별 카테고리별 월결제 합산 (이소영 등 중복 행 처리)
    if (!person.yearData.has(row.year)) {
      person.yearData.set(row.year, new Map());
      person.baseRates.set(row.year, new Map());
    }
    const yearCats = person.yearData.get(row.year)!;
    const yearRates = person.baseRates.get(row.year)!;

    const cat = row.excelCategory;
    if (!yearCats.has(cat)) {
      yearCats.set(cat, []);
    }
    if (!yearRates.has(cat)) {
      yearRates.set(cat, row.baseRate);
    }

    // 월별 결제 합산 (같은 연도+카테고리 내 중복 행 → 금액 합산)
    const existing = yearCats.get(cat)!;
    for (const p of row.payments) {
      const found = existing.find((e) => e.month === p.month);
      if (found) {
        found.amount += p.amount; // 합산
        if (p.day > found.day) found.day = p.day; // 더 늦은 날짜 채택
      } else {
        existing.push({ ...p });
      }
    }
  }

  return map;
}

// ────────────────────────────────────────────────────
// 7. 외부수입 시트 파싱
// ────────────────────────────────────────────────────

function parseExternalSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  year: number,
  monthBaseIdx: number // 월 시작 인덱스 (24년/26년=9, 25년=8)
): ExternalIncomeRow[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  });
  const results: ExternalIncomeRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    // 강사수수료 행 감지
    const col0 = String(row[0] ?? "").trim();
    const col1 = String(row[1] ?? "").trim();

    const isInstructorFee =
      col0 === "강사수수료" || col1 === "강사수수료";
    if (!isInstructorFee) continue;

    // 설명 추출
    let description = "";
    if (col0 === "강사수수료") {
      description = col1 || "강사수수료";
    } else {
      // col1 = "강사수수료", description is in col4 or col3
      description = String(row[4] ?? row[3] ?? "강사수수료").trim();
    }

    // 월별 금액 추출
    for (let m = 0; m < 12; m++) {
      const dateIdx = monthBaseIdx + m * 3;
      const amountIdx = monthBaseIdx + m * 3 + 1; // 입금 컬럼

      const dateVal = row[dateIdx];
      const amountVal = row[amountIdx];

      if (
        amountVal != null &&
        typeof amountVal === "number" &&
        amountVal > 0
      ) {
        let day = 1;
        if (typeof dateVal === "number" && dateVal >= 1 && dateVal <= 31) {
          day = dateVal;
        }

        results.push({
          description,
          year,
          month: m + 1,
          day,
          amountMan: amountVal,
        });
      }
    }
  }

  return results;
}

// ────────────────────────────────────────────────────
// 8. DB 프로필 조회/생성
// ────────────────────────────────────────────────────

interface ExistingProfile {
  id: string;
  name: string;
  phone: string | null;
}

async function loadExistingProfiles(): Promise<ExistingProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, phone");
  if (error) {
    console.error("❌ 프로필 조회 실패:", error.message);
    return [];
  }
  return data || [];
}

async function loadActiveStudentPhones(): Promise<Set<string>> {
  // 현재 활성 수업이 있는 프로필의 전화번호 목록
  const { data, error } = await supabase
    .from("lessons")
    .select("profiles!inner(phone)")
    .eq("is_active", true);

  if (error) {
    console.error("❌ 활성 수강생 조회 실패:", error.message);
    return new Set();
  }

  const phones = new Set<string>();
  for (const row of data || []) {
    const phone = (row as any).profiles?.phone;
    if (phone) phones.add(phone);
  }
  return phones;
}

async function getOrCreateProfile(
  name: string,
  phone: string,
  existingProfiles: ExistingProfile[]
): Promise<string | null> {
  // 1. 기존 프로필에서 phone+name 매칭
  const phoneMatches = existingProfiles.filter((p) => p.phone === phone);
  if (phoneMatches.length > 0) {
    const exact = phoneMatches.find(
      (p) => p.name === name || name.includes(p.name) || p.name.includes(name)
    );
    if (exact) return exact.id;
  }

  if (DRY_RUN) {
    console.log(`  [DRY] 프로필 생성 예정: ${name} (${phone})`);
    return `dry_${phone}_${name}`;
  }

  // 2. DB에서 phone+name 으로 직접 재확인 (캐시 누락 방어)
  const { data: dbCheck } = await supabase
    .from("profiles")
    .select("id, name, phone")
    .eq("phone", phone);
  if (dbCheck && dbCheck.length > 0) {
    const exact = dbCheck.find(
      (p: any) => p.name === name || name.includes(p.name) || p.name.includes(name)
    );
    if (exact) {
      existingProfiles.push({ id: exact.id, name: exact.name, phone: exact.phone });
      return exact.id;
    }
  }

  // 3. Auth 유저 생성 → Supabase Auth가 고유 UUID를 자동 발급
  const email = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@migrate.local`;
  const { data: authData, error: authErr } =
    await supabase.auth.admin.createUser({
      email,
      password: `Migrate!${Date.now()}`,
      email_confirm: true,
      user_metadata: { name, phone },
    });

  if (authErr || !authData.user) {
    console.error(`  ❌ Auth 유저 생성 실패 (${name}):`, authErr?.message);
    return null;
  }

  const userId = authData.user.id;

  // 4. 프로필 생성 (Auth에서 반환된 고유 ID 사용, upsert로 PK 충돌 방지)
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      name,
      phone,
      role: "user",
      status: "active",
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    console.error(
      `  ❌ 프로필 UPSERT 실패 (${name}):`,
      profileErr.message
    );
    return null;
  }

  existingProfiles.push({ id: userId, name, phone });
  return userId;
}

// ────────────────────────────────────────────────────
// 9-A. 멱등성: 기존 마이그레이션 데이터 초기화
// ────────────────────────────────────────────────────

async function clearMigrationLessons(profileId: string): Promise<void> {
  // 해당 profile의 is_active=false (종료됨) lessons 삭제 → 과거 마이그레이션 데이터 정리
  // lesson_history도 함께 삭제 (FK cascade가 안 걸려 있을 수 있으므로 직접 삭제)
  const { data: oldLessons } = await supabase
    .from("lessons")
    .select("id")
    .eq("user_id", profileId)
    .eq("is_active", false);

  if (oldLessons && oldLessons.length > 0) {
    const ids = oldLessons.map((l: any) => l.id);
    // lesson_history 먼저 삭제
    const { error: histErr } = await supabase
      .from("lesson_history")
      .delete()
      .in("lesson_id", ids);
    if (histErr) {
      console.error(`    ⚠️ lesson_history 삭제 실패 (profile ${profileId}):`, histErr.message);
    }
    // lessons 삭제
    const { error: lessonErr } = await supabase
      .from("lessons")
      .delete()
      .in("id", ids);
    if (lessonErr) {
      console.error(`    ⚠️ lessons 삭제 실패 (profile ${profileId}):`, lessonErr.message);
    } else {
      console.log(`    🗑️  기존 종료된 수업 ${ids.length}건 삭제 완료`);
    }
  }
}

async function clearMigrationExternalIncome(): Promise<void> {
  if (DRY_RUN) {
    console.log("  [DRY] 기존 강사수수료 외부수입 삭제 예정");
    return;
  }
  const { error, count } = await supabase
    .from("external_income")
    .delete({ count: "exact" })
    .eq("type", "강사수수료");
  if (error) {
    console.error("  ❌ 기존 강사수수료 삭제 실패:", error.message);
  } else {
    console.log(`  🗑️  기존 강사수수료 ${count ?? 0}건 삭제 완료`);
  }
}

// ────────────────────────────────────────────────────
// 9. DB 수업 & 이력 생성
// ────────────────────────────────────────────────────

let lessonCount = 0;
let historyCount = 0;

/** 해당 연/월의 마지막 날짜 반환 */
function clampDay(year: number, month: number, day: number): number {
  const maxDay = new Date(year, month, 0).getDate(); // month is 1-indexed → Date(year, month, 0) = last day of month
  return Math.min(day, maxDay);
}

async function createLessonWithHistory(
  profileId: string,
  category: string,
  tuitionWon: number,
  payments: MonthlyPayment[],
  year: number,
  isActive: boolean
): Promise<void> {
  if (payments.length === 0) return;

  // 가장 마지막 결제일 = payment_date
  const sorted = [...payments].sort(
    (a, b) => a.month - b.month || a.day - b.day
  );
  const last = sorted[sorted.length - 1];
  const clampedDay = clampDay(year, last.month, last.day);
  const paymentDate = `${year}-${String(last.month).padStart(2, "0")}-${String(
    clampedDay
  ).padStart(2, "0")}`;

  if (DRY_RUN) {
    console.log(
      `  [DRY] lesson: ${category}, ${tuitionWon}원, ${payments.length}개월, active=${isActive}`
    );
    lessonCount++;
    historyCount += payments.length;
    return;
  }

  // lesson INSERT
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
    console.error(
      `  ❌ lesson INSERT 실패 (${category}):`,
      lessonErr?.message
    );
    return;
  }
  lessonCount++;

  // lesson_history INSERT (배치)
  const historyRows = sorted.map((p, idx) => ({
    lesson_id: lessonData.id,
    session_number: 0,
    completed_date: `${year}-${String(p.month).padStart(2, "0")}-${String(
      clampDay(year, p.month, p.day)
    ).padStart(2, "0")}`,
    user_id: profileId,
    status: "결제 완료",
    tuition_snapshot: p.amount * 10000,
    category_snapshot: category,
  }));

  // Supabase batch insert (최대 500개씩)
  for (let i = 0; i < historyRows.length; i += 500) {
    const batch = historyRows.slice(i, i + 500);
    const { error: histErr } = await supabase
      .from("lesson_history")
      .insert(batch);
    if (histErr) {
      console.error(`  ❌ lesson_history INSERT 실패:`, histErr.message);
    } else {
      historyCount += batch.length;
    }
  }
}

// ────────────────────────────────────────────────────
// 10. 특수 케이스 처리
// ────────────────────────────────────────────────────

/** 민다현: 기존 DB 데이터 삭제 */
async function clearMindahyun(profiles: ExistingProfile[]): Promise<void> {
  const profile = profiles.find(
    (p) => p.phone === MINDAHYUN_PHONE && p.name?.includes("민다현")
  );
  if (!profile) {
    console.log("  ℹ️  민다현 기존 프로필 없음 (신규 생성 예정)");
    return;
  }

  console.log(`  🗑️  민다현 기존 데이터 삭제 (profile: ${profile.id})`);
  if (DRY_RUN) return;

  // lesson_history 먼저 삭제 (FK)
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id")
    .eq("user_id", profile.id);

  if (lessons && lessons.length > 0) {
    const ids = lessons.map((l: any) => l.id);
    await supabase.from("lesson_history").delete().in("lesson_id", ids);
    await supabase.from("lessons").delete().eq("user_id", profile.id);
    console.log(`    삭제 완료: ${ids.length}개 수업`);
  }
}

/** 유지연 25년: 80만원 1건만 생성 */
function handleYoojiyeon(
  persons: Map<string, PersonRecord>
): void {
  for (const [key, person] of persons) {
    if (person.phone !== YOOJIYEON_PHONE) continue;
    if (!person.name.includes("유지연")) continue;

    const year2025 = person.yearData.get(2025);
    if (!year2025) continue;

    // 25년 데이터를 1건(2월)만 남기고 나머지 제거
    for (const [cat, payments] of year2025) {
      if (payments.length > 0) {
        const firstPayment = payments.sort((a, b) => a.month - b.month)[0];
        year2025.set(cat, [
          {
            month: firstPayment.month,
            day: firstPayment.day,
            amount: 80, // 80만원 1건
          },
        ]);
        console.log(
          `  ℹ️  유지연 25년 → 80만원 1건 (${firstPayment.month}월)`
        );
      }
    }
  }
}

/** 이율/이윤 무료 수강생: 2025-01 ~ 2026-04 매월 1일 */
async function handleFreeStudents(
  existingProfiles: ExistingProfile[],
  activePhones: Set<string>
): Promise<void> {
  console.log("\n🆓 무료 수강생 처리 (이율, 이윤)...");

  const profileId = await getOrCreateProfile(
    "이율,이윤",
    FREE_STUDENT_PHONE,
    existingProfiles
  );
  if (!profileId) {
    console.error("  ❌ 무료 수강생 프로필 생성 실패");
    return;
  }

  // 멱등성: 무료 수강생의 기존 수업(종료됨) 삭제
  if (!DRY_RUN) {
    await clearMigrationLessons(profileId);
  }

  // 2025-01 ~ 2026-04 매월 1일
  const payments: MonthlyPayment[] = [];

  // 2025년 1~12월
  for (let m = 1; m <= 12; m++) {
    payments.push({ month: m, day: 1, amount: 0 });
  }

  // 2025년 lesson
  await createFreeLesson(profileId, 2025, payments);

  // 2026년 1~4월
  const payments2026: MonthlyPayment[] = [];
  for (let m = 1; m <= 4; m++) {
    payments2026.push({ month: m, day: 1, amount: 0 });
  }

  // 2026년 lesson
  await createFreeLesson(profileId, 2026, payments2026);
}

async function createFreeLesson(
  profileId: string,
  year: number,
  payments: MonthlyPayment[]
): Promise<void> {
  const isActive = year === 2026; // 2026년 건만 활성

  if (DRY_RUN) {
    console.log(
      `  [DRY] 무료 lesson: 어린이단체, ${year}년, ${payments.length}개월, active=${isActive}`
    );
    lessonCount++;
    historyCount += payments.length;
    return;
  }

  const last = payments[payments.length - 1];
  const paymentDate = `${year}-${String(last.month).padStart(2, "0")}-01`;

  const { data: lessonData, error: lessonErr } = await supabase
    .from("lessons")
    .insert({
      user_id: profileId,
      category: "어린이단체",
      current_session: 0,
      tuition_amount: 0,
      payment_date: paymentDate,
      is_active: isActive,
    })
    .select("id")
    .single();

  if (lessonErr || !lessonData) {
    console.error("  ❌ 무료 lesson INSERT 실패:", lessonErr?.message);
    return;
  }
  lessonCount++;

  const historyRows = payments.map((p) => ({
    lesson_id: lessonData.id,
    session_number: 0,
    completed_date: `${year}-${String(p.month).padStart(2, "0")}-01`,
    user_id: profileId,
    status: "결제 완료",
    tuition_snapshot: 0,
    category_snapshot: "어린이단체",
  }));

  const { error } = await supabase.from("lesson_history").insert(historyRows);
  if (error) {
    console.error("  ❌ 무료 lesson_history INSERT 실패:", error.message);
  } else {
    historyCount += historyRows.length;
  }
}

// ────────────────────────────────────────────────────
// 11. 외부수입 DB INSERT
// ────────────────────────────────────────────────────

let externalCount = 0;

async function insertExternalIncome(
  records: ExternalIncomeRow[]
): Promise<void> {
  if (records.length === 0) return;

  const rows = records.map((r) => ({
    type: "강사수수료",
    description: r.description,
    amount: Math.round(r.amountMan * 10000),
    income_date: `${r.year}-${String(r.month).padStart(2, "0")}-${String(
      clampDay(r.year, r.month, r.day)
    ).padStart(2, "0")}`,
    notes: null,
  }));

  if (DRY_RUN) {
    for (const r of rows) {
      console.log(
        `  [DRY] 외부수입: ${r.description}, ${r.amount}원, ${r.income_date}`
      );
    }
    externalCount += rows.length;
    return;
  }

  const { error } = await supabase.from("external_income").insert(rows);
  if (error) {
    console.error("  ❌ external_income INSERT 실패:", error.message);
    // 개별 INSERT 시도
    for (const row of rows) {
      const { error: singleErr } = await supabase
        .from("external_income")
        .insert(row);
      if (singleErr) {
        console.error(
          `    ❌ ${row.description} ${row.income_date}: ${singleErr.message}`
        );
      } else {
        externalCount++;
      }
    }
  } else {
    externalCount += rows.length;
  }
}

// ────────────────────────────────────────────────────
// 12. 메인 실행
// ────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" 김포국악원 엑셀 → Supabase 마이그레이션");
  console.log(DRY_RUN ? " (DRY RUN — DB 변경 없음)" : " (LIVE — DB 반영)");
  console.log("═══════════════════════════════════════════\n");

  // 엑셀 로드
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌ 엑셀 파일 없음: ${EXCEL_PATH}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(EXCEL_PATH);
  console.log(`📊 엑셀 로드 완료: ${wb.SheetNames.join(", ")}\n`);

  // ── Step 1: 기존 DB 데이터 로드 ──
  console.log("📥 기존 DB 데이터 로드...");
  const existingProfiles = await loadExistingProfiles();
  const activePhones = await loadActiveStudentPhones();
  console.log(
    `  프로필 ${existingProfiles.length}개, 활성 수강생 전화번호 ${activePhones.size}개\n`
  );

  // ── Step 2: 민다현 기존 데이터 삭제 ──
  console.log("🗑️  민다현 기존 데이터 정리...");
  await clearMindahyun(existingProfiles);

  // ── Step 3: 수강 시트 파싱 ──
  console.log("\n📋 수강 시트 파싱...");
  const allStudentRows: RawStudentRow[] = [];
  for (const sheetName of ["23년", "24년", "25년", "26년"]) {
    const rows = parseStudentSheet(wb, sheetName);
    console.log(`  ${sheetName}: ${rows.length}개 행`);
    allStudentRows.push(...rows);
  }
  console.log(`  총 ${allStudentRows.length}개 행\n`);

  // ── Step 4: 학생 그룹핑 & 병합 ──
  console.log("👥 학생 그룹핑...");
  const persons = groupStudents(allStudentRows);
  console.log(`  고유 인물 (phone:name): ${persons.size}명\n`);

  // ── Step 5: 특수 케이스 처리 ──
  console.log("⚙️  특수 케이스 처리...");
  handleYoojiyeon(persons);

  // 이율/이윤은 별도 처리 (persons에서 제거)
  for (const [key, person] of persons) {
    if (
      person.phone === FREE_STUDENT_PHONE &&
      FREE_STUDENT_NAMES.some(
        (n) => person.name === n || person.name.includes(n)
      )
    ) {
      persons.delete(key);
      console.log(`  ℹ️  이율/이윤 → 별도 무료 수강 처리`);
    }
  }

  // ── Step 6: 프로필 생성 & 수업 데이터 INSERT ──
  console.log("\n🔄 수강 데이터 마이그레이션...");
  let profileCreated = 0;
  let profileReused = 0;
  let personIndex = 0;

  for (const [key, person] of persons) {
    personIndex++;

    // 프로필 조회/생성
    const profileId = await getOrCreateProfile(
      person.name,
      person.phone!,
      existingProfiles
    );
    if (!profileId) {
      console.error(`  ⚠️  ${person.name} (${person.phone}) 프로필 처리 실패, 스킵`);
      continue;
    }

    const wasExisting = !profileId.startsWith("dry_") &&
      existingProfiles.some((p) => p.id === profileId);
    if (wasExisting) {
      profileReused++;
    } else {
      profileCreated++;
    }

    // 처리 진행 로그
    const yearsStr = Array.from(person.yearData.keys()).sort().join(",");
    console.log(
      `  [${personIndex}/${persons.size}] ${person.name} (${person.phone}) — ${yearsStr}년 ${wasExisting ? "(기존)" : "(신규)"}`
    );

    // 멱등성: 기존 종료된 수업(마이그레이션 데이터) 삭제 후 재삽입
    if (!DRY_RUN) {
      await clearMigrationLessons(profileId);
    }

    // 연도별 카테고리별 수업 생성
    for (const [year, catMap] of person.yearData) {
      for (const [excelCat, payments] of catMap) {
        if (payments.length === 0) continue;

        const baseRate =
          person.baseRates.get(year)?.get(excelCat) ?? 0;

        // 카테고리 세그먼트 결정
        const segments = determineCategorySegments(
          payments,
          excelCat,
          baseRate
        );

        for (const seg of segments) {
          if (seg.payments.length === 0) continue;

          // 유효한 카테고리인지 확인
          const validSingle = [
            "성인단체",
            "성인개인",
            "어린이개인",
            "어린이단체",
          ];
          const isValidCategory =
            validSingle.includes(seg.category) ||
            seg.category === "어린이개인, 어린이단체";

          if (!isValidCategory) {
            // 유효하지 않은 카테고리 → 스킵 (심화, 시창 등 특수 수업)
            continue;
          }

          // is_active 결정: 모든 마이그레이션 레코드는 종료됨
          // 단, 민다현이 현재 활성이면 최신년도 lesson만 활성
          let isActive = false;
          if (
            person.phone === MINDAHYUN_PHONE &&
            person.name.includes("민다현") &&
            activePhones.has(MINDAHYUN_PHONE)
          ) {
            // 민다현의 가장 최신 연도만 활성화
            const maxYear = Math.max(
              ...Array.from(person.yearData.keys())
            );
            if (year === maxYear) isActive = true;
          }

          await createLessonWithHistory(
            profileId,
            seg.category,
            seg.tuitionWon,
            seg.payments,
            year,
            isActive
          );
        }
      }
    }
  }

  // ── Step 7: 무료 수강생 처리 ──
  await handleFreeStudents(existingProfiles, activePhones);

  // ── Step 8: 외부수입 마이그레이션 ──
  console.log("\n💰 외부수입 (강사수수료) 마이그레이션...");

  // 멱등성: 기존 강사수수료 데이터 삭제 후 재삽입
  console.log("  🗑️  기존 강사수수료 데이터 초기화...");
  await clearMigrationExternalIncome();

  const externalRecords: ExternalIncomeRow[] = [];

  // 외부24년: 월 base index = 9
  const ext24 = parseExternalSheet(wb, "외부24년", 2024, 9);
  console.log(`  외부24년: ${ext24.length}건`);
  externalRecords.push(...ext24);

  // 외부25년: 월 base index = 8
  const ext25 = parseExternalSheet(wb, "외부25년", 2025, 8);
  console.log(`  외부25년: ${ext25.length}건`);
  externalRecords.push(...ext25);

  // 외부26년: 월 base index = 9
  const ext26 = parseExternalSheet(wb, "외부26년", 2026, 9);
  console.log(`  외부26년: ${ext26.length}건`);
  externalRecords.push(...ext26);

  await insertExternalIncome(externalRecords);

  // ── 결과 요약 ──
  console.log("\n═══════════════════════════════════════════");
  console.log(" 마이그레이션 완료!");
  console.log("═══════════════════════════════════════════");
  console.log(`  📌 프로필 생성: ${profileCreated}개`);
  console.log(`  📌 프로필 재사용: ${profileReused}개`);
  console.log(`  📌 수업(lessons) 생성: ${lessonCount}개`);
  console.log(`  📌 결제 이력(lesson_history) 생성: ${historyCount}개`);
  console.log(`  📌 외부수입(external_income) 생성: ${externalCount}개`);
  if (DRY_RUN) {
    console.log("\n  ⚠️  DRY RUN — 실제 DB에는 반영되지 않았습니다.");
    console.log(
      "  실제 반영: npx ts-node --project scripts/tsconfig.json scripts/migrate.ts"
    );
  }
  console.log("");
}

main().catch((err) => {
  console.error("❌ 치명적 오류:", err);
  process.exit(1);
});
