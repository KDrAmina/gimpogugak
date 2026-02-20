import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { stripHtml, sanitizeHtml } from "@/lib/html-utils";
import "react-quill-new/dist/quill.snow.css";

import ShareButtonLazy from "@/components/ShareButtonLazy";

type Props = { params: Promise<{ id: string }> };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gimpo-gugak.kr";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("title, content, thumbnail_url")
    .eq("id", id)
    .eq("category", "소식")
    .single();

  if (!data) {
    return { title: "국악원 소식 | 김포국악원" };
  }

  const description = stripHtml(data.content).slice(0, 150);
  const title = `${data.title} | 김포국악원 소식`;
  const url = `${siteUrl}/blog/${id}`;
  const image = data.thumbnail_url || `${siteUrl}/logo.png`;

  return {
    title,
    description: description || "김포국악원의 소식과 블로그를 확인하세요.",
    openGraph: {
      title,
      description: description || "김포국악원의 소식과 블로그를 확인하세요.",
      url,
      siteName: "김포국악원",
      locale: "ko_KR",
      type: "article",
      images: [{ url: image, width: 800, height: 400, alt: data.title }],
    },
  };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
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
            sizes="(max-width: 768px) 100vw, 672px"
          />
          <div className="absolute top-4 left-0 w-full flex justify-center z-10 px-4">
            <span className="bg-black/70 backdrop-blur-sm text-white text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              👆 사진을 누르면 <span className="text-[#03C75A] font-bold">네이버 지도</span>로 연결됩니다
            </span>
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        </a>

        <div className="flex gap-3 mt-4">
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

export default async function BlogDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("posts")
    .select("id, title, content, created_at")
    .eq("id", id)
    .eq("category", "소식")
    .single();

  if (error || !post) {
    notFound();
  }

  return (
    <article className="blog-detail-article mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#111] mb-2">
          {post.title}
        </h1>
        <p className="text-sm text-gray-500">{formatDate(post.created_at)}</p>
      </header>

      <div className="ql-snow">
        <div
          className="ql-editor"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
          style={{ padding: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        />
      </div>

      {/* Wrap in Suspense so the heavy map section doesn't block FCP/LCP.
          The map image itself also carries loading="lazy" for belt-and-suspenders. */}
      <Suspense fallback={null}>
        <BlogContactSection />
      </Suspense>

      <footer className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium"
        >
          ← 목록으로 돌아가기
        </Link>
        <ShareButtonLazy />
      </footer>
    </article>
  );
}
