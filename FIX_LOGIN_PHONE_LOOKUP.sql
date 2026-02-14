-- ============================================================
-- 로그인 시 전화번호로 프로필 조회 (RLS 우회)
-- ============================================================
-- 문제: 익명 사용자(로그인 전)는 profiles 테이블 SELECT 권한이 없음
-- 해결: SECURITY DEFINER 함수로 전화번호 기반 조회 허용
--
-- Supabase SQL Editor에서 이 스크립트를 실행하세요.
-- ============================================================

-- 기존 함수가 있으면 삭제
DROP FUNCTION IF EXISTS get_profile_by_phone(TEXT);

-- 전화번호로 프로필 조회 함수 (id, email, status, role만 반환)
CREATE OR REPLACE FUNCTION get_profile_by_phone(phone_input TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  status TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 전화번호 정규화: 숫자만 추출 후 010-XXXX-XXXX 형식으로 변환
  phone_input := trim(phone_input);
  IF length(regexp_replace(phone_input, '[^0-9]', '', 'g')) >= 10 THEN
    phone_input := regexp_replace(phone_input, '[^0-9]', '', 'g');
    IF length(phone_input) = 11 AND left(phone_input, 3) = '010' THEN
      phone_input := '010-' || substr(phone_input, 4, 4) || '-' || substr(phone_input, 8, 4);
    ELSIF length(phone_input) = 10 AND left(phone_input, 3) = '010' THEN
      phone_input := '010-' || substr(phone_input, 4, 3) || '-' || substr(phone_input, 7, 4);
    END IF;
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.status, p.role
  FROM profiles p
  WHERE p.phone = phone_input
     OR p.phone = regexp_replace(phone_input, '[^0-9]', '', 'g')
     OR regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g') = regexp_replace(phone_input, '[^0-9]', '', 'g')
  LIMIT 1;
END;
$$;

-- anon, authenticated 역할에 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_profile_by_phone(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_profile_by_phone(TEXT) TO authenticated;

-- 테스트 (선택사항)
-- SELECT * FROM get_profile_by_phone('010-1234-5678');
-- SELECT * FROM get_profile_by_phone('01012345678');

-- ============================================================
-- [대안] RLS 정책으로 익명 조회 허용 (RPC 대신 사용 시)
-- ============================================================
-- RPC 대신 이 정책을 사용하려면, 위의 함수 생성 부분을 건너뛰고
-- 아래 정책만 실행한 뒤, app/login/page.tsx에서
-- .rpc("get_profile_by_phone", ...) 대신
-- .from("profiles").select(...).eq("phone", formattedPhone).single()
-- 로 되돌리세요.
--
-- 주의: 이 정책은 익명 사용자가 모든 프로필을 조회할 수 있게 합니다.
-- DROP POLICY IF EXISTS "Allow login lookup by phone" ON profiles;
-- CREATE POLICY "Allow login lookup by phone"
--   ON profiles FOR SELECT TO anon
--   USING (true);
