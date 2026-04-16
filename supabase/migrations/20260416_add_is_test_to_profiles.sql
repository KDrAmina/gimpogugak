-- ============================================================
-- profiles 테이블에 is_test 컬럼 추가
-- 목적: 통계 집계에서 테스트 계정을 제외하기 위한 플래그
--       is_test = true 인 계정은 대시보드 모든 KPI/그래프에서 제외됩니다.
--
-- 실행 방법:
--   Supabase Dashboard → SQL Editor → 이 파일 내용을 붙여넣고 실행
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_test IS '테스트 계정 여부 (true = 통계 집계 제외)';
