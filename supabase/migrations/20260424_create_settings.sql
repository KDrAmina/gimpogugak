-- ============================================================
-- settings 테이블
-- 목적: 관리자 설정값(예: 계좌번호)을 key-value 형태로 저장합니다.
--
-- 실행 방법:
--   Supabase Dashboard → SQL Editor → 이 파일 내용을 붙여넣고 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS public.settings (
  key         TEXT         PRIMARY KEY,
  value       TEXT         NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- RLS 설정
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 관리자만 읽기/쓰기 가능
CREATE POLICY "관리자만 settings 관리 가능"
  ON public.settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.status = 'active'
    )
  );

-- 기본 설정값 삽입 (bank_account)
INSERT INTO public.settings (key, value)
VALUES ('bank_account', '')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE  public.settings       IS '관리자 설정값 (key-value)';
COMMENT ON COLUMN public.settings.key   IS '설정 키 (예: bank_account)';
COMMENT ON COLUMN public.settings.value IS '설정 값 (예: 카카오뱅크 3333-01-1234567 홍길동)';
