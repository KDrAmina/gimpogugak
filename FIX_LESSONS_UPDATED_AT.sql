-- 긴급 수정: lessons 테이블에 updated_at 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

-- Step 1: updated_at 컬럼이 있는지 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lessons' AND column_name = 'updated_at';

-- Step 2: updated_at 컬럼 추가 (없는 경우에만 실행됨)
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 3: 기존 레코드의 updated_at을 created_at으로 설정
UPDATE lessons 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Step 4: 자동 업데이트 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_lessons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: 트리거 생성 (이미 있으면 삭제 후 재생성)
DROP TRIGGER IF EXISTS set_lessons_updated_at ON lessons;

CREATE TRIGGER set_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_lessons_updated_at();

-- Step 6: 확인 쿼리
SELECT 
  id,
  user_id,
  category,
  is_active,
  created_at,
  updated_at
FROM lessons 
LIMIT 5;

-- Step 7: 테스트 업데이트 (선택사항)
-- UPDATE lessons SET is_active = is_active WHERE id = (SELECT id FROM lessons LIMIT 1);
-- 위 명령 실행 후 updated_at이 자동으로 변경되는지 확인
