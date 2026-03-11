-- Migration: is_notice 컬럼 추가 (공지 상단 고정 기능)
-- 실행 전 Supabase SQL Editor에서 아래 쿼리를 실행하세요.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_notice BOOLEAN NOT NULL DEFAULT false;

-- 기존 게시글은 모두 is_notice = false 로 초기화됩니다.

-- (선택) 인덱스: 공지 정렬 쿼리 성능 향상
CREATE INDEX IF NOT EXISTS idx_posts_is_notice ON posts (is_notice DESC, published_at DESC);
