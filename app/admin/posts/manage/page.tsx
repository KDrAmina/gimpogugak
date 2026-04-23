"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { deletePostStorageFiles } from "@/lib/storage-cleanup";
import { formatDateKST, formatDateTimeKST } from "@/lib/date-utils";
import { getBlogPostPath } from "@/lib/blog-utils";
import { revalidateBlogList, revalidateBlogPost } from "@/app/actions/revalidate";

type Post = {
  id: string;
  slug: string | null;
  title: string;
  content: string;
  category: string;
  created_at: string;
  published_at: string | null;
  views: number | null;
  is_notice: boolean;
};

const ITEMS_PER_PAGE_OPTIONS = [10, 15, 30, 50, 100] as const;

// ─── 실제 콘텐츠 (useSearchParams 사용 → Suspense 필수) ──────────────────────
function PostsManageInner() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  const router = useRouter();
  const supabase = createClient();

  // ✅ Single Source of Truth: currentPage는 URL의 ?page= 값에서만 읽음
  const searchParams = useSearchParams();
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  // 검색어·페이지당 개수 변경 시 1페이지로 이동 (최초 마운트는 건너뜀)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    router.push("/admin/posts/manage?page=1", { scroll: false });
  }, [searchTerm, itemsPerPage]);

  // ✅ 페이지 이동 = URL 업데이트 → useSearchParams가 반응 → currentPage 자동 갱신
  function goToPage(page: number) {
    router.push(`/admin/posts/manage?page=${page}`, { scroll: false });
  }

  async function checkAdminAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin/login"); return; }
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
        .select("id, slug, title, content, category, created_at, published_at, views, is_notice")
        .in("category", ["소식", "음악교실", "국악원소식"])
        .order("is_notice", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPosts(data ?? []);
    } catch (error) {
      console.error("Load posts error:", error);
      setPosts([]);
    }
  }

  async function handleDelete(post: Post) {
    if (!confirm(`"${post.title}" 게시글을 삭제하시겠습니까?\n\n⚠️ 삭제된 데이터는 복구할 수 없습니다.`)) return;
    try {
      const { data: fullPost } = await supabase
        .from("posts")
        .select("content, thumbnail_url")
        .eq("id", post.id)
        .single();
      if (fullPost) await deletePostStorageFiles(supabase, fullPost.thumbnail_url, fullPost.content);
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
      const deletedPath = getBlogPostPath(post.slug ?? null, post.id);
      await revalidateBlogList();
      await revalidateBlogPost(deletedPath);
      await loadPosts();
      alert("✅ 게시글이 삭제되었습니다.");
    } catch (error) {
      console.error("Delete error:", error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  async function toggleNotice(post: Post) {
    const newValue = !post.is_notice;
    try {
      const { error } = await supabase.from("posts").update({ is_notice: newValue }).eq("id", post.id);
      if (error) throw error;
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, is_notice: newValue } : p)));
      await revalidateBlogList();
    } catch (error) {
      console.error("Toggle notice error:", error);
      alert("공지 설정 중 오류가 발생했습니다.");
    }
  }

  const filteredPosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return posts;
    return posts.filter(
      (p) => p.title.toLowerCase().includes(term) || p.content.toLowerCase().includes(term)
    );
  }, [posts, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedPosts = filteredPosts.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

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
          <p className="text-sm text-gray-600 mt-1">국악원 소식(블로그) 게시글을 관리합니다.</p>
        </div>
        <Link
          href="/admin/posts/manage/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap text-center"
        >
          + 새 글 작성
        </Link>
      </div>

      {/* 검색 & 페이지당 개수 */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="제목 또는 내용으로 검색..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="itemsPerPage" className="text-sm text-gray-600 whitespace-nowrap">페이지당</label>
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
              <Link href="/admin/posts/manage/new" className="text-blue-600 hover:underline text-sm font-medium">
                새 글 작성하기
              </Link>
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
                    <th className="w-12 text-center px-4 py-3 font-semibold text-gray-700">No.</th>
                    <th className="w-10 text-center px-2 py-3 font-semibold text-gray-700" title="공지 설정">공지</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">제목</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">카테고리</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">작성일</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">조회수</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPosts.map((post, index) => {
                    const isScheduled = post.published_at && new Date(post.published_at) > new Date();
                    const rowNumber = (safePage - 1) * itemsPerPage + index + 1;
                    return (
                      <tr
                        key={post.id}
                        className={`border-b border-gray-100 hover:bg-gray-50/50 ${isScheduled ? "opacity-50" : ""} ${post.is_notice ? "bg-amber-50/40" : ""}`}
                      >
                        <td className="w-12 px-4 py-3 text-center text-gray-500">{rowNumber}</td>
                        <td className="w-10 px-2 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={post.is_notice}
                            onChange={() => toggleNotice(post)}
                            className="w-4 h-4 accent-amber-500 cursor-pointer"
                            title={post.is_notice ? "공지 해제" : "공지로 설정"}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {post.is_notice && (
                              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded leading-none">공지</span>
                            )}
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
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            post.category === "음악교실" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                          }`}>
                            {post.category === "음악교실" ? "음악교실" : "국악원소식"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDateKST(post.created_at, "long")}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{post.views ?? 0}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/admin/posts/manage/edit/${post.id}?page=${safePage}`}
                              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-xs font-medium"
                            >
                              수정
                            </Link>
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

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-gray-500">
                총 {filteredPosts.length}개 중 {(safePage - 1) * itemsPerPage + 1}–
                {Math.min(safePage * itemsPerPage, filteredPosts.length)}개 표시
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  이전
                </button>
                {pageNumbers.map((page, idx) =>
                  page === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 select-none">…</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => goToPage(page as number)}
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
                  onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
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
    </div>
  );
}

// ─── 기본 export: Suspense로 감싸야 useSearchParams가 안정적으로 동작 ─────────
export default function AdminPostsManagePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    }>
      <PostsManageInner />
    </Suspense>
  );
}
