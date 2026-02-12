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
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = ["일반", "수업", "행사", "공연", "모집"];

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "일반",
    tag: "",
  });

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

  async function handleSavePost() {
    if (!formData.title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    if (!formData.content.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (editingPost) {
        // Update existing post
        const { error } = await supabase
          .from("posts")
          .update({
            title: formData.title.trim(),
            content: formData.content.trim(),
            category: formData.category,
            tag: formData.tag.trim() || formData.category,
          })
          .eq("id", editingPost.id);

        if (error) {
          console.error("❌ Update error:", error);
          throw error;
        }

        console.log("✅ Post updated");
        alert("✅ 공지가 수정되었습니다.");
      } else {
        // Create new post
        const postData = {
          title: formData.title.trim(),
          content: formData.content.trim(),
          category: formData.category,
          tag: formData.tag.trim() || formData.category,
          is_pinned: false,
          author_id: user?.id || null,
        };

        console.log("📝 Creating post:", postData);

        const { data, error } = await supabase
          .from("posts")
          .insert(postData)
          .select();

        if (error) {
          console.error("❌ Insert error:", error);
          throw error;
        }

        console.log("✅ Post created:", data);
        alert("✅ 공지가 등록되었습니다.");
      }

      await loadPosts();
      closeModal();
    } catch (error: any) {
      console.error("❌ Save post error:", error);
      alert(`저장 중 오류가 발생했습니다.\n\n${error.message || "알 수 없는 오류"}`);
    }
  }

  async function handleTogglePin(postId: string, currentPinned: boolean) {
    try {
      const { error } = await supabase
        .from("posts")
        .update({ is_pinned: !currentPinned })
        .eq("id", postId);

      if (error) throw error;

      await loadPosts();
      alert(currentPinned ? "고정이 해제되었습니다." : "✅ 상단에 고정되었습니다.");
    } catch (error) {
      console.error("Toggle pin error:", error);
      alert("고정 설정 중 오류가 발생했습니다.");
    }
  }

  async function handleDeletePost(post: Post) {
    if (!confirm(`"${post.title}" 공지를 삭제하시겠습니까?\n\n⚠️ 삭제된 데이터는 복구할 수 없습니다.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      await loadPosts();
      alert("✅ 공지가 삭제되었습니다.");
    } catch (error) {
      console.error("Delete post error:", error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  function openWriteModal() {
    setEditingPost(null);
    setFormData({
      title: "",
      content: "",
      category: "일반",
      tag: "",
    });
    setShowWriteModal(true);
  }

  function openEditModal(post: Post) {
    setEditingPost(post);
    setFormData({
      title: post.title,
      content: post.content,
      category: post.category,
      tag: post.tag || "",
    });
    setShowWriteModal(true);
  }

  function closeModal() {
    setShowWriteModal(false);
    setEditingPost(null);
    setFormData({
      title: "",
      content: "",
      category: "일반",
      tag: "",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">공지사항 관리</h1>
              <p className="text-sm text-gray-600 mt-1">
                수강생 공지사항을 작성하고 관리합니다
              </p>
            </div>
            <button
              onClick={openWriteModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap shadow-md hover:shadow-lg"
            >
              + 새 공지 작성
            </button>
          </div>
        </div>

        {/* Posts List */}
        {posts.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
            <p className="text-gray-500 mb-2">📝 아직 작성된 공지가 없습니다.</p>
            <p className="text-sm text-gray-400">
              "새 공지 작성" 버튼을 눌러 첫 공지를 작성해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-4 md:p-5 ${
                  post.is_pinned ? "border-yellow-400 bg-yellow-50" : "border-gray-200"
                }`}
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
                      <span className="text-xs text-gray-500">
                        {new Date(post.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {post.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {post.content}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleTogglePin(post.id, post.is_pinned)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        post.is_pinned
                          ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                      title={post.is_pinned ? "고정 해제" : "상단 고정"}
                    >
                      {post.is_pinned ? "★" : "☆"}
                    </button>
                    <button
                      onClick={() => openEditModal(post)}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-xs font-medium"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeletePost(post)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs font-medium"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Write/Edit Modal */}
        {showWriteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingPost ? "공지 수정" : "새 공지 작성"}
              </h2>

              <div className="overflow-y-auto flex-1 space-y-4 mb-4 modal-scroll">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    제목 *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="공지 제목을 입력하세요"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    카테고리 *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <label
                        key={cat}
                        className={`px-3 py-2 border-2 rounded-lg cursor-pointer transition-all ${
                          formData.category === cat
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-300 hover:border-blue-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="category"
                          value={cat}
                          checked={formData.category === cat}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tag (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    태그 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    placeholder="예: 긴급, 중요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    입력하지 않으면 카테고리가 태그로 사용됩니다
                  </p>
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    내용 *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="공지 내용을 입력하세요"
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSavePost}
                  disabled={!formData.title.trim() || !formData.content.trim()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
                >
                  {editingPost ? "✅ 수정하기" : "✅ 등록하기"}
                </button>
                <button
                  onClick={closeModal}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
