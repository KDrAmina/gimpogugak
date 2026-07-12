import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getBlogPostPath } from "@/lib/blog-utils";
import { notifyIndexNow } from "@/lib/indexnow";

/**
 * Vercel Cron: 하루 1회 00:00 UTC 실행 (vercel.json schedule: "0 0 * * *" — Hobby 플랜 제약)
 *
 * 예약 발행 글의 즉시 노출은 블로그 목록/상세 페이지의 ISR(revalidate=60)이 담당한다.
 * 이 크론은 백스톱 역할:
 *   1. 지난 하루 동안 발행된 예약글 페이지를 선제 재생성 (첫 방문자도 stale 404를 안 보게)
 *   2. 예약글은 저장 시점에 IndexNow 색인 요청이 생략되므로, 발행 후 여기서 색인 요청
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
  // 직전 25시간 범위로 published_at이 설정된 글을 조회
  // (하루 1회 크론 + 1시간 여유 — Vercel 실행 지연 대비)
  const windowStart = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

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
    await notifyIndexNow(postPath);
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
