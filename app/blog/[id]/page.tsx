import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClientForBuild } from "@/lib/supabase/build";
import { notFound } from "next/navigation";
import { stripHtml, sanitizeHtml } from "@/lib/html-utils";
import { formatDateKST } from "@/lib/date-utils";
import { getBlogPostPath } from "@/lib/blog-utils";

import ShareButtonLazy from "@/components/ShareButtonLazy";
import BlogContent from "@/components/BlogContent";
import ViewTracker from "@/components/ViewTracker";
import BlogContactSection from "@/components/BlogContactSection";

export const revalidate = 60;
export const dynamicParams = true;

const selectCols = "id, title, content, slug, created_at, published_at, thumbnail_url, meta_title, meta_description, meta_keywords, category";

async function fetchPostBySlugOrId(supabase: ReturnType<typeof createClientForBuild>, param: string) {
  const now = new Date().toISOString();

  const { data: bySlug } = await supabase
    .from("posts")
    .select(selectCols)
    .in("category", ["소식", "음악교실", "국악원소식"])
    .eq("slug", param)
    .lte("published_at", now)
    .single();
  if (bySlug) return bySlug;

  const { data: byId } = await supabase
    .from("posts")
    .select(selectCols)
    .in("category", ["소식", "음악교실", "국악원소식"])
    .eq("id", param)
    .lte("published_at", now)
    .single();
  return byId ?? null;
}

export async function generateStaticParams() {
  try {
    const supabase = createClientForBuild();
    const { data: posts } = await supabase
      .from("posts")
      .select("id, slug")
      .in("category", ["소식", "음악교실", "국악원소식"])
      .lte("published_at", new Date().toISOString());
    return (posts ?? []).map((post) => ({ id: getBlogPostPath(post.slug ?? null, String(post.id)) }));
  } catch {
    return [];
  }
}

type Props = { params: Promise<{ id: string }> };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gimpogugak.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: param } = await params;
  const supabase = createClientForBuild();
  const data = await fetchPostBySlugOrId(supabase, param);

  if (!data) {
    return { title: "국악원 소식 | 김포국악원" };
  }

  const canonicalPath = getBlogPostPath(data.slug ?? null, String(data.id));
  const url = `${siteUrl}/blog/${canonicalPath}`;
  const fallbackDescription = buildExcerpt(stripHtml(data.content));
  const title = data.meta_title?.trim() || `${data.title} | 김포국악원 소식`;
  const description = data.meta_description?.trim() || fallbackDescription || "김포국악원의 소식과 블로그를 확인하세요.";
  const image = data.thumbnail_url || `${siteUrl}/logo.png`;

  return {
    title,
    description,
    keywords: data.meta_keywords?.trim() || undefined,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "김포국악원",
      locale: "ko_KR",
      type: "article",
      images: [{ url: image, width: 800, height: 400, alt: data.title }],
    },
  };
}

const truncate = (str: string, n: number) => str.length > n ? str.slice(0, n) + "..." : str;

/** HTML을 제거한 본문에서 100~140자 요약문을 추출합니다. 단어 경계에서 자르고 말줄임표를 붙입니다. */
function buildExcerpt(plainText: string, maxLen = 140): string {
  const text = plainText.replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  const sliced = text.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced) + "…";
}

export default async function BlogDetailPage({ params }: Props) {
  const { id: param } = await params;
  const supabase = createClientForBuild();
  const post = await fetchPostBySlugOrId(supabase, param);

  if (!post) {
    notFound();
  }

  const postDate = post.published_at || post.created_at;
  const now = new Date().toISOString();

  // Category isolation: "음악교실" navigates within "음악교실" only;
  // "소식"/"국악원소식" (legacy alias) navigate within the same group.
  const navCategories = post.category === "음악교실"
    ? ["음악교실"]
    : ["소식", "국악원소식"];

  const [{ data: prevPosts }, { data: nextPosts }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, slug")
      .in("category", navCategories)
      .lte("published_at", now)
      .lt("published_at", postDate)
      .order("published_at", { ascending: false })
      .limit(1),
    supabase
      .from("posts")
      .select("id, title, slug")
      .in("category", navCategories)
      .lte("published_at", now)
      .gt("published_at", postDate)
      .order("published_at", { ascending: true })
      .limit(1),
  ]);

  const prevPost = prevPosts?.[0] ?? null;
  const nextPost = nextPosts?.[0] ?? null;

  return (
    <article className="blog-detail-article mx-auto max-w-4xl px-6 py-12">
      <ViewTracker postId={String(post.id)} />
      <header className="mb-8">
        <div className="mb-3">
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            post.category === "음악교실"
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700"
          }`}>
            {post.category === "음악교실" ? "음악교실" : "국악원소식"}
          </span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#111] mb-2">
          {post.title}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-gray-500">{formatDateKST(post.published_at || post.created_at, "long")}</p>
          <ShareButtonLazy
            url={`${siteUrl}/blog/${getBlogPostPath(post.slug ?? null, String(post.id))}`}
            title={post.meta_title?.trim() || post.title}
          />
        </div>
      </header>

      <BlogContent html={sanitizeHtml(post.content)} />

      {/* Wrap in Suspense so the heavy map section doesn't block FCP/LCP.
          The map image itself also carries loading="lazy" for belt-and-suspenders. */}
      <Suspense fallback={null}>
        <BlogContactSection />
      </Suspense>

      {/* Prev/Next Navigation */}
      <div className="flex justify-between items-center w-full mt-10 pt-6 border-t border-gray-200">
        <div className="flex-1 text-left">
          {prevPost ? (
            <Link
              href={`/blog/${getBlogPostPath(prevPost.slug ?? null, String(prevPost.id))}`}
              className="text-sm text-gray-600 hover:text-blue-600 hover:underline"
            >
              ← 이전글 {truncate(prevPost.title, 5)}
            </Link>
          ) : (
            <span />
          )}
        </div>
        <div className="flex-shrink-0 px-4">
          <Link
            href="/blog"
            className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
          >
            목록
          </Link>
        </div>
        <div className="flex-1 text-right">
          {nextPost ? (
            <Link
              href={`/blog/${getBlogPostPath(nextPost.slug ?? null, String(nextPost.id))}`}
              className="text-sm text-gray-600 hover:text-blue-600 hover:underline"
            >
              다음글 {truncate(nextPost.title, 5)} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </article>
  );
}
