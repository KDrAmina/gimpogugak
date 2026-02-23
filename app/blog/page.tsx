import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateKST } from "@/lib/date-utils";
import { getBlogPostPath } from "@/lib/blog-utils";

export const dynamic = "force-static";
export const revalidate = 60;

export const metadata: Metadata = {
  title: "국악원 소식 | 김포국악원 (Gimpo Gugak Center)",
  description: "김포국악원의 소식을 확인하세요.",
};

function BlogListItem({
  href,
  title,
  date,
  isExternal,
}: {
  href: string;
  title: string;
  date: string;
  isExternal: boolean;
}) {
  const className =
    "flex items-baseline gap-2 py-2 group w-full text-left";
  const content = (
    <>
      <span className="truncate text-[#111] group-hover:text-blue-600 group-hover:underline min-w-0 flex-shrink">
        {title}
      </span>
      <span
        className="flex-1 min-w-[20px] border-b border-dotted border-gray-300 self-end mb-1 mx-4 shrink-0"
        aria-hidden
      />
      <span className="text-sm text-gray-500 whitespace-nowrap shrink-0">{date}</span>
    </>
  );
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export default async function BlogListPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, title, external_url, created_at, published_at")
    .eq("category", "소식")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  const items = posts ?? [];

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#111] mb-2">
        국악원 소식
      </h1>
      <p className="text-[#666] mb-10">
        김포국악원의 소식을 확인하세요.
      </p>

      {items.length === 0 ? (
        <div className="py-12 text-center text-[#666] border border-dashed border-gray-300 rounded-xl">
          아직 등록된 소식이 없습니다.
        </div>
      ) : (
        <ul className="space-y-0">
          {items.map((post) => (
            <li key={post.id}>
              <BlogListItem
                href={post.external_url || `/blog/${getBlogPostPath(post.slug ?? null, post.id)}`}
                title={post.title}
                date={formatDateKST(post.published_at || post.created_at, "short")}
                isExternal={!!post.external_url}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-12 text-sm text-gray-500">
        <Link href="/classes" className="text-blue-600 hover:underline">
          ← 수업으로 들어가기
        </Link>
      </p>
    </section>
  );
}
