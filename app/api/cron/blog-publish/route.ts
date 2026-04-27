import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getBlogPostPath } from "@/lib/blog-utils";

/**
 * Vercel Cron: 10분마다 실행 (vercel.json schedule: "* /10 * * * *")
 *
 * 예약 발행 블로그 글의 ISR 캐시 자동 재검증.
 *
 * 문제 상황:
 *   예약 발행 글을 저장할 때 revalidatePath를 호출하면, published_at 조건 미충족으로
 *   404가 렌더·캐시된다. revalidate=false 환경에서는 이 404가 영구 지속된다.
 *
 * 해결 방식:
 *   이 크론이 10분마다 실행되어, 방금 published_at에 도달한 글들을 감지하고
 *   revalidatePath로 ISR 캐시를 무효화한다. 다음 방문 시 정상 렌더된다.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  if (process.env.VERCEL && !verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase 환경변수 누락" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date().toISOString();
  // 직전 11분 범위로 published_at이 설정된 글을 조회
  // (10분 주기 크론 + 1분 여유 — Vercel 실행 지연 대비)
  const windowStart = new Date(Date.now() - 11 * 60 * 1000).toISOString();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, slug")
    .in("category", ["소식", "음악교실", "국악원소식"])
    .gte("published_at", windowStart)
    .lte("published_at", now);

  if (error) {
    console.error("[CRON BLOG-PUBLISH] DB 조회 실패:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    console.log("[CRON BLOG-PUBLISH] 새로 발행된 글 없음");
    return NextResponse.json({ message: "새로 발행된 글 없음", revalidated: 0 });
  }

  revalidatePath("/blog");

  const revalidatedPaths: string[] = [];
  for (const post of posts) {
    const postPath = getBlogPostPath(post.slug ?? null, String(post.id));
    revalidatePath(`/blog/${postPath}`);
    revalidatedPaths.push(postPath);
    console.log(`[CRON BLOG-PUBLISH] 재검증: /blog/${postPath}`);
  }

  console.log(`[CRON BLOG-PUBLISH] 완료 — ${posts.length}개 재검증`);
  return NextResponse.json({
    message: `${posts.length}개 게시글 재검증 완료`,
    revalidated: posts.length,
    paths: revalidatedPaths,
  });
}
