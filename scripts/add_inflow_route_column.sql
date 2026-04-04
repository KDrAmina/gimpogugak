-- Supabase SQL Editor에서 실행:
-- profiles 테이블에 inflow_route 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS inflow_route text;
