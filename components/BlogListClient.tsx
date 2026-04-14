"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatDateKST } from "@/lib/date-utils";
import { getBlogPostPath } from "@/lib/blog-utils";

export type BlogPost = {
  id: string;
  slug: string | null;
  title: string;
  external_url: string | null;
  created_at: string;
  published_at: string | null;
  category: string;
  is_notice?: boolean | null;
};

const TABS = [
  { key: "전체" as const, label: "전체보기" },
  { key: "음악교실" as const, label: "음악교실" },
  { key: "국악원소식" as const, label: "국악원소식" },
];

type TabKey = (typeof TABS)[number]["key"];

const PAGE_SIZE = 10;
const LS_KEY = "blog_read_post_ids";

function getReadPostIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markPostAsRead(postId: string) {
  if (typeof window === "undefined") return;
  try {
    const ids = getReadPostIds();
    ids.add(postId);
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage full or unavailable
  }
}

// ── 페이지네이션 UI ────────────────────────────────────────────────────────
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  // 최대 5개 슬라이딩 윈도우
  let startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  const btnBase =
    "min-w-[36px] h-9 px-2.5 text-sm rounded-md border transition-colors";
  const btnNormal =
    "border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed";
  const btnActive = "border-blue-600 bg-blue-600 text-white font-medium";

  return (
    <div className="flex items-center justify-center gap-1 mt-8 mb-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btnBase} ${btnNormal}`}
        aria-label="이전 페이지"
      >
        ‹
      </button>

      {startPage > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className={`${btnBase} ${btnNormal}`}>
            1
          </button>
          {startPage > 2 && (
            <span className="px-1 text-gray-400 text-sm select-none">…</span>
          )}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`${btnBase} ${p === currentPage ? btnActive : btnNormal}`}
          aria-current={p === currentPage ? "page" : undefined}
        >
          {p}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && (
            <span className="px-1 text-gray-400 text-sm select-none">…</span>
          )}
          <button
            onClick={() => onPageChange(totalPages)}
            className={`${btnBase} ${btnNormal}`}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btnBase} ${btnNormal}`}
        aria-label="다음 페이지"
      >
        ›
      </button>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export default function BlogListClient({ posts }: { posts: BlogPost[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("전체");
  const [query, setQuery] = useState("");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const searchParams = useSearchParams();
  const router = useRouter();

  // URL ?page=N에서 현재 페이지 읽기 (기본값 1)
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  useEffect(() => {
    setReadIds(getReadPostIds());
  }, []);

  // ── 필터링 ────────────────────────────────────────────────────────────────
  const tabFiltered = useMemo(() => {
    const filtered = posts.filter((post) => {
      if (post.is_notice) return true; // 공지는 모든 탭에서 항상 표시
      if (activeTab === "전체") return true;
      if (activeTab === "음악교실") return post.category === "음악교실";
      return post.category === "국악원소식" || post.category === "소식";
    });
    return filtered.sort((a, b) => {
      if (a.is_notice && !b.is_notice) return -1;
      if (!a.is_notice && b.is_notice) return 1;
      return 0;
    });
  }, [posts, activeTab]);

  const filteredPosts = useMemo(() => {
    if (!query.trim()) return tabFiltered;
    const q = query.trim().toLowerCase();
    return tabFiltered.filter((post) => post.title.toLowerCase().includes(q));
  }, [tabFiltered, query]);

  // ── 페이지네이션 계산 ──────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const visiblePosts = filteredPosts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // 전체 필터 결과 기준으로 공지 수 캐싱
  const globalNoticeCount = useMemo(
    () => filteredPosts.filter((p) => p.is_notice).length,
    [filteredPosts]
  );
  const totalNonNotice = filteredPosts.length - globalNoticeCount;

  // ── 핸들러 ────────────────────────────────────────────────────────────────
  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    // push → 뒤로가기 시 이전 페이지로 돌아올 수 있음
    router.push(`?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    router.replace(`?${params.toString()}`);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    router.replace(`?${params.toString()}`);
  };

  const handlePostClick = useCallback((postId: string) => {
    markPostAsRead(postId);
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
  }, []);

  return (
    <>
      {/* Category Tabs */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="제목으로 검색..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        />
      </div>

      {/* Header Row */}
      {filteredPosts.length > 0 && (
        <div className="flex items-center gap-2 py-2 border-b-2 border-gray-200 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <span className="w-10 shrink-0 text-center">No.</span>
          <span className="flex-1 min-w-0">제목</span>
          <span className="whitespace-nowrap shrink-0 pr-0.5">날짜</span>
        </div>
      )}

      {filteredPosts.length === 0 ? (
        <div className="py-12 text-center text-[#666] border border-dashed border-gray-300 rounded-xl">
          {query.trim() ? "검색 결과가 없습니다." : "아직 등록된 소식이 없습니다."}
        </div>
      ) : (
        <ul>
          {visiblePosts.map((post, idx) => {
            const isNotice = !!post.is_notice;
            // 전체 필터 기준 절대 인덱스로 번호 계산 (페이지 이동해도 연속 번호 유지)
            const absoluteIdx = (safePage - 1) * PAGE_SIZE + idx;
            const num = isNotice
              ? null
              : totalNonNotice - (absoluteIdx - globalNoticeCount);
            const href =
              post.external_url ||
              `/blog/${getBlogPostPath(post.slug ?? null, post.id)}`;
            const date = formatDateKST(
              post.published_at || post.created_at,
              "short"
            );
            const isExternal = !!post.external_url;
            const isRead = readIds.has(post.id);

            const content = (
              <>
                <span className="w-10 shrink-0 text-center text-sm tabular-nums">
                  {isNotice ? (
                    <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded leading-none">
                      공지
                    </span>
                  ) : (
                    <span className="text-gray-400">{num}</span>
                  )}
                </span>
                {!isRead && !isNotice && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                )}
                <span
                  className={`truncate min-w-0 flex-1 group-hover:text-blue-600 group-hover:underline ${
                    isNotice
                      ? "text-[#111] font-bold"
                      : isRead
                      ? "text-gray-500"
                      : "text-[#111] font-medium"
                  }`}
                >
                  {post.title}
                </span>
                <span
                  className="hidden sm:block flex-shrink min-w-[20px] border-b border-dotted border-gray-300 self-end mb-1 mx-3"
                  aria-hidden
                />
                <span className="text-sm text-gray-500 whitespace-nowrap shrink-0">
                  {date}
                </span>
              </>
            );

            const itemClassName = `flex items-baseline gap-2 py-2.5 group w-full text-left border-b border-gray-100 ${
              isNotice
                ? "bg-amber-50/60 border-l-4 border-l-amber-400 pl-2"
                : !isRead
                ? "bg-blue-50/40"
                : ""
            }`;

            return (
              <li key={post.id}>
                {isExternal ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={itemClassName}
                    onClick={() => handlePostClick(post.id)}
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    href={href}
                    className={itemClassName}
                    onClick={() => handlePostClick(post.id)}
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={goToPage}
      />

      {/* 게시물 수 안내 */}
      {filteredPosts.length > 0 && (
        <p className="text-center text-xs text-gray-400 mt-3">
          전체 {filteredPosts.length}개 · {safePage} / {totalPages} 페이지
        </p>
      )}
    </>
  );
}
