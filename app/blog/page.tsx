import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BlogListClient from "@/components/BlogListClient";

export const dynamic = "force-static";
export const revalidate = 60;

export const metadata: Metadata = {
  title: "국악원 소식 블로그 | 김포국악원",
  description: "김포국악원(장기동·사우동·고촌읍)의 공연·행사·수업 소식과 민요·성악 이야기. 최신 국악 교육 정보를 확인하세요.",
};

export default async function BlogListPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, title, external_url, created_at, published_at, category, is_notice")
    .in("category", ["소식", "음악교실", "국악원소식"])
    .lte("published_at", new Date().toISOString())
    .order("is_notice", { ascending: false })
    .order("published_at", { ascending: false });

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#111] mb-2">
        국악원 소식
      </h1>
      <p className="text-[#666] mb-10">
        김포국악원의 소식을 확인하세요.
      </p>

      <BlogListClient posts={posts ?? []} />

      <p className="mt-12 text-sm text-gray-500">
        <Link href="/classes" className="text-blue-600 hover:underline">
          ← 수업으로 들어가기
        </Link>
      </p>
    </section>
  );
}
