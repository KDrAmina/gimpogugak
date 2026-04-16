-- ============================================================
-- cron_logs 테이블
-- 목적: 알림톡 자동 발송 크론(/api/cron/alimtalk) 실행 결과를
--       Supabase DB에 영구 보관합니다.
--       Vercel 함수 로그는 30분 후 삭제되므로 장기 추적용으로 사용합니다.
--
-- 실행 방법:
--   Supabase Dashboard → SQL Editor → 이 파일 내용을 붙여넣고 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cron_logs (
  id            BIGSERIAL    PRIMARY KEY,

  -- 크론 실행 시작 시각 (UTC ISO 8601)
  run_at        TIMESTAMPTZ  NOT NULL,

  -- KST 기준 실행 날짜 (예: "2026-04-16")
  today_str     TEXT         NOT NULL,

  -- 발송 시도 건수 (0원·납부완료 스킵 제외한 실제 발송 대상 수)
  total_tried   INT          NOT NULL DEFAULT 0,

  -- 솔라피 API 호출 성공 건수
  success_count INT          NOT NULL DEFAULT 0,

  -- 솔라피 API 호출 실패 건수 (invalid_phone 포함)
  fail_count    INT          NOT NULL DEFAULT 0,

  -- 스킵 건수 (납부완료 + 0원 합산)
  skipped       INT          NOT NULL DEFAULT 0,

  -- 실행 상태
  --   'completed' : 발송 완료 (fail=0)
  --   'error'     : 1건 이상 실패 또는 예외 발생
  --   'no_target' : 오늘 결제일 수강생 없음 (정상 종료)
  --   'weekend'   : 토·일요일 — 금요일 선발송으로 처리됨
  status        TEXT         NOT NULL
                CHECK (status IN ('completed', 'error', 'no_target', 'weekend')),

  -- 에러가 발생한 경우 요약 메시지 (성공 시 NULL)
  error_summary TEXT,

  -- 레코드 생성 시각 (DB 기준, run_at 과 거의 동일)
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 날짜별 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS cron_logs_today_str_idx ON public.cron_logs (today_str);
CREATE INDEX IF NOT EXISTS cron_logs_status_idx    ON public.cron_logs (status);
CREATE INDEX IF NOT EXISTS cron_logs_run_at_idx    ON public.cron_logs (run_at DESC);

-- RLS 설정: 관리자(admin role)만 조회 가능
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 cron_logs 조회 가능"
  ON public.cron_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.status = 'active'
    )
  );

-- 크론 API는 Service Role Key로 실행되므로 INSERT는 RLS 우회 (정책 불필요)
-- Service Role Key → auth.uid() = NULL → 위 SELECT 정책과 충돌 없음

COMMENT ON TABLE  public.cron_logs                IS '알림톡 자동 발송 크론 실행 이력 (Vercel 함수 로그 30분 만료 보완)';
COMMENT ON COLUMN public.cron_logs.run_at         IS '크론 실행 시작 시각 (UTC)';
COMMENT ON COLUMN public.cron_logs.today_str      IS 'KST 기준 실행 날짜 YYYY-MM-DD';
COMMENT ON COLUMN public.cron_logs.total_tried    IS '실제 발송 시도 건수';
COMMENT ON COLUMN public.cron_logs.success_count  IS '솔라피 발송 성공 건수';
COMMENT ON COLUMN public.cron_logs.fail_count     IS '솔라피 발송 실패 건수';
COMMENT ON COLUMN public.cron_logs.skipped        IS '납부완료·0원 등 스킵 건수';
COMMENT ON COLUMN public.cron_logs.status         IS 'completed | error | no_target | weekend';
COMMENT ON COLUMN public.cron_logs.error_summary  IS '오류 요약 (정상 시 NULL)';
