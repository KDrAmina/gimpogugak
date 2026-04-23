"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PostEditor, { type PostForEdit } from "@/components/PostEditor";

export default function AdminEditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [post, setPost] = useState<PostForEdit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPost() {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, content, category, thumbnail_url, external_url, meta_title, meta_description, meta_keywords, slug, published_at")
        .eq("id", id)
        .single();

      if (error || !data) {
        alert("게시글을 불러올 수 없습니다.");
        router.push("/admin/posts/manage");
        return;
      }

      setPost({
        id: data.id,
        title: data.title,
        content: data.content,
        category: data.category,
        thumbnail_url: data.thumbnail_url,
        external_url: data.external_url,
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        meta_keywords: data.meta_keywords,
        slug: data.slug ?? null,
        published_at: data.published_at ?? null,
      });
      setLoading(false);
    }
    loadPost();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">게시글 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">게시글 수정</h1>
        <p className="text-sm text-gray-600 mt-1">
          게시글을 수정합니다.
        </p>
      </div>
      <PostEditor editingPost={post} />
    </div>
  );
}
