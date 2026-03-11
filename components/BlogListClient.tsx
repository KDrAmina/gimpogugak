"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useInView } from "react-intersection-observer";
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

export default function BlogListClient({ posts }: { posts: BlogPost[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("전체");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Load read IDs from localStorage on mount
  useEffect(() => {
    setReadIds(getReadPostIds());
  }, []);

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px",
  });

  const tabFiltered = useMemo(() => {
    const filtered = posts.filter((post) => {
      if (post.is_notice) return true; // 공지는 모든 탭에서 항상 표시
      if (activeTab === "전체") return true;
      if (activeTab === "음악교실") return post.category === "음악교실";
      return post.category === "국악원소식" || post.category === "소식";
    });
    // 공지를 최상단으로 (DB 정렬 보조)
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

  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;

  // Load more when sentinel is in view
  useEffect(() => {
    if (inView && hasMore) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
    }
  }, [inView, hasMore]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setVisibleCount(PAGE_SIZE);
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
            // 공지는 번호 대신 배지 표시; 일반 글은 공지 수를 제외한 번호
            const noticeCount = visiblePosts.filter((p) => p.is_notice).length;
            const num = isNotice
              ? null
              : filteredPosts.filter((p) => !p.is_notice).length -
                (idx - noticeCount);
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

      {/* Infinite Scroll Sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg
              className="animate-spin h-4 w-4 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            불러오는 중...
          </div>
        </div>
      )}

      {/* End of list indicator */}
      {!hasMore && filteredPosts.length > PAGE_SIZE && (
        <p className="text-center text-sm text-gray-400 py-6">
          모든 글을 불러왔습니다.
        </p>
      )}
    </>
  );
}
