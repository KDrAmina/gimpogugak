# 📝 공지사항 시스템 설정 가이드

## ⚠️ "author_id column not found" 에러 해결

공지사항을 저장할 때 오류가 발생한다면, Supabase에서 다음 SQL을 실행하세요.

---

## 📋 **STEP 1: posts 테이블 생성**

```sql
-- Posts (공지사항) 테이블 생성
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT '일반',
  is_pinned BOOLEAN DEFAULT false,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 📋 **STEP 2: 인덱스 생성 (성능 최적화)**

```sql
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_is_pinned ON posts(is_pinned);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
```

---

## 📋 **STEP 3: RLS (Row Level Security) 정책 설정**

```sql
-- RLS 활성화
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Admins can manage posts" ON posts;
DROP POLICY IF EXISTS "Active users can view posts" ON posts;

-- 정책 1: Admin은 모든 공지 관리 가능
CREATE POLICY "Admins can manage posts"
  ON posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 정책 2: 활성 회원은 공지 조회 가능
CREATE POLICY "Active users can view posts"
  ON posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.status = 'active'
    )
  );
```

---

## 📋 **STEP 4: 자동 updated_at 트리거**

```sql
-- 트리거 함수 생성 (없다면)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- posts 테이블에 트리거 연결
CREATE TRIGGER update_posts_updated_at 
BEFORE UPDATE ON posts
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
```

---

## 📋 **STEP 5: 테스트 데이터 삽입 (선택사항)**

```sql
-- 테스트 공지 추가
INSERT INTO posts (title, content, category, is_pinned)
VALUES 
  ('김포국악원 공지사항 시스템 오픈', '안녕하세요! 김포국악원 공지사항 시스템이 오픈되었습니다. 앞으로 이곳에서 수업 일정, 행사 안내 등을 확인하실 수 있습니다.', '일반', true),
  ('2월 정기 공연 안내', '2월 정기 공연이 김포아트홀에서 개최됩니다. 많은 관심 부탁드립니다.', '공연', false),
  ('2월 수업 일정 안내', '2월 수업 일정을 안내드립니다. 설 연휴 기간 휴강 일정을 확인해 주세요.', '수업', false);

-- 확인: 공지 목록 조회
SELECT 
  id,
  title,
  category,
  is_pinned,
  created_at
FROM posts
ORDER BY is_pinned DESC, created_at DESC;
```

---

## ✅ **확인 방법**

### 1. Supabase Dashboard에서:
1. **Table Editor** → `posts` 테이블이 보이는지 확인
2. 테이블 클릭 → 컬럼 확인:
   - ✅ `id` (UUID)
   - ✅ `title` (TEXT)
   - ✅ `content` (TEXT)
   - ✅ `category` (TEXT)
   - ✅ `is_pinned` (BOOLEAN)
   - ✅ `author_id` (UUID, nullable)
   - ✅ `created_at` (TIMESTAMP)
   - ✅ `updated_at` (TIMESTAMP)

### 2. 브라우저 콘솔에서 (F12):
```
관리자 페이지 (/admin/posts):
🔄 Loading posts...
✅ Loaded 3 posts

학생 페이지 (/notices):
🔄 Loading posts...
✅ Loaded 3 posts
```

### 3. 공지 작성 테스트:
1. `/admin/posts` 접속
2. "+ 새 공지 작성" 클릭
3. 제목, 카테고리, 내용 입력
4. "등록하기" 클릭
5. 콘솔 확인:
   ```
   📝 Creating post: {title: "...", content: "...", category: "일반"}
   ✅ Post created successfully: [{...}]
   ```

---

## 🎯 **문제 해결**

### "relation does not exist" 에러:
→ posts 테이블이 없습니다. **STEP 1**의 SQL을 실행하세요.

### "column author_id does not exist" 에러:
→ 코드가 자동으로 폴백 모드로 재시도합니다. 또는:
```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
```

### "permission denied" 에러:
→ RLS 정책이 없습니다. **STEP 3**의 SQL을 실행하세요.

### 공지가 저장은 되는데 목록에 안 보이는 경우:
→ RLS 정책 문제입니다. **STEP 3**을 다시 실행하세요.

---

## 📞 추가 도움

1. **Supabase Dashboard**: https://app.supabase.com
2. **SQL Editor**: 왼쪽 메뉴 → SQL Editor
3. **Table Editor**: 왼쪽 메뉴 → Table Editor → posts

SQL 실행 후 **페이지를 새로고침**하면 공지사항 시스템이 작동합니다! 🚀