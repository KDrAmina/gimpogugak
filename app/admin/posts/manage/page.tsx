"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deletePostStorageFiles } from "@/lib/storage-cleanup";
import PostModal, { type PostForEdit } from "@/components/PostModal";
import { formatDateKST, formatDateTimeKST } from "@/lib/date-utils";
import { getBlogPostPath } from "@/lib/blog-utils";

type Post = {
  id: string;
  slug: string | null;
  title: string;
  content: string;
  category: string;
  created_at: string;
  published_at: string | null;
};

const ITEMS_PER_PAGE_OPTIONS = [10, 15, 30, 50, 100] as const;

export default function AdminPostsManagePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostForEdit | null>(null);

  // Search & pagination state
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  // Reset to page 1 whenever search term or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

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
        .select("id, slug, title, content, category, created_at, published_at")
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
      .select("id, title, content, thumbnail_url, external_url, meta_title, meta_description, meta_keywords, slug, published_at")
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
      meta_title: data.meta_title,
      meta_description: data.meta_description,
      meta_keywords: data.meta_keywords,
      slug: data.slug ?? null,
      published_at: data.published_at ?? null,
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

  // Derived: filtered posts by search term (title or content)
  const filteredPosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        p.content.toLowerCase().includes(term)
    );
  }, [posts, searchTerm]);

  // Derived: pagination
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPosts = filteredPosts.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  // Build visible page numbers (max 5 around current, always include 1 and last)
  function getPageNumbers(total: number, current: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "…")[] = [];
    const delta = 2;
    const left = Math.max(2, current - delta);
    const right = Math.min(total - 1, current + delta);

    pages.push(1);
    if (left > 2) pages.push("…");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < total - 1) pages.push("…");
    pages.push(total);
    return pages;
  }

  const pageNumbers = getPageNumbers(totalPages, safePage);

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

      {/* Search & items-per-page controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="제목 또는 내용으로 검색..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="itemsPerPage" className="text-sm text-gray-600 whitespace-nowrap">
            페이지당
          </label>
          <select
            id="itemsPerPage"
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ITEMS_PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}개</option>
            ))}
          </select>
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
          {posts.length === 0 ? (
            <>
              <p className="text-gray-500 mb-2">등록된 소식이 없습니다.</p>
              <button
                onClick={openCreateModal}
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                새 글 작성하기
              </button>
            </>
          ) : (
            <p className="text-gray-500">검색 결과가 없습니다.</p>
          )}
        </div>
      ) : (
        <>
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
                  {paginatedPosts.map((post) => {
                    const isScheduled = post.published_at && new Date(post.published_at) > new Date();
                    return (
                      <tr
                        key={post.id}
                        className={`border-b border-gray-100 hover:bg-gray-50/50 ${isScheduled ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/blog/${getBlogPostPath(post.slug ?? null, post.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-medium truncate max-w-[200px] block"
                            >
                              {post.title}
                            </Link>
                            {isScheduled && post.published_at && (
                              <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                                예약됨 ({formatDateTimeKST(post.published_at)})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{post.category}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDateKST(post.created_at, "long")}</td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-gray-500">
                총 {filteredPosts.length}개 중 {(safePage - 1) * itemsPerPage + 1}–
                {Math.min(safePage * itemsPerPage, filteredPosts.length)}개 표시
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  이전
                </button>
                {pageNumbers.map((page, idx) =>
                  page === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 select-none">
                      …
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded border transition-colors ${
                        page === safePage
                          ? "bg-blue-600 border-blue-600 text-white font-semibold"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </>
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
