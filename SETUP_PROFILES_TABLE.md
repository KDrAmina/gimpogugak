# 📋 Profiles 테이블 설정 (전화번호 저장 문제 해결)

## ⚠️ 문제 상황

회원가입 시 전화번호가 저장되지 않는 경우, `profiles` 테이블에 `phone` 컬럼이 없거나 설정이 잘못된 경우입니다.

---

## 📋 **STEP 1: Profiles 테이블 확인**

Supabase Dashboard → **Table Editor** → `profiles` 테이블 선택

다음 컬럼들이 있는지 확인:
- ✅ `id` (UUID, Primary Key)
- ✅ `email` (TEXT)
- ✅ `name` (TEXT)
- ✅ `phone` (TEXT) ← **이 컬럼이 없으면 STEP 2 실행**
- ✅ `role` (TEXT, default: 'user')
- ✅ `status` (TEXT, default: 'pending')
- ✅ `created_at` (TIMESTAMP)
- ✅ `updated_at` (TIMESTAMP)

---

## 📋 **STEP 2: Phone 컬럼 추가 (필요한 경우에만)**

**Supabase SQL Editor**에서 다음 SQL을 실행:

```sql
-- phone 컬럼 추가
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 인덱스 추가 (빠른 조회)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- 기존 레코드 확인
SELECT id, email, name, phone, role, status 
FROM profiles 
LIMIT 10;
```

---

## 📋 **STEP 3: Profiles 테이블이 없는 경우 (새 프로젝트)**

```sql
-- Profiles 테이블 생성
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- 정책 1: 사용자는 본인 프로필 조회 가능
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 정책 2: 사용자는 본인 프로필 수정 가능
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 정책 3: Admin은 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 정책 4: Admin은 모든 프로필 관리 가능
CREATE POLICY "Admins can manage all profiles"
  ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 📋 **STEP 4: 테스트 쿼리**

```sql
-- 1. 전화번호가 있는 회원 조회
SELECT id, email, name, phone, role, status 
FROM profiles 
WHERE phone IS NOT NULL;

-- 2. 최근 가입한 회원 조회 (전화번호 포함)
SELECT id, email, name, phone, role, status, created_at 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- 3. 특정 사용자의 전화번호 확인
SELECT email, name, phone 
FROM profiles 
WHERE email = 'test@example.com';
```

---

## 📋 **STEP 5: 기존 회원 전화번호 수동 업데이트 (필요한 경우)**

```sql
-- 특정 회원의 전화번호 업데이트
UPDATE profiles 
SET phone = '010-1234-5678' 
WHERE email = 'example@email.com';

-- 여러 회원 일괄 업데이트 (예시)
UPDATE profiles 
SET phone = '010-0000-0000' 
WHERE phone IS NULL AND status = 'active';
```

---

## ✅ **확인 방법**

### 1. Supabase Dashboard:
1. **Table Editor** → `profiles` 선택
2. `phone` 컬럼이 있는지 확인
3. 기존 회원 데이터에 전화번호가 있는지 확인

### 2. 회원가입 테스트:
1. `/login` 페이지 → "수강 신청" 탭
2. 정보 입력 (이름, 전화번호, 이메일, 비밀번호)
3. 제출 후 Supabase Dashboard → `profiles` 테이블에서 전화번호 확인

### 3. 브라우저 콘솔 확인:
1. F12 → Console 탭
2. 회원가입 진행
3. 다음 로그 확인:
   ```
   🔄 Creating profile for user: {userId: "...", email: "...", name: "...", phone: "010-1234-5678"}
   ✅ Profile created successfully: [{...}]
   ```

---

## 🎯 **문제 해결**

### Phone 컬럼이 보이지 않는 경우:
→ **STEP 2**의 SQL을 실행하세요.

### "Profile creation error" 발생:
→ 콘솔에서 에러 메시지 확인 후:
- `duplicate key` → 이미 프로필이 존재 (정상)
- `column "phone" does not exist` → **STEP 2** 실행
- `permission denied` → RLS 정책 확인 (**STEP 3** 재실행)

### 전화번호가 NULL로 저장되는 경우:
1. 브라우저 콘솔에서 `phone` 값 확인
2. 코드에서 `phone.trim()` 적용 확인
3. Supabase Dashboard에서 직접 수동 업데이트 테스트

---

## 📞 추가 도움

- **Supabase Dashboard**: https://app.supabase.com
- **SQL Editor**: 왼쪽 메뉴 → SQL Editor
- **Table Editor**: 왼쪽 메뉴 → Table Editor → profiles

SQL 실행 후 회원가입을 다시 시도하면 전화번호가 정상적으로 저장됩니다! 🚀
