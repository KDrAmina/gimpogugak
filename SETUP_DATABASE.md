# 🚨 긴급: Supabase 데이터베이스 설정 (400 에러 해결)

## ⚠️ 400 에러가 나는 이유

`lesson_history` 테이블이 Supabase에 생성되지 않았기 때문입니다.
아래 SQL을 **Supabase SQL Editor**에서 **순서대로** 실행하세요.

---

## 📋 **STEP 1: lessons 테이블에 is_active 추가**

```sql
-- is_active 컬럼 추가 (수업 종료 기능을 위해 필요)
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_lessons_is_active ON lessons(is_active);

-- 기존 데이터 업데이트 (NULL → true)
UPDATE lessons SET is_active = true WHERE is_active IS NULL;
```

---

## 📋 **STEP 2: lesson_history 테이블 생성 (핵심)**

```sql
-- 테이블 생성
CREATE TABLE IF NOT EXISTS lesson_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_lesson_history_lesson_id ON lesson_history(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_history_completed_date ON lesson_history(completed_date);
```

---

## 📋 **STEP 3: RLS (Row Level Security) 정책 설정**

```sql
-- RLS 활성화
ALTER TABLE lesson_history ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Admins can manage lesson history" ON lesson_history;
DROP POLICY IF EXISTS "Users can view own lesson history" ON lesson_history;

-- 정책 1: Admin은 모든 히스토리 관리 가능
CREATE POLICY "Admins can manage lesson history"
  ON lesson_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 정책 2: User는 본인 수업 히스토리만 조회 가능
CREATE POLICY "Users can view own lesson history"
  ON lesson_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_history.lesson_id
      AND lessons.user_id = auth.uid()
    )
  );
```

---

## 📋 **STEP 4: 테스트 쿼리 실행**

```sql
-- 1. 테이블이 생성되었는지 확인
SELECT * FROM lesson_history LIMIT 1;

-- 2. 조인이 작동하는지 확인
SELECT 
  lh.id,
  lh.completed_date,
  lh.session_number,
  l.category,
  p.name
FROM lesson_history lh
INNER JOIN lessons l ON l.id = lh.lesson_id
INNER JOIN profiles p ON p.id = l.user_id
ORDER BY lh.completed_date DESC
LIMIT 5;

-- 3. RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'lesson_history';
```

---

## 📋 **STEP 5: 테스트 데이터 삽입 (선택사항)**

```sql
-- 오늘 날짜로 테스트 히스토리 추가
INSERT INTO lesson_history (lesson_id, session_number, completed_date)
VALUES (
  (SELECT id FROM lessons WHERE is_active = true LIMIT 1),
  1,
  CURRENT_DATE
);

-- 어제 날짜로 테스트 히스토리 추가
INSERT INTO lesson_history (lesson_id, session_number, completed_date)
VALUES (
  (SELECT id FROM lessons WHERE is_active = true LIMIT 1),
  2,
  CURRENT_DATE - INTERVAL '1 day'
);
```

---

## ✅ **확인 방법**

### 1. Supabase Dashboard에서:
1. **Table Editor** → `lesson_history` 테이블이 보이는지 확인
2. 테이블 클릭 → 컬럼 확인:
   - ✅ `id` (UUID)
   - ✅ `lesson_id` (UUID, Foreign Key)
   - ✅ `session_number` (INTEGER)
   - ✅ `completed_date` (DATE)
   - ✅ `note` (TEXT, nullable)
   - ✅ `created_at` (TIMESTAMP)

### 2. 브라우저 콘솔에서:
1. F12 → Console 탭
2. 페이지 새로고침
3. 다음 로그가 보여야 합니다:
   ```
   🔄 Loading lesson history...
   ✅ Successfully loaded 0 history records
   (또는 테이블이 없으면)
   ❌ lesson_history table not found or not accessible
   ```

### 3. 수업 완료 버튼 클릭 후:
```
📝 Inserting history record: {lesson_id: "...", session_number: 2, completed_date: "2024-02-10"}
✅ History inserted successfully: [{...}]
✅ Successfully loaded 1 history records
```

---

## 🎯 **문제 해결**

### "400 Bad Request" 에러:
→ `lesson_history` 테이블이 없습니다. **STEP 2**의 SQL을 실행하세요.

### "PGRST116" 에러:
→ RLS 정책이 없습니다. **STEP 3**의 SQL을 실행하세요.

### "Foreign key violation" 에러:
→ `lessons` 테이블에 해당 `lesson_id`가 없습니다. 올바른 `lesson_id`를 사용하세요.

### 캘린더에 이름이 안 보이는 경우:
1. F12 콘솔에서 "✅ Successfully loaded" 로그 확인
2. 로그에 `student_name`이 "Unknown"으로 나오면 → `profiles` 테이블 조인 문제
3. 로그에 날짜가 다르게 나오면 → 날짜 형식 불일치

---

## 📞 추가 도움

1. **Supabase Dashboard**: https://app.supabase.com
2. **SQL Editor**: 왼쪽 메뉴 → SQL Editor
3. **Table Editor**: 왼쪽 메뉴 → Table Editor → lesson_history

SQL 실행 후 **페이지를 새로고침**하면 캘린더에 학생 이름이 표시됩니다! 🚀
