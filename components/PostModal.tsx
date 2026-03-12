"use client";

import React, { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { sanitizeHtml } from "@/lib/html-utils";
import { uploadBlogImage, normalizeImage } from "@/lib/upload-image";
import { toDatetimeLocalKST, parseDatetimeLocalAsKST } from "@/lib/date-utils";
import { getBlogPostPath } from "@/lib/blog-utils";

const TINYMCE_CDN = "https://cdn.jsdelivr.net/npm/tinymce@7/tinymce.min.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TinyEditor: React.ComponentType<any> = dynamic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => import("@tinymce/tinymce-react").then((m) => m.Editor as any),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] bg-gray-50 animate-pulse flex items-center justify-center rounded-lg border border-gray-300 text-gray-400">
        에디터 로딩 중...
      </div>
    ),
  }
);

const BUCKET = "public-media";
const BLOG_CATEGORIES = ["음악교실", "국악원소식"] as const;
type BlogCategory = (typeof BLOG_CATEGORIES)[number];

const TINYMCE_CONTENT_CSS = [
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css",
  "https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&family=Nanum+Myeongjo:wght@400;700&display=swap",
];

const TINYMCE_CONTENT_STYLE = `
  body {
    font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 16px; line-height: 1.7; color: #111;
    max-width: 100%; padding: 12px 16px; word-break: keep-all;
  }
  img { max-width: 100%; height: auto; display: block; margin: 0.6em auto; }
  table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: 0.95em; }
  th { background-color: #e8f0fe; font-weight: 700; color: #1e3a5f; padding: 8px 12px; border: 1px solid #a8c0e8; }
  td { padding: 7px 12px; border: 1px solid #cbd5e1; vertical-align: top; }
  tr:nth-child(even) td { background-color: #f8fafc; }
  a { color: #2563eb; text-decoration: underline; }
  h1 { font-family: 'Nanum Myeongjo', 'Noto Serif KR', Georgia, serif; font-size: 1.8em; font-weight: 700; margin: 0.9em 0 0.35em; }
  h2 { font-family: 'Nanum Myeongjo', 'Noto Serif KR', Georgia, serif; font-size: 1.4em; font-weight: 700; margin: 0.7em 0 0.25em; }
  h3 { font-family: 'Nanum Myeongjo', 'Noto Serif KR', Georgia, serif; font-size: 1.15em; font-weight: 600; margin: 0.5em 0 0.2em; }
  ul { list-style: disc; padding-left: 1.5em; margin-bottom: 0.8em; }
  ol { list-style: decimal; padding-left: 1.5em; margin-bottom: 0.8em; }
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

type Props = {
  editingPost: PostForEdit | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function PostModal({ editingPost, onClose, onSaved }: Props) {
  const isEdit = !!editingPost;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

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
    if (!file.type.startsWith("image/")) { alert("이미지 파일만 업로드 가능합니다."); return; }
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
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { alert("제목을 입력해주세요."); return; }
    const editorContent: string = editorRef.current?.getContent() ?? "";
    if (!editorContent.replace(/<[^>]+>/g, "").trim()) {
      alert("내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      let thumbnailUrl: string | null = editingPost?.thumbnail_url ?? null;
      if (thumbnailFile) {
        let thumbBlob: Blob = thumbnailFile;
        let ext = thumbnailFile.name.split(".").pop() || "jpg";
        try {
          const norm = await normalizeImage(thumbnailFile);
          thumbBlob = norm.blob; ext = norm.ext;
        } catch { /* fallback */ }
        const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, thumbBlob, { upsert: true });
        if (upErr) {
          const msg = upErr.message || JSON.stringify(upErr);
          if (msg.includes("Bucket") || msg.includes("bucket")) {
            alert("Storage 버킷이 없습니다. Supabase Dashboard > Storage에서 'public-media' 버킷을 생성해주세요.");
          } else {
            alert(`이미지 업로드 실패: ${msg}`);
          }
          setSaving(false); return;
        }
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
      if (isEdit && editingPost) {
        const { error } = await supabase.from("posts").update(payload).eq("id", editingPost.id);
        if (error) throw new Error(error.message);
        postPath = getBlogPostPath(payload.slug, editingPost.id);
        alert("✅ 게시글이 수정되었습니다.");
      } else {
        const { data, error } = await supabase.from("posts").insert(payload).select("id").single();
        if (error) throw new Error(error.message);
        postPath = getBlogPostPath(payload.slug, data.id);
        alert("✅ 게시글이 등록되었습니다.");
      }

      if (publishedAtValue && new Date(publishedAtValue) <= new Date()) {
        fetch(`/api/indexnow?path=${encodeURIComponent(postPath)}`).catch(() => {});
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      alert(`저장 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? "게시글 수정" : "새 글 작성"}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="overflow-y-auto flex-1 p-4 space-y-4 modal-scroll">

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 *</label>
              <div className="flex gap-4">
                {BLOG_CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="postCategory" value={cat}
                      checked={postCategory === cat} onChange={() => setPostCategory(cat)}
                      className="text-blue-600"
                    />
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                      cat === "음악교실" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    }`}>{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 썸네일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">썸네일 이미지</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {thumbnailPreview && (
                <div className="mt-2 relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnailPreview} alt="미리보기" className="h-24 w-auto rounded-lg border border-gray-200 object-cover" />
                  <button type="button" onClick={clearThumbnail}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600">
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* 외부 링크 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">외부 링크 (선택)</label>
              <input type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">언론보도인 경우 기사 링크를 입력하세요.</p>
            </div>

            {/* 발행 일시 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">발행 일시</label>
              <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">미래 시각을 선택하면 예약 발행됩니다.</p>
            </div>

            {/* SEO */}
            <details className="border border-gray-200 rounded-lg">
              <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                SEO 설정 (선택)
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meta Title <span className="text-xs font-normal text-gray-400">비우면 게시글 제목 사용</span>
                  </label>
                  <input type="text" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)}
                    maxLength={100} placeholder="검색결과에 표시될 제목 (권장 60자 이내)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meta Description <span className="text-xs font-normal text-gray-400">비우면 본문 앞부분 사용</span>
                  </label>
                  <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)}
                    rows={2} maxLength={300} placeholder="검색결과에 표시될 설명 (권장 150자 이내)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Keywords</label>
                  <input type="text" value={metaKeywords} onChange={(e) => setMetaKeywords(e.target.value)}
                    maxLength={200} placeholder="키워드1, 키워드2, 키워드3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug <span className="text-xs font-normal text-gray-400">SEO URL (예: minyo-bawoogi)</span>
                  </label>
                  <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
                    maxLength={200} placeholder="minyo-bawoogi"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </details>

            {/* ── TinyMCE 에디터 ── */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">내용 *</label>
              {/* key: 수정/신규 전환 시 에디터 강제 재마운트 → initialValue 정상 적용 */}
              <TinyEditor
                key={editingPost?.id ?? "new"}
                tinymceScriptSrc={TINYMCE_CDN}
                licenseKey="gpl"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onInit={(_evt: any, editor: any) => { editorRef.current = editor; }}
                initialValue={editingPost?.content ?? ""}
                init={{
                  height: 420,
                  menubar: false,
                  plugins: [
                    "table", "image", "media", "link", "lists", "code",
                    "fullscreen", "autolink",
                  ],
                  toolbar:
                    "undo redo | styles fontfamily fontsize | bold italic underline | " +
                    "alignleft aligncenter alignright | " +
                    "bullist numlist | link image media table | code fullscreen | removeformat",
                  toolbar_mode: "sliding",
                  font_family_formats:
                    "프리텐다드=Pretendard,sans-serif; " +
                    "나눔명조='Nanum Myeongjo',serif; " +
                    "나눔고딕='Nanum Gothic',sans-serif",
                  fontsize_formats:
                    "8px 10px 11px 12px 14px 16px 18px 20px 24px 28px 32px 36px 48px",
                  table_toolbar:
                    "tableprops tabledelete | " +
                    "tableinsertrowbefore tableinsertrowafter tabledeleterow | " +
                    "tableinsertcolbefore tableinsertcolafter tabledeletecol",
                  table_resize_bars: true,
                  table_column_resizing: "resizetable",
                  image_advtab: true,
                  image_caption: true,
                  automatic_uploads: true,
                  images_upload_handler: imageUploadHandler,
                  file_picker_types: "image",
                  media_live_embeds: true,
                  content_css: TINYMCE_CONTENT_CSS,
                  content_style: TINYMCE_CONTENT_STYLE,
                  skin: "oxide",
                  branding: false,
                  promotion: false,
                }}
              />
            </div>

          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-3 p-4 border-t border-gray-200">
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium">
              {saving ? "저장 중..." : isEdit ? "수정하기" : "등록하기"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
