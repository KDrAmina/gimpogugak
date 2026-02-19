import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { stripHtml } from "@/lib/html-utils";

export const revalidate = 60; // Cache for 60 seconds (ISR)

export const metadata: Metadata = {
  title: "국악원 소식 | 김포국악원 (Gimpo Gugak Center)",
  description: "김포국악원의 소식과 블로그를 확인하세요.",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export default async function BlogListPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, content, thumbnail_url, external_url, category, created_at")
    .eq("category", "소식")
    .order("created_at", { ascending: false });

  const items = posts ?? [];

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#111] mb-2">
        국악원 소식
      </h1>
      <p className="text-[#666] mb-10">
        김포국악원의 소식과 블로그를 확인하세요.
      </p>

      {items.length === 0 ? (
        <div className="py-12 text-center text-[#666] border border-dashed border-gray-300 rounded-xl">
          아직 등록된 소식이 없습니다.
        </div>
      ) : (
        <div className="grid gap-6">
          {items.map((post) => {
            const href = post.external_url || `/blog/${post.id}`;
            const isExternal = !!post.external_url;
            const CardWrapper = isExternal ? "a" : Link;
            const cardProps = isExternal
              ? { href, target: "_blank", rel: "noopener noreferrer" }
              : { href };

            return (
              <CardWrapper
                key={post.id}
                {...cardProps}
                className="block rounded-xl border border-[#111111]/10 bg-white overflow-hidden hover:border-[#111111]/20 hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row">
                  {post.thumbnail_url && (
                    <div className="sm:w-40 sm:shrink-0 h-32 sm:h-auto sm:min-h-[120px] relative bg-gray-100">
                      <Image
                        src={post.thumbnail_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 160px"
                      />
                    </div>
                  )}
                  <div className="flex-1 p-4 sm:p-5 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">
                        {formatDate(post.created_at)}
                      </span>
                    </div>
                    <h2 className="font-semibold text-[#111] line-clamp-2 group-hover:text-blue-600">
                      {post.title}
                    </h2>
                    {post.content && (
                      <p className="text-sm text-gray-600 mt-1">
                        {stripHtml(post.content).slice(0, 15)}
                        {stripHtml(post.content).length > 15 ? "…" : ""}
                      </p>
                    )}
                  </div>
                </div>
              </CardWrapper>
            );
          })}
        </div>
      )}

      <p className="mt-12 text-sm text-gray-500">
        <Link href="/intro" className="text-blue-600 hover:underline">
          ← 소개로 돌아가기
        </Link>
      </p>
    </section>
  );
}
