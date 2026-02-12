"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Post = {
  id: string;
  title: string;
  content: string;
  category: string;
  tag: string;
  is_pinned: boolean;
  created_at: string;
};

export default function NoticesPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .single();

      if (profile?.status !== "active") {
        router.push("/waiting");
        return;
      }

      await loadPosts();
    } catch (error) {
      console.error("Access check error:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts() {
    try {
      console.log("🔄 Loading posts...");

      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Posts load error:", error);
        setPosts([]);
        return;
      }

      console.log("✅ Loaded", data?.length || 0, "posts");
      setPosts(data || []);
    } catch (error) {
      console.error("❌ Unexpected error:", error);
      setPosts([]);
    }
  }

  const categories = ["전체", ...Array.from(new Set(posts.map(p => p.category)))];
  
  const filteredPosts = selectedCategory === "전체" 
    ? posts 
    : posts.filter(p => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">📢 공지사항</h1>
          <p className="text-sm text-gray-600">
            김포국악원 수강생 공지사항입니다
          </p>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:border-blue-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Posts List */}
        {filteredPosts.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
            <p className="text-gray-500">공지사항이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                  post.is_pinned ? "border-yellow-400 bg-yellow-50" : "border-gray-200"
                }`}
              >
                <button
                  onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                  className="w-full text-left p-4 md:p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {post.is_pinned && (
                          <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs rounded font-bold">
                            ★ 필독
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                          {post.category}
                        </span>
                        {post.tag && post.tag !== post.category && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                            #{post.tag}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(post.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1">
                        {post.title}
                      </h3>
                      {expandedPost !== post.id && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {post.content}
                        </p>
                      )}
                    </div>
                    <span className="text-gray-400 text-xl flex-shrink-0">
                      {expandedPost === post.id ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedPost === post.id && (
                  <div className="px-4 md:px-5 pb-5 border-t border-gray-100 pt-4 mt-2 bg-white">
                    <div className="prose prose-sm max-w-none">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-base">
                        {post.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800">
            💡 공지사항은 수강 중인 회원만 확인할 수 있습니다. 문의사항은 원장님께 직접 연락해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
