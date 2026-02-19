"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deletePostStorageFiles } from "@/lib/storage-cleanup";
import PostModal, { type PostForEdit } from "@/components/PostModal";

type Post = {
  id: string;
  title: string;
  category: string;
  created_at: string;
};

export default function AdminPostsManagePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostForEdit | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  async function checkAdminAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/admin/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "admin" || profile?.status !== "active") {
        router.push("/");
        return;
      }
      await loadPosts();
    } catch (error) {
      console.error("Access check error:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, category, created_at")
        .eq("category", "소식")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data ?? []);
    } catch (error) {
      console.error("Load posts error:", error);
      setPosts([]);
    }
  }

  async function openEditModal(post: Post) {
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, content, thumbnail_url, external_url")
      .eq("id", post.id)
      .eq("category", "소식")
      .single();

    if (error || !data) {
      alert("게시글을 불러올 수 없습니다.");
      return;
    }

    setEditingPost({
      id: data.id,
      title: data.title,
      content: data.content,
      thumbnail_url: data.thumbnail_url,
      external_url: data.external_url,
    });
    setIsModalOpen(true);
  }

  function openCreateModal() {
    setEditingPost(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingPost(null);
  }

  async function handleDelete(post: Post) {
    if (!confirm(`"${post.title}" 게시글을 삭제하시겠습니까?\n\n⚠️ 삭제된 데이터는 복구할 수 없습니다.`)) {
      return;
    }
    try {
      const { data: fullPost } = await supabase
        .from("posts")
        .select("content, thumbnail_url")
        .eq("id", post.id)
        .eq("category", "소식")
        .single();

      if (fullPost) {
        await deletePostStorageFiles(supabase, fullPost.thumbnail_url, fullPost.content);
      }

      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("category", "소식");

      if (error) throw error;
      await loadPosts();
      alert("✅ 게시글이 삭제되었습니다.");
    } catch (error) {
      console.error("Delete error:", error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">소식 관리</h1>
          <p className="text-sm text-gray-600 mt-1">
            국악원 소식(블로그) 게시글을 관리합니다.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap"
        >
          + 새 글 작성
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
          <p className="text-gray-500 mb-2">등록된 소식이 없습니다.</p>
          <button
            onClick={openCreateModal}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            새 글 작성하기
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">제목</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">카테고리</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">작성일</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">삭제</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/blog/${post.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium truncate max-w-[200px] block"
                      >
                        {post.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{post.category}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(post.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(post)}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-xs font-medium"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(post)}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <PostModal
          editingPost={editingPost}
          onClose={closeModal}
          onSaved={loadPosts}
        />
      )}
    </div>
  );
}
