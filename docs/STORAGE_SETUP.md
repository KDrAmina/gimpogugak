# Supabase Storage 설정 (썸네일 및 본문 이미지 업로드)

게시글 작성 시 썸네일과 본문 이미지를 업로드하려면 Supabase Storage 버킷을 생성해야 합니다.

## 0. RLS 및 Storage 정책 (SQL로 한 번에 적용)

`migrations/fix-posts-rls-and-storage.sql` 파일을 Supabase SQL Editor에서 실행하면:
- posts 테이블 INSERT 권한 수정 (admin만)
- public-media 버킷 SELECT(공개)/INSERT(인증) 정책 생성

버킷은 먼저 Dashboard에서 생성한 뒤 SQL을 실행하세요.

## 1. 버킷 생성

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. **Storage** 메뉴 클릭
4. **New bucket** 클릭
5. 설정:
   - **Name:** `public-media`
   - **Public bucket:** ✅ 체크 (공개 URL로 이미지 접근)
6. **Create bucket** 클릭

## 2. 업로드 정책 설정

1. `public-media` 버킷 클릭
2. **Policies** 탭
3. **New Policy** → **For full customization**
4. 정책 추가:

**업로드 허용 (인증된 사용자 중 관리자)**
- Policy name: `Admins can upload`
- Allowed operation: `INSERT`
- Target: `Authenticated users only`
- WITH CHECK expression: `true` (또는 RLS로 admin만 허용하려면 `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'`)

간단히 하려면 `INSERT`에 `true`를 사용해 모든 로그인 사용자가 업로드 가능하게 할 수 있습니다. (관리자 페이지만 접근 가능하므로)

## 3. 확인

버킷 생성 후 소식 관리(`/admin/posts/manage`)에서 새 글 작성 시 썸네일 업로드가 동작하는지 확인하세요.
