import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `공지: ${slug}`,
    description: "공지 상세 (generateMetadata·DB 연동 예정)",
  };
}

export default async function NoticeDetailPage({ params }: Props) {
  const { slug } = await params;
  // TODO: Supabase에서 slug로 공지 조회, 없으면 notFound()
  if (!slug) notFound();

  return (
    <div className="py-12 sm:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-3xl text-ink font-semibold">공지 상세</h1>
        <p className="mt-4 text-ink-light">slug: {slug} (DB 연동 예정)</p>
      </div>
    </div>
  );
}
