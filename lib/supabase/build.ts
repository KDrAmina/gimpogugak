/**
 * 빌드 타임/SSG용 Supabase 클라이언트.
 * generateStaticParams 등 요청 컨텍스트(cookies)가 없는 환경에서 사용.
 * @supabase/ssr의 createServerClient는 cookies()를 호출하므로 빌드 시 에러 발생.
 */
import { createClient } from "@supabase/supabase-js";

export function createClientForBuild() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
