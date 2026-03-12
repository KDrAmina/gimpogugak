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
  const fallbackDescription = stripHtml(data.content).slice(0, 150);
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

function BlogContactSection() {
  const addressQuery = "경기도 김포시 모담공원로 170-14";
  const encodedAddress = encodeURIComponent(addressQuery);
  const naverMapLink = `https://map.naver.com/v5/search/${encodedAddress}`;
  const googleMapLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  const kakaoMapLink = `https://map.kakao.com/link/search/${encodedAddress}`;

  return (
    <div className="mt-16 pt-12 border-t border-gray-200">
      <div className="mb-4">
        <a
          href={naverMapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block w-full aspect-video sm:h-[320px] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm group"
        >
          <Image
            src="/image_b4e966.jpg"
            alt="김포국악원 약도"
            fill
            loading="lazy"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 896px"
          />
          <div className="absolute top-4 left-0 w-full flex justify-center z-10 px-4">
            <span className="bg-black/70 backdrop-blur-sm text-white text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              👆 사진을 누르면 <span className="text-[#03C75A] font-bold">네이버 지도</span>로 연결됩니다
            </span>
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        </a>

        <div className="flex flex-wrap gap-3 mt-4">
          <a
            href="tel:01059481843"
            className="w-full sm:flex-1 py-3 text-center text-sm font-bold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z" clipRule="evenodd" />
            </svg>
            전화문의
          </a>
          <a
            href={googleMapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 text-center text-sm font-bold text-[#4285F4] bg-white border border-[#4285F4] rounded-lg hover:bg-[#4285F4] hover:text-white transition-colors shadow-sm"
          >
            Google 지도 보기
          </a>
          <a
            href={kakaoMapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 text-center text-sm font-bold text-[#371D1E] bg-[#FAE100] rounded-lg hover:bg-[#ebd300] transition-colors shadow-sm"
          >
            카카오맵으로 보기
          </a>
        </div>
      </div>
    </div>
  );
}

const truncate = (str: string, n: number) => str.length > n ? str.slice(0, n) + "..." : str;

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
