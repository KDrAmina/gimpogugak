import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `갤러리: ${id}`,
    description: "갤러리 상세 (모달/상세 페이지, DB 연동 예정)",
  };
}

export default async function GalleryDetailPage({ params }: Props) {
  const { id } = await params;
  if (!id) notFound();

  return (
    <div className="py-12 sm:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-3xl text-ink font-semibold">갤러리 상세</h1>
        <p className="mt-4 text-ink-light">id: {id} (DB·이미지 연동 예정)</p>
      </div>
    </div>
  );
}
