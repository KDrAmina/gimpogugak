"use client";

import React, { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeHtml } from "@/lib/html-utils";
import { uploadBlogImage, normalizeImage } from "@/lib/upload-image";
import { toDatetimeLocalKST, parseDatetimeLocalAsKST } from "@/lib/date-utils";
import { getBlogPostPath } from "@/lib/blog-utils";
import { revalidateBlogList, revalidateBlogPost } from "@/app/actions/revalidate";

// ─── TinyMCE ───────────────────────────────────────────────────────────────
// CDN 방식으로 로딩 (admin 전용 → 공개 번들 영향 없음)
// tinymce npm 패키지는 TypeScript 타입 전용으로만 사용 (next.config.ts externals)
const TINYMCE_CDN = "https://cdn.jsdelivr.net/npm/tinymce@7/tinymce.min.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TinyEditor: React.ComponentType<any> = dynamic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => import("@tinymce/tinymce-react").then((m) => m.Editor as any),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] bg-gray-50 animate-pulse flex items-center justify-center rounded-lg border border-gray-300 text-gray-400">
        에디터 로딩 중...
      </div>
    ),
  }
);

const BUCKET = "public-media";
const BLOG_CATEGORIES = ["음악교실", "국악원소식"] as const;
type BlogCategory = (typeof BLOG_CATEGORIES)[number];

// 에디터 iframe 내부에 로드할 폰트 CSS
const TINYMCE_CONTENT_CSS = [
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css",
  "https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&family=Nanum+Myeongjo:wght@400;700&display=swap",
];

const TINYMCE_CONTENT_STYLE = `
  body {
    font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 16px;
    line-height: 1.7;
    color: #111;
    max-width: 100%;
    padding: 12px 24px;
    word-break: keep-all;
    overflow-wrap: break-word;
  }
  img { max-width: 100%; height: auto; display: block; margin: 0.6em auto; }
  table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: 0.95em; }
  th { background-color: #e8f0fe; font-weight: 700; color: #1e3a5f; padding: 10px 14px; border: 1px solid #a8c0e8; text-align: left; }
  td { padding: 8px 14px; border: 1px solid #cbd5e1; vertical-align: top; line-height: 1.6; }
  tr:nth-child(even) td { background-color: #f8fafc; }
  tr:hover td { background-color: #eff6ff; }
  a { color: #2563eb; text-decoration: underline; text-underline-offset: 3px; }
  h1 { font-family: 'Nanum Myeongjo', 'Noto Serif KR', Georgia, serif; font-size: 2em; font-weight: 700; margin: 1em 0 0.4em; }
  h2 { font-family: 'Nanum Myeongjo', 'Noto Serif KR', Georgia, serif; font-size: 1.5em; font-weight: 700; margin: 0.8em 0 0.3em; }
  h3 { font-family: 'Nanum Myeongjo', 'Noto Serif KR', Georgia, serif; font-size: 1.25em; font-weight: 600; margin: 0.6em 0 0.25em; }
  ul { list-style: disc; padding-left: 1.5em; margin-bottom: 0.8em; }
  ol { list-style: decimal; padding-left: 1.5em; margin-bottom: 0.8em; }
  li { margin-bottom: 0.2em; }
  blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; color: #6b7280; margin: 1em 0; }
  pre { background: #23241f; color: #f8f8f2; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.9em; line-height: 1.5; }
  code { background: #f1f5f9; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; }
  iframe { max-width: 100%; border: none; border-radius: 8px; }
`;

export type PostForEdit = {
  id: string;
  title: string;
  content: string;
  category: string;
  thumbnail_url: string | null;
  external_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  slug: string | null;
  published_at: string | null;
};

type Props = { editingPost?: PostForEdit | null; returnPage?: number };

export default function PostEditor({ editingPost = null, returnPage = 1 }: Props) {
  const [title, setTitle] = useState(editingPost?.title ?? "");
  const [postCategory, setPostCategory] = useState<BlogCategory>(
    BLOG_CATEGORIES.includes(editingPost?.category as BlogCategory)
      ? (editingPost!.category as BlogCategory)
      : "음악교실"
  );
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    editingPost?.thumbnail_url ?? null
  );
  const [externalUrl, setExternalUrl] = useState(editingPost?.external_url ?? "");
  const [metaTitle, setMetaTitle] = useState(editingPost?.meta_title ?? "");
  const [metaDescription, setMetaDescription] = useState(editingPost?.meta_description ?? "");
  const [metaKeywords, setMetaKeywords] = useState(editingPost?.meta_keywords ?? "");
  const [slug, setSlug] = useState(editingPost?.slug ?? "");
  const [publishedAt, setPublishedAt] = useState(() =>
    toDatetimeLocalKST(editingPost?.published_at ?? new Date().toISOString())
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  // ─── TinyMCE 이미지 업로드 핸들러 ───────────────────────────────────────
  const imageUploadHandler = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (blobInfo: any): Promise<string> => {
      const file = new File([blobInfo.blob()], blobInfo.filename(), {
        type: blobInfo.blob().type || "image/jpeg",
      });
      const result = await uploadBlogImage(supabase, file);
      if ("error" in result) throw new Error(result.error);
      return result.url;
    },
    [supabase]
  );

  // ─── 썸네일 ─────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  function clearThumbnail() {
    setThumbnailFile(null);
    if (thumbnailPreview?.startsWith("blob:")) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── 저장 ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim()) { alert("제목을 입력해주세요."); return; }
    const editorContent: string = editorRef.current?.getContent() ?? "";
    if (!editorContent.replace(/<[^>]+>/g, "").trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      // 썸네일 업로드
      let thumbnailUrl: string | null = editingPost?.thumbnail_url ?? null;
      if (thumbnailFile) {
        let thumbBlob: Blob = thumbnailFile;
        let ext = thumbnailFile.name.split(".").pop() || "jpg";
        try {
          const norm = await normalizeImage(thumbnailFile);
          thumbBlob = norm.blob;
          ext = norm.ext;
        } catch { /* fallback to original */ }
        const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, thumbBlob, { upsert: true });
        if (upErr) { alert(`썸네일 업로드 실패: ${upErr.message}`); setSaving(false); return; }
        thumbnailUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const publishedAtValue = parseDatetimeLocalAsKST(publishedAt);
      const payload = {
        title: title.trim(),
        content: sanitizeHtml(editorContent),
        category: postCategory,
        tag: postCategory,
        thumbnail_url: thumbnailUrl,
        external_url: externalUrl.trim() || null,
        author_id: user?.id ?? null,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
        meta_keywords: metaKeywords.trim() || null,
        slug: slug.trim().replace(/\s+/g, "-") || null,
        published_at: publishedAtValue,
      };

      let postPath: string;
      if (editingPost) {
        const { error } = await supabase.from("posts").update(payload).eq("id", editingPost.id);
        if (error) throw new Error(error.message);
        postPath = getBlogPostPath(payload.slug, editingPost.id);
      } else {
        const { data, error } = await supabase.from("posts").insert(payload).select("id").single();
        if (error) throw new Error(error.message);
        postPath = getBlogPostPath(payload.slug, data.id);
        alert("✅ 게시글이 등록되었습니다.");
      }

      // On-Demand Revalidation: DB 저장 즉시 ISR 캐시 갱신
      await revalidateBlogList();
      await revalidateBlogPost(postPath);

      if (publishedAtValue && new Date(publishedAtValue) <= new Date()) {
        fetch(`/api/indexnow?path=${encodeURIComponent(postPath)}`).catch(() => {});
      }

      if (editingPost) {
        setToast("수정이 완료되었습니다. 목록으로 돌아갑니다.");
        setTimeout(() => {
          router.replace(`/admin/posts/manage?page=${returnPage}`);
        }, 1500);
      } else {
        router.replace(`/blog/${postPath}`);
      }
    } catch (err: unknown) {
      alert(`저장 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* 저장 완료 토스트 */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-green-600 text-white text-sm font-medium rounded-xl shadow-lg animate-fade-in">
          ✅ {toast}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {editingPost ? "게시글 수정" : "새 글 작성"}
        </h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ← 뒤로
        </button>
      </div>

      {/* 제목 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
        />
      </div>

      {/* 카테고리 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 *</label>
        <div className="flex gap-4">
          {BLOG_CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="postCategory"
                value={cat}
                checked={postCategory === cat}
                onChange={() => setPostCategory(cat)}
                className="text-blue-600"
              />
              <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                cat === "음악교실" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
              }`}>
                {cat}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 썸네일 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">썸네일 이미지</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {thumbnailPreview && (
          <div className="mt-2 relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailPreview} alt="미리보기" className="h-24 w-auto rounded-lg border border-gray-200 object-cover" />
            <button
              type="button"
              onClick={clearThumbnail}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 외부 링크 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">외부 링크 (선택)</label>
        <input
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">언론보도인 경우 기사 링크를 입력하세요.</p>
      </div>

      {/* 발행 일시 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">발행 일시</label>
        <input
          type="datetime-local"
          value={publishedAt}
          onChange={(e) => setPublishedAt(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">미래 시각을 선택하면 예약 발행됩니다.</p>
      </div>

      {/* ── TinyMCE 에디터 ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">내용 *</label>
        <TinyEditor
          tinymceScriptSrc={TINYMCE_CDN}
          licenseKey="gpl"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onInit={(_evt: any, editor: any) => { editorRef.current = editor; }}
          initialValue={editingPost?.content ?? ""}
          init={{
            height: 620,
            menubar: "edit insert format table tools",
            plugins: [
              "table", "image", "media", "link", "lists", "code",
              "searchreplace", "fullscreen", "wordcount", "nonbreaking",
              "charmap", "autolink",
            ],
            toolbar:
              "undo redo | styles fontfamily fontsize | bold italic underline strikethrough | " +
              "forecolor backcolor | alignleft aligncenter alignright alignjustify | " +
              "bullist numlist | outdent indent | " +
              "link image media table | code fullscreen | removeformat",
            toolbar_mode: "sliding",
            // ── 폰트 패밀리 목록 ────────────────────────────────────────
            font_family_formats:
              "프리텐다드=Pretendard,sans-serif; " +
              "나눔명조='Nanum Myeongjo',serif; " +
              "나눔고딕='Nanum Gothic',sans-serif",
            // ── 폰트 크기 목록 (px 직접 지정) ───────────────────────────
            fontsize_formats:
              "8px 10px 11px 12px 14px 16px 18px 20px 24px 28px 32px 36px 48px",
            // ── 표(Table) 플러그인 ──────────────────────────────────────
            table_toolbar:
              "tableprops tabledelete | " +
              "tableinsertrowbefore tableinsertrowafter tabledeleterow | " +
              "tableinsertcolbefore tableinsertcolafter tabledeletecol",
            table_resize_bars: true,
            table_column_resizing: "resizetable",
            table_appearance_options: true,
            table_advtab: true,
            table_cell_advtab: true,
            table_row_advtab: true,
            // ── 이미지 ────────────────────────────────────────────────
            image_advtab: true,
            image_caption: true,
            automatic_uploads: true,
            images_upload_handler: imageUploadHandler,
            file_picker_types: "image",
            // ── 미디어(동영상) ────────────────────────────────────────
            media_live_embeds: true,
            // ── 에디터 내부 폰트 및 스타일 ──────────────────────────
            content_css: TINYMCE_CONTENT_CSS,
            content_style: TINYMCE_CONTENT_STYLE,
            skin: "oxide",
            branding: false,
            promotion: false,
          }}
        />
      </div>

      {/* SEO 설정 */}
      <details className="border border-gray-200 rounded-lg">
        <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
          SEO 설정 (선택)
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Title <span className="text-xs font-normal text-gray-400">비우면 게시글 제목 사용</span>
            </label>
            <input
              type="text" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)}
              maxLength={100} placeholder="검색결과에 표시될 제목 (권장 60자 이내)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description <span className="text-xs font-normal text-gray-400">비우면 본문 앞부분 사용</span>
            </label>
            <textarea
              value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)}
              rows={2} maxLength={300} placeholder="검색결과에 표시될 설명 (권장 150자 이내)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Keywords</label>
            <input
              type="text" value={metaKeywords} onChange={(e) => setMetaKeywords(e.target.value)}
              maxLength={200} placeholder="키워드1, 키워드2, 키워드3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug <span className="text-xs font-normal text-gray-400">SEO URL (예: minyo-bawoogi)</span>
            </label>
            <input
              type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
              maxLength={200} placeholder="minyo-bawoogi"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </details>

      {/* 저장 버튼 */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-400 font-semibold text-base transition-colors"
        >
          {saving ? "저장 중..." : editingPost ? "수정하기" : "등록하기"}
        </button>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium text-base transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}
