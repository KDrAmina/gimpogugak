/**
 * 회원관리.xlsx → migration_preview.json 변환 스크립트
 *
 * 실행: node scripts/migrate_members.js
 *
 * 1단계: Excel 파싱 → 정제 → migration_preview.json 생성
 * 2단계: 사용자 확인 후 upload_to_db.js 로 실제 DB 반영
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// ── 설정 ──────────────────────────────────────────
const EXCEL_PATH =
  "z:/김포국악원/01 행정 및 운영/02 회원관리/회원관리.xlsx";
const TARGET_SHEETS = ["23년", "24년", "25년", "26년"];
const OUTPUT_PATH = path.join(__dirname, "..", "migration_preview.json");

// 시트명 → 연도
const YEAR_MAP = { "23년": 2023, "24년": 2024, "25년": 2025, "26년": 2026 };

// 카테고리 매핑 (Excel 카테고리 → DB category)
// 현재 진행 중인 카테고리 섹션을 추적하며, 어린이/성인 + 개인/단체 조합으로 매핑
const CATEGORY_KEYWORDS = {
  어린이: "어린이",
  성인: "성인",
  개인: "개인",
  단체: "단체",
};

// 휴식 상태인 학생은 파싱하되 is_resting 태그
const SKIP_CATEGORIES = ["총", "투자", "외부", "과목", "입금"];

// ── 파싱 ──────────────────────────────────────────

function parseSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`시트 "${sheetName}" 없음, 건너뜀`);
    return [];
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const year = YEAR_MAP[sheetName];
  const records = [];

  let currentAgeGroup = null; // '어린이' | '성인' | null
  let currentLessonType = null; // '개인' | '단체' | null
  let currentSpecial = null; // '심화' | '시창' | '장구' | '합창' | '전공' | null
  let isRestSection = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const col0 = row[0];
    const col1 = row[1];
    const col2 = row[2];
    const col3 = row[3];
    const col4 = row[4];
    const col5 = row[5]; // 월 수업료 (만원)

    // ── 카테고리 헤더 감지 ──
    if (typeof col0 === "string") {
      const trimmed = col0.trim();

      // 스킵해야 할 행
      if (SKIP_CATEGORIES.some((s) => trimmed.startsWith(s))) continue;

      // 휴식 섹션
      if (trimmed === "휴식" || trimmed === "합창휴식") {
        isRestSection = true;
        currentSpecial = null;
        continue;
      }

      // 어린이/성인 + 개인/단체 조합
      if (trimmed.includes("어린이") && trimmed.includes("단체")) {
        currentAgeGroup = "어린이";
        currentLessonType = "단체";
        currentSpecial = null;
        isRestSection = false;
        continue;
      }
      if (trimmed.includes("어린이")) {
        currentAgeGroup = "어린이";
        currentLessonType = "개인";
        currentSpecial = null;
        isRestSection = false;
        continue;
      }
      if (trimmed.includes("성인") && trimmed.includes("단체")) {
        currentAgeGroup = "성인";
        currentLessonType = "단체";
        currentSpecial = null;
        isRestSection = false;
        continue;
      }
      if (trimmed.includes("성인")) {
        currentAgeGroup = "성인";
        currentLessonType = "개인";
        currentSpecial = null;
        isRestSection = false;
        continue;
      }
      if (trimmed === "개인") {
        // 23년/24년에서 나이 그룹 미지정 개인 → 기본 '어린이개인' (실제 데이터 보면 어린이가 주)
        // 24년의 경우 섹션 구조가 명확하지 않으므로 아래에서 이름별로 추정
        currentLessonType = "개인";
        currentSpecial = null;
        isRestSection = false;
        continue;
      }
      if (trimmed === "단체") {
        currentLessonType = "단체";
        currentSpecial = null;
        isRestSection = false;
        continue;
      }

      // 특수 수업 (심화, 시창, 장구, 합창, 전공)
      if (["심화", "시창", "시청", "장구", "합창", "전공"].includes(trimmed)) {
        currentSpecial = trimmed === "시청" ? "시창" : trimmed;
        isRestSection = false;
      }

      // 번호 패턴 (예: "1,2", "12,13", "7,8", "10,11") - 시간대 표시, 무시
      if (/^\d+(,\d+)*$/.test(trimmed)) {
        // 하지만 이 행에 학생 데이터가 있을 수 있음 (이름이 col1에)
        if (col1 && typeof col1 === "string" && col1.length >= 2) {
          // 학생 데이터가 있으면 아래에서 처리
        } else {
          continue;
        }
      }

      // 이 행 자체에 학생 데이터가 있을 수 있음 (심화, 시창 등 카테고리 + 이름)
      if (
        ["심화", "시창", "시청", "장구", "합창", "전공"].includes(trimmed) &&
        col1 &&
        typeof col1 === "string" &&
        col1.length >= 2
      ) {
        // 이 행은 카테고리이면서 동시에 학생 데이터
        const record = extractStudentRecord(
          row,
          year,
          resolveCategory(
            currentAgeGroup,
            currentLessonType,
            currentSpecial,
            sheetName
          ),
          currentSpecial || trimmed,
          isRestSection
        );
        if (record) records.push(record);
        continue;
      }
    }

    // ── 학생 데이터 행 감지 ──
    // col0이 숫자(순번)이거나 null이고, col1이 이름(문자열 2글자 이상)
    const isStudentRow =
      (typeof col0 === "number" || col0 === null || col0 === undefined) &&
      col1 &&
      typeof col1 === "string" &&
      col1.length >= 1 &&
      !["구로", "외부24년", "외부25년", "외부26년", "악기대여", "악기25년"].includes(col1);

    if (isStudentRow) {
      const record = extractStudentRecord(
        row,
        year,
        resolveCategory(
          currentAgeGroup,
          currentLessonType,
          currentSpecial,
          sheetName
        ),
        currentSpecial,
        isRestSection
      );
      if (record) records.push(record);
    }
  }

  return records;
}

function resolveCategory(ageGroup, lessonType, special, sheetName) {
  // 23년, 24년 초기 시트에서는 ageGroup이 없을 수 있음
  if (!ageGroup) {
    // 23년 '개인' 섹션 → 혼합 (어린이+성인 개인)
    // 24년 '개인' 섹션 → 혼합
    // 이름 기반으로는 구분 어려우므로 '개인' 으로 우선 태그
    if (lessonType === "개인") return "개인";
    if (lessonType === "단체") return "단체";
  }

  if (special) {
    return special; // 심화, 시창, 장구, 합창, 전공
  }

  if (ageGroup && lessonType) {
    return `${ageGroup}${lessonType}`; // 어린이개인, 성인단체 등
  }

  return ageGroup || lessonType || "기타";
}

function extractStudentRecord(row, year, category, special, isResting) {
  const name = cleanName(String(row[1] || "").trim());
  if (!name || name.length < 1) return null;

  let phone = row[2] ? String(row[2]).trim() : null;
  // 전화번호 아닌 값 정리
  if (phone && !phone.match(/^01[0-9]-/)) {
    phone = null;
  }

  const fee = typeof row[5] === "number" ? row[5] : null; // 만원 단위
  const note = row[3] ? String(row[3]).trim() : null;
  const note2 = row[4] ? String(row[4]).trim() : null;

  // 월별 결제 데이터 파싱 (col 7~30: 1월~12월, 각 [date, amount] 쌍)
  const monthlyPayments = [];
  for (let m = 0; m < 12; m++) {
    const dateIdx = 7 + m * 2;
    const amountIdx = 8 + m * 2;
    const dateVal = row[dateIdx];
    const amountVal = row[amountIdx];

    if (amountVal != null && typeof amountVal === "number" && amountVal > 0) {
      let payDay = null;
      if (typeof dateVal === "number") {
        payDay = dateVal;
      } else if (typeof dateVal === "string") {
        const match = dateVal.match(/(\d+)/);
        if (match) payDay = parseInt(match[1]);
      }

      monthlyPayments.push({
        month: m + 1,
        year: year,
        amount: amountVal, // 만원 단위
        payment_day: payDay,
        payment_date: payDay
          ? `${year}-${String(m + 1).padStart(2, "0")}-${String(payDay).padStart(2, "0")}`
          : `${year}-${String(m + 1).padStart(2, "0")}-01`,
      });
    }
  }

  return {
    name,
    phone,
    fee,
    note,
    note2,
    year,
    category,
    special: special || null,
    is_resting: isResting,
    monthly_payments: monthlyPayments,
  };
}

function cleanName(name) {
  // 쉼표로 구분된 복수 이름 (예: "아름,다움", "초빈,초연") → 공백 구분으로 정리
  // 이것은 형제/자매 합산 결제 → 이름을 그대로 유지
  return name.replace(/\s+/g, " ").trim();
}

// ── 정제(Cleansing) ──────────────────────────────

function cleanseRecords(allRecords) {
  // 1. 동일인 통합 (phone 기반 + 이름 포함관계)
  const personMap = new Map(); // key → person object

  for (const rec of allRecords) {
    const key = findPersonKey(personMap, rec.name, rec.phone);
    if (key) {
      // 기존 인물에 레코드 추가
      const person = personMap.get(key);
      mergePerson(person, rec);
    } else {
      // 신규 인물 — 전화번호가 같은 다른 인물이 있을 수 있으므로 이름도 키에 포함
      const newKey = rec.phone ? `${rec.phone}:${rec.name}` : `name:${rec.name}`;
      personMap.set(newKey, {
        name: rec.name,
        phone: rec.phone,
        names_seen: [rec.name],
        records: [rec],
        total_payments: [...rec.monthly_payments],
        categories: new Set([rec.category]),
        fee_history: rec.fee != null ? [{ year: rec.year, fee: rec.fee, category: rec.category }] : [],
        years_active: new Set([rec.year]),
      });
    }
  }

  // 2. 최종 정제
  const students = [];
  for (const [key, person] of personMap) {
    // 이름 통합: 가장 긴 이름 선택 (성 포함 가능성 높음)
    const longestName = person.names_seen.reduce((a, b) =>
      a.length >= b.length ? a : b
    );

    // 월별 결제 중복 처리: 같은 연/월 → 가장 나중 날짜 기준
    const dedupedPayments = deduplicatePayments(person.total_payments);

    // 총 결제액
    const totalPaid = dedupedPayments.reduce((s, p) => s + p.amount, 0);

    // 마지막 결제일
    const lastPayment = dedupedPayments.length > 0
      ? dedupedPayments.sort((a, b) => b.payment_date.localeCompare(a.payment_date))[0]
      : null;

    // active/inactive 판단: 26년 데이터가 있거나, 25년 하반기(7~12월)에 결제 → active
    const recentPayments = dedupedPayments.filter(
      (p) => p.year === 2026 || (p.year === 2025 && p.month >= 7)
    );
    const isActive = recentPayments.length > 0;

    // 현재 수업료 (가장 최근 fee)
    const latestFee = person.fee_history.length > 0
      ? person.fee_history.sort((a, b) => b.year - a.year)[0].fee
      : null;

    students.push({
      name: longestName,
      phone: person.phone,
      names_merged: person.names_seen.length > 1 ? person.names_seen : undefined,
      categories: [...person.categories],
      current_fee_만원: latestFee,
      is_active: isActive,
      is_resting: person.records.some((r) => r.is_resting) && !isActive,
      years_active: [...person.years_active].sort(),
      last_payment_date: lastPayment ? lastPayment.payment_date : null,
      total_paid_만원: totalPaid,
      payment_count: dedupedPayments.length,
      monthly_payments: dedupedPayments.sort((a, b) =>
        a.payment_date.localeCompare(b.payment_date)
      ),
    });
  }

  // 이름순 정렬
  students.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return students;
}

function findPersonKey(personMap, name, phone) {
  for (const [key, person] of personMap) {
    // 1. 전화번호가 같고, 이름도 같거나 포함관계 → 동일인
    if (phone && person.phone && phone === person.phone) {
      if (namesMatch(name, person.names_seen)) {
        return key;
      }
      // 전화번호만 같고 이름이 완전히 다르면 → 가족(별도 인물), 통합하지 않음
      continue;
    }

    // 2. 전화번호가 한쪽이라도 없고, 이름 포함관계 → 동일인 가능성 높음
    //    (예: 25년 "서은"(phone=null) + 26년 "강서은"(phone=010-...))
    if (!phone || !person.phone) {
      if (namesMatch(name, person.names_seen)) {
        return key;
      }
    }
  }

  return null;
}

/**
 * 이름 매칭: 정확히 같거나, 한쪽이 다른 쪽을 포함 (성씨 누락 케이스)
 *
 * 주의: 쉼표 구분 복수이름(예: "정승은,서은")은 전체 문자열로만 비교.
 * 개별 파트("서은")를 분리해서 포함관계를 보면 다른 사람("강서은")과 오매칭됨.
 * 단, 정확히 같은 문자열이면 쉼표 유무/순서 차이만 정규화해서 매칭.
 */
function namesMatch(newName, existingNames) {
  // 쉼표/공백 정규화: "초빈 초연" ↔ "초빈,초연", "최유정,정원" ↔ "최유정정원"
  const normalize = (n) => n.replace(/[\s,]+/g, "");
  const newNorm = normalize(newName);

  for (const existing of existingNames) {
    const existNorm = normalize(existing);

    // 정확 매칭 (정규화 후)
    if (newNorm === existNorm) return true;

    // 포함관계: 쉼표가 포함된 복수이름은 제외 (다른 사람일 가능성 높음)
    if (newName.includes(",") || existing.includes(",")) continue;

    // 단일 이름끼리만 포함관계 확인
    if (newName.length >= 2 && existing.length >= 2) {
      if (newName.includes(existing) || existing.includes(newName)) {
        return true;
      }
    }
  }

  return false;
}

function mergePerson(person, rec) {
  if (!person.names_seen.includes(rec.name)) {
    person.names_seen.push(rec.name);
  }
  if (rec.phone && !person.phone) {
    person.phone = rec.phone;
  }
  person.records.push(rec);
  person.total_payments.push(...rec.monthly_payments);
  person.categories.add(rec.category);
  if (rec.fee != null) {
    person.fee_history.push({ year: rec.year, fee: rec.fee, category: rec.category });
  }
  person.years_active.add(rec.year);
}

// ── 선납 분할 (Prepayment Splitting) ─────────────

/**
 * 전체 레코드에 선납 분할을 적용한다.
 * 한 달 결제액이 기본 수강료의 N배이면 → N개월로 분할.
 *
 * 기본 수강료 유추 순서:
 *  1) 해당 레코드(학생+연도+카테고리)의 결제 최빈값
 *  2) rec.fee (Excel col5)
 *  3) 같은 카테고리·연도 전체의 최빈값
 */
function splitPrepayments(allRecords) {
  // 카테고리+연도별 전체 결제 최빈값 계산 (fallback용)
  const globalModes = buildGlobalFeeMode(allRecords);

  let splitCount = 0;
  const splitLog = [];

  for (const rec of allRecords) {
    if (rec.monthly_payments.length === 0) continue;

    const baseFee = inferBaseFee(rec, globalModes);
    if (!baseFee || baseFee <= 0) continue;

    const newPayments = [];
    // 이미 결제가 있는 월 추적 (분할 시 중복 방지)
    const occupiedMonths = new Set(
      rec.monthly_payments.map((p) => `${p.year}-${p.month}`)
    );

    for (const payment of rec.monthly_payments) {
      const ratio = payment.amount / baseFee;

      // 정수 배수이고 2배 이상이면 → 분할
      if (ratio >= 2 && Number.isInteger(ratio)) {
        const months = ratio;
        for (let i = 0; i < months; i++) {
          let targetMonth = payment.month + i;
          let targetYear = payment.year;
          // 12월 넘어가면 다음 해로
          if (targetMonth > 12) {
            targetYear += 1;
            targetMonth -= 12;
          }

          const monthKey = `${targetYear}-${targetMonth}`;
          // 첫 달은 원래 결제, 나머지는 이미 결제 있는 달이면 건너뜀
          if (i > 0 && occupiedMonths.has(monthKey)) continue;

          occupiedMonths.add(monthKey);
          newPayments.push({
            month: targetMonth,
            year: targetYear,
            amount: baseFee,
            payment_day: i === 0 ? payment.payment_day : payment.payment_day,
            payment_date:
              i === 0
                ? payment.payment_date
                : `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(payment.payment_day || 1).padStart(2, "0")}`,
            _split_from: `${payment.year}-${String(payment.month).padStart(2, "0")} (${payment.amount}만원 → ${months}개월 분할)`,
          });
        }

        splitCount++;
        splitLog.push({
          name: rec.name,
          year: rec.year,
          category: rec.category,
          original: `${payment.year}-${String(payment.month).padStart(2, "0")}`,
          amount: payment.amount,
          baseFee,
          months,
        });
      } else {
        // 분할 대상 아님 → 그대로
        newPayments.push(payment);
      }
    }

    rec.monthly_payments = newPayments;
  }

  return { splitCount, splitLog };
}

/**
 * 해당 레코드의 기본 월 수강료를 유추한다.
 *
 * 핵심 전략: rec.fee(Excel 수강료 컬럼)와 결제 최빈값(mode) 중
 * "빈 달을 채울 수 있는" 쪽을 우선한다.
 *
 * - fee=8, 매 3개월마다 24만원 → fee 기준 분할 (3개월분, 빈 달 채움)
 * - fee=10, 매달 20만원 → mode=20 사용 (빈 달 없으므로 분할 불필요)
 */
function inferBaseFee(rec, globalModes) {
  const payments = rec.monthly_payments;
  if (payments.length === 0) return null;

  const amounts = payments.map((p) => p.amount);
  const mode = payments.length >= 2 ? getMode(amounts) : null;
  const fee = rec.fee && rec.fee > 0 ? rec.fee : null;

  // 후보 수수료 목록 (fee와 mode가 다를 때 둘 다 시도)
  const candidates = [];
  if (fee) candidates.push(fee);
  if (mode && mode !== fee) candidates.push(mode);

  // 각 후보로 분할했을 때 "빈 달을 채우는 수"를 계산
  const occupiedMonths = new Set(payments.map((p) => p.month));

  let bestCandidate = null;
  let bestGapsFilled = -1;

  for (const base of candidates) {
    let gapsFilled = 0;
    let splittableCount = 0;

    for (const p of payments) {
      const ratio = p.amount / base;
      if (ratio >= 2 && Number.isInteger(ratio)) {
        splittableCount++;
        for (let i = 1; i < ratio; i++) {
          const targetMonth = p.month + i;
          if (targetMonth <= 12 && !occupiedMonths.has(targetMonth)) {
            gapsFilled++;
          }
        }
      }
    }

    // 빈 달을 가장 많이 채우는 후보 선택
    if (gapsFilled > bestGapsFilled) {
      bestGapsFilled = gapsFilled;
      bestCandidate = base;
    }
  }

  // 빈 달을 채우는 후보가 있으면 사용
  if (bestCandidate && bestGapsFilled > 0) return bestCandidate;

  // 빈 달이 없으면 (매달 결제) → mode 사용 (분할 불필요, mode가 실질 수강료)
  if (mode) return mode;

  // fallback
  if (fee) return fee;

  // 글로벌 최빈값
  const globalKey = `${rec.year}:${rec.category}`;
  if (globalModes.has(globalKey)) return globalModes.get(globalKey);

  for (const [key, val] of globalModes) {
    if (key.endsWith(`:${rec.category}`)) return val;
  }

  return null;
}

/**
 * 카테고리+연도별 결제 금액 최빈값 맵 생성
 */
function buildGlobalFeeMode(allRecords) {
  const buckets = new Map(); // "연도:카테고리" → [amounts]

  for (const rec of allRecords) {
    const key = `${rec.year}:${rec.category}`;
    if (!buckets.has(key)) buckets.set(key, []);
    for (const p of rec.monthly_payments) {
      buckets.get(key).push(p.amount);
    }
  }

  const modes = new Map();
  for (const [key, amounts] of buckets) {
    const mode = getMode(amounts);
    if (mode) modes.set(key, mode);
  }

  return modes;
}

/**
 * 배열에서 최빈값 반환 (가장 흔한 값, 동률이면 가장 작은 값)
 */
function getMode(arr) {
  if (arr.length === 0) return null;
  const freq = {};
  for (const v of arr) {
    freq[v] = (freq[v] || 0) + 1;
  }
  const sorted = Object.entries(freq).sort(
    (a, b) => b[1] - a[1] || +a[0] - +b[0]
  );
  return +sorted[0][0];
}

// ── 수동 데이터 보정 (v4.4) ──────────────────────

function applyManualFixes(records) {
  const fixes = [];

  // 1. 최지연 완전 삭제
  const before = records.length;
  records = records.filter((r) => r.name !== "최지연");
  const removed = before - records.length;
  if (removed > 0) fixes.push(`최지연: ${removed}건 삭제`);

  // 2. 유지연 — tuition_amount를 80만원(시창 수업)으로 보정
  //    엑셀에서 fee가 null로 파싱된 케이스 → fee=80 (만원 단위는 아님, 실제 80만원)
  for (const r of records) {
    if (r.name === "유지연") {
      r.fee = 80; // 만원 단위로 저장 → DB 매핑 시 ×10000
      fixes.push(`유지연: fee → 80만원`);
    }
  }

  // 3. 김규리 — tuition_amount를 30만원으로 보정
  for (const r of records) {
    if (r.name === "김규리") {
      r.fee = 30; // 만원 단위
      fixes.push(`김규리: fee → 30만원`);
    }
  }

  if (fixes.length > 0) {
    console.log(`\n🔧 수동 보정 (v4.4):`);
    for (const f of fixes) console.log(`  - ${f}`);
  }

  return records;
}

// ── 쉼표 복수이름 분리 ──────────────────────────
// "윤미호,김견희" → 윤미호 + 김견희 (독립 프로필)
// 입금 내역은 인원수로 균등 분배 → 전체 합계 보존

function splitCommaStudents(students) {
  const result = [];
  const splitLog = [];

  for (const s of students) {
    const name = s.name;
    if (!name.includes(",")) {
      result.push(s);
      continue;
    }

    const parts = name
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length >= 2);
    if (parts.length <= 1) {
      result.push(s);
      continue;
    }

    const count = parts.length;
    splitLog.push({ original: name, split_to: parts });

    for (const individualName of parts) {
      result.push({
        ...s,
        name: individualName,
        names_merged: undefined,
        // 수강료: 원본 유지 (각자 같은 수강료 납부로 간주)
        // 결제 내역: N등분 → 전체 합계 보존
        monthly_payments: s.monthly_payments.map((p) => ({
          ...p,
          amount: Math.round((p.amount / count) * 100) / 100,
        })),
        total_paid_만원: Math.round((s.total_paid_만원 / count) * 100) / 100,
        // 카테고리, 활성 상태 등은 동일
        categories: [...s.categories],
      });
    }
  }

  return { students: result, splitLog };
}

function deduplicatePayments(payments) {
  // 같은 연/월 → 가장 나중 날짜, 금액은 합산하지 않고 갱신
  const map = new Map();
  for (const p of payments) {
    const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
    const existing = map.get(key);
    if (!existing || p.payment_date > existing.payment_date) {
      map.set(key, { ...p });
    }
  }
  return [...map.values()];
}

// ── 실행 ──────────────────────────────────────────

function main() {
  console.log("📂 Excel 파일 읽는 중:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);
  console.log("📋 시트 목록:", wb.SheetNames.join(", "));

  let allRecords = [];
  for (const sheetName of TARGET_SHEETS) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.warn(`⚠️  시트 "${sheetName}" 없음, 건너뜀`);
      continue;
    }
    const records = parseSheet(wb, sheetName);
    console.log(`  ✅ ${sheetName}: ${records.length}개 레코드 파싱`);
    allRecords = allRecords.concat(records);
  }

  console.log(`\n📊 총 원본 레코드: ${allRecords.length}개`);

  // ── 데이터 보정 (v4.4) ──────────────────────────
  allRecords = applyManualFixes(allRecords);

  // 선납 분할
  const { splitCount, splitLog } = splitPrepayments(allRecords);
  if (splitCount > 0) {
    console.log(`\n💰 선납 분할 처리: ${splitCount}건`);
    for (const s of splitLog) {
      console.log(
        `  ${s.name} | ${s.original} | ${s.amount}만원 ÷ ${s.baseFee}만원 = ${s.months}개월분`
      );
    }
  }

  // 정제
  const students = cleanseRecords(allRecords);
  console.log(`👥 정제 후 고유 학생 수: ${students.length}명`);
  console.log(
    `  - 활성(active): ${students.filter((s) => s.is_active).length}명`
  );
  console.log(
    `  - 비활성(inactive): ${students.filter((s) => !s.is_active).length}명`
  );
  console.log(
    `  - 휴식: ${students.filter((s) => s.is_resting).length}명`
  );

  // 이름 통합 내역 출력
  const merged = students.filter((s) => s.names_merged);
  if (merged.length > 0) {
    console.log(`\n🔄 이름 통합 내역:`);
    for (const s of merged) {
      console.log(
        `  ${s.name} ← [${s.names_merged.join(", ")}] (phone: ${s.phone || "없음"})`
      );
    }
  }

  // 쉼표 복수이름 분리
  const { students: finalStudents, splitLog: commaLog } =
    splitCommaStudents(students);
  if (commaLog.length > 0) {
    console.log(`\n🔀 복수이름 분리: ${commaLog.length}건`);
    for (const sl of commaLog) {
      console.log(`  ${sl.original} → ${sl.split_to.join(", ")}`);
    }
    console.log(`📋 분리 후 총 학생 수: ${finalStudents.length}명`);
  }

  // DB 매핑 프리뷰 생성
  const dbPreview = {
    _meta: {
      generated_at: new Date().toISOString(),
      source_file: EXCEL_PATH,
      sheets_parsed: TARGET_SHEETS,
      total_raw_records: allRecords.length,
      total_students: finalStudents.length,
      active_count: finalStudents.filter((s) => s.is_active).length,
      inactive_count: finalStudents.filter((s) => !s.is_active).length,
    },
    students: finalStudents.map((s) => ({
      // profiles 테이블용
      profile: {
        name: s.name,
        phone: s.phone,
        role: "user",
        status: s.is_active ? "active" : "inactive",
      },
      // lessons 테이블용 (카테고리별)
      lessons: s.categories.map((cat) => ({
        category: mapToDbCategory(cat),
        original_category: cat,
        tuition_amount: (s.current_fee_만원 || 0) * 10000,
        is_active: s.is_active,
        payment_date: s.last_payment_date,
      })),
      // 통계 요약
      summary: {
        names_merged: s.names_merged,
        years_active: s.years_active,
        last_payment_date: s.last_payment_date,
        total_paid_만원: s.total_paid_만원,
        payment_count: s.payment_count,
        is_resting: s.is_resting,
      },
      // 월별 결제 내역 (lesson_history 참고용)
      payment_history: s.monthly_payments,
    })),
  };

  // JSON 파일 저장
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dbPreview, null, 2), "utf-8");
  console.log(`\n💾 저장 완료: ${OUTPUT_PATH}`);
  console.log("👉 파일을 열어서 데이터를 검증한 뒤 upload_to_db.js 를 실행하세요.");
}

function mapToDbCategory(excelCategory) {
  const map = {
    어린이개인: "어린이개인",
    어린이단체: "어린이단체",
    성인개인: "성인개인",
    성인단체: "성인단체",
    개인: "개인", // 23~24년에서 나이그룹 미지정
    단체: "단체",
    심화: "심화",
    시창: "시창",
    장구: "장구",
    합창: "합창",
    전공: "전공",
    기타: "기타",
  };
  return map[excelCategory] || excelCategory;
}

main();
