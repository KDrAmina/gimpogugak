import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ShareButton from "@/components/ShareButton";
import { stripHtml } from "@/lib/html-utils";
import "react-quill-new/dist/quill.snow.css";

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
    <article className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#111] mb-2">
          {post.title}
        </h1>
        <p className="text-sm text-gray-500">{formatDate(post.created_at)}</p>
      </header>

      <div className="ql-snow blog-content-viewer">
        <div
          className="ql-editor"
          dangerouslySetInnerHTML={{ __html: post.content }}
          style={{ padding: 0 }}
        />
      </div>

      <footer className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium"
        >
          ← 목록으로 돌아가기
        </Link>
        <ShareButton />
      </footer>
    </article>
  );
}
