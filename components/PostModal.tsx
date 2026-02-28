"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { sanitizeHtml } from "@/lib/html-utils";
import { uploadBlogImage, normalizeImage } from "@/lib/upload-image";
import { toDatetimeLocalKST, parseDatetimeLocalAsKST } from "@/lib/date-utils";
import { getBlogPostPath } from "@/lib/blog-utils";

// ⚠️ react-quill-new / quill are NOT statically imported here.
// All Quill module loading and format registration happens inside the
// useEffect init() below so that the editor code stays out of the main
// (public) JS bundle and is only fetched when the admin modal first mounts.

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-gray-50 animate-pulse flex items-center justify-center">
      에디터 로딩 중...
    </div>
  ),
});

const BUCKET = "public-media"; // 썸네일용; 본문 이미지는 lib/upload-image 사용
const BLOG_CATEGORIES = ["음악교실", "국악원소식"] as const;
type BlogCategory = (typeof BLOG_CATEGORIES)[number];

type QuillEditor = {
  getSelection: (x: boolean) => { index: number; length: number } | null;
  getLength: () => number;
  insertEmbed: (i: number, t: string, u: string, s: string) => void;
  setSelection: (i: number, l: number) => void;
};

const QUILL_MODULES = (imageHandler: () => void) => ({
  toolbar: {
    container: [
      [{ font: [false, "gowunDodum", "nanumMyeongjo"] }],
      [{ size: ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"] }],
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ align: [] }],
      ["link", "image"],
      ["clean"],
    ],
    handlers: { image: imageHandler },
  },
  resize: {
    modules: ["DisplaySize", "Toolbar", "Resize", "Keyboard"],
    parchment: {
      image: { attribute: ["width"], limit: { minWidth: 80, maxWidth: 1200 } },
    },
    tools: ["left", "center", "right", "full"],
  },
});

const QUILL_FORMATS = [
  "font",
  "size",
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "align",
  "link",
  "image",
  "resize-inline",
  "resize-block",
];

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
  const [title, setTitle] = useState("");
  const [postCategory, setPostCategory] = useState<BlogCategory>("음악교실");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [content, setContent] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [slug, setSlug] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceDraft, setSourceDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<unknown>(null);
  const clipboardMatcherAdded = useRef(false);
  const supabase = createClient();

  const isEdit = !!editingPost;

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title);
      setPostCategory(
        BLOG_CATEGORIES.includes(editingPost.category as BlogCategory)
          ? (editingPost.category as BlogCategory)
          : "음악교실"
      );
      setContent(editingPost.content);
      setExternalUrl(editingPost.external_url || "");
      setThumbnailPreview(editingPost.thumbnail_url);
      setMetaTitle(editingPost.meta_title || "");
      setMetaDescription(editingPost.meta_description || "");
      setMetaKeywords(editingPost.meta_keywords || "");
      setSlug(editingPost.slug || "");
      setPublishedAt(toDatetimeLocalKST(editingPost.published_at));
    } else {
      setTitle("");
      setPostCategory("음악교실");
      setContent("");
      setExternalUrl("");
      setThumbnailFile(null);
      setThumbnailPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMetaTitle("");
      setMetaDescription("");
      setMetaKeywords("");
      setSlug("");
      setPublishedAt(toDatetimeLocalKST(new Date().toISOString()));
    }
  }, [editingPost]);

  const uploadImageAndInsert = useCallback(
    async (file: File, atIndex?: number) => {
      const editor = (quillRef.current as { getEditor?: () => QuillEditor })?.getEditor?.();
      if (!editor) return;
      const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
      const insertIndex = atIndex ?? range.index;

      const result = await uploadBlogImage(supabase, file);
      if ("error" in result) {
        alert(`이미지 업로드 실패: ${result.error}`);
        return;
      }
      const altText = (typeof window !== "undefined" && window.prompt?.("Enter Alt Text for SEO (optional):")) || "";
      editor.insertEmbed(insertIndex, "image", { url: result.url, alt: altText } as unknown as string, "user");
      editor.setSelection(insertIndex + 1, 0);
    },
    [supabase]
  );

  useEffect(() => {
    const init = async () => {
      // 1. Load the Quill core via react-quill-new and register custom formats.
      //    This import is fully dynamic — Quill stays out of the main bundle.
      const { Quill: QuillCore } = await import("react-quill-new");

      const SizeStyle = QuillCore.import("attributors/style/size") as { whitelist: string[] };
      SizeStyle.whitelist = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      QuillCore.register(SizeStyle as any, true);

      const Font = QuillCore.import("formats/font") as { whitelist: string[] };
      Font.whitelist = ["gowunDodum", "nanumMyeongjo"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      QuillCore.register(Font as any, true);

      // 1b. Custom Image blot with alt attribute support for SEO
      const BaseImage = QuillCore.import("formats/image");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      class ImageWithAlt extends (BaseImage as any) {
        static blotName = "image";
        static tagName = "IMG";

        static create(value: string | { url?: string; src?: string; alt?: string }) {
          const url = typeof value === "string" ? value : value?.url || value?.src || "";
          const node = super.create(url);
          if (typeof value === "object" && value?.alt != null) {
            node.setAttribute("alt", String(value.alt));
          }
          return node;
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      QuillCore.register(ImageWithAlt as any, true);

      // 2. Load the image-resize plugin and register it.
      const QuillModule = (await import("quill")).default;
      const QuillResize = (await import("quill-resize-module")).default;
      QuillModule.register("modules/resize", QuillResize);

      // 3. Load editor CSS lazily — only needed inside the admin modal.
      //    webpack handles CSS dynamic imports at runtime; TypeScript has no
      //    declarations for CSS files so we suppress the module-not-found error.
      // @ts-ignore
      await import("react-quill-new/dist/quill.snow.css");
      // @ts-ignore
      await import("quill-resize-module/dist/resize.css");

      setEditorReady(true);
    };
    init();
  }, []);

  // Clipboard matcher: IMG paste 시 Base64 삽입 차단 (우리 핸들러가 업로드 후 URL 삽입)
  useEffect(() => {
    if (!editorReady || clipboardMatcherAdded.current) return;
    const timer = setTimeout(() => {
      const editor = (quillRef.current as { getEditor?: () => { clipboard?: { addMatcher: (sel: string, fn: (node: Node, delta: unknown) => unknown) => void } } })?.getEditor?.();
      const clipboard = editor?.clipboard;
      if (clipboard && !clipboardMatcherAdded.current) {
        clipboardMatcherAdded.current = true;
        import("quill").then(({ default: Quill }) => {
          const Delta = Quill.import("delta");
          clipboard.addMatcher("IMG", () => new Delta());
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [editorReady]);

  const toggleSourceMode = useCallback(() => {
    if (sourceMode) {
      setContent(sanitizeHtml(sourceDraft));
      setSourceMode(false);
    } else {
      setSourceDraft(content);
      setSourceMode(true);
    }
  }, [sourceMode, sourceDraft, content]);

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        await uploadImageAndInsert(file);
        input.value = "";
      }
    };
  }, [uploadImageAndInsert]);

  /** 드롭: capture로 Quill 기본 동작보다 먼저 실행, Base64 중복 삽입 방지 */
  const handleEditorDrop = useCallback(
    async (e: React.DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (file?.type.startsWith("image/")) {
        e.preventDefault();
        e.stopPropagation();
        await uploadImageAndInsert(file);
      }
    },
    [uploadImageAndInsert]
  );

  /** 붙여넣기: capture로 Quill 기본 동작보다 먼저 실행, Base64 중복 삽입 방지 */
  const handleEditorPaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (sourceMode) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const editor = (quillRef.current as { getEditor?: () => QuillEditor })?.getEditor?.();
      if (!editor) return;
      let index = editor.getSelection(true)?.index ?? editor.getLength();
      for (const file of imageFiles) {
        await uploadImageAndInsert(file, index);
        index += 1;
      }
    },
    [uploadImageAndInsert, sourceMode]
  );

  const modules = useMemo(() => QUILL_MODULES(imageHandler), [imageHandler]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("이미지 파일만 업로드 가능합니다.");
        return;
      }
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    } else {
      setThumbnailFile(null);
      if (thumbnailPreview?.startsWith("blob:")) URL.revokeObjectURL(thumbnailPreview);
      setThumbnailPreview(editingPost?.thumbnail_url || null);
    }
  }

  function clearThumbnail() {
    setThumbnailFile(null);
    if (thumbnailPreview?.startsWith("blob:")) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }
    const contentText = content.replace(/<p><br><\/p>/g, "").trim();
    if (!contentText || contentText === "<p></p>") {
      alert("내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      let thumbnailUrl: string | null = editingPost?.thumbnail_url || null;

      if (thumbnailFile) {
        let thumbBlob: Blob = thumbnailFile;
        let ext = thumbnailFile.name.split(".").pop() || "jpg";
        try {
          const norm = await normalizeImage(thumbnailFile);
          thumbBlob = norm.blob;
          ext = norm.ext;
        } catch { /* fallback to original */ }
        const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, thumbBlob, { upsert: true });
        if (uploadError) {
          const msg = uploadError.message || JSON.stringify(uploadError);
          if (msg.includes("Bucket") || msg.includes("bucket")) {
            alert("Storage 버킷이 없습니다. Supabase Dashboard > Storage에서 'public-media' 버킷을 생성해주세요.");
          } else {
            alert(`이미지 업로드 실패: ${msg}`);
          }
          setSaving(false);
          return;
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        thumbnailUrl = urlData.publicUrl;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const publishedAtValue = parseDatetimeLocalAsKST(publishedAt);
      const payload = {
        title: title.trim(),
        content: sanitizeHtml(content.trim()),
        category: postCategory,
        tag: postCategory,
        thumbnail_url: thumbnailUrl,
        external_url: externalUrl.trim() || null,
        author_id: user?.id ?? null,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
        meta_keywords: metaKeywords.trim() || null,
        slug: slug.trim().replace(/\s+/g, '-') || null,
        published_at: publishedAtValue,
      };

      let postPath: string;

      if (isEdit && editingPost) {
        const { error } = await supabase
          .from("posts")
          .update(payload)
          .eq("id", editingPost.id);

        if (error) throw new Error(error.message);
        postPath = getBlogPostPath(payload.slug, editingPost.id);
        alert("✅ 게시글이 수정되었습니다.");
      } else {
        const { data, error } = await supabase
          .from("posts")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        postPath = getBlogPostPath(payload.slug, data.id);
        alert("✅ 게시글이 등록되었습니다.");
      }

      fetch(`/api/indexnow?path=${encodeURIComponent(postPath)}`).catch(() => {});

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Save error:", err);
      alert(`저장 중 오류가 발생했습니다. ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? "게시글 수정" : "새 글 작성"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="overflow-y-auto flex-1 p-4 space-y-4 modal-scroll">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

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
                      cat === "음악교실"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {cat}
                    </span>
                  </label>
                ))}
              </div>
            </div>

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
                  <img
                    src={thumbnailPreview}
                    alt="미리보기"
                    className="h-24 w-auto rounded-lg border border-gray-200 object-cover"
                  />
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

            <details className="border border-gray-200 rounded-lg">
              <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                SEO 설정 (선택)
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meta Title
                    <span className="ml-1 text-xs font-normal text-gray-400">비우면 게시글 제목을 사용합니다</span>
                  </label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    maxLength={100}
                    placeholder="검색결과에 표시될 제목 (권장 60자 이내)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meta Description
                    <span className="ml-1 text-xs font-normal text-gray-400">비우면 본문 앞부분을 사용합니다</span>
                  </label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="검색결과에 표시될 설명 (권장 150자 이내)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Keywords</label>
                  <input
                    type="text"
                    value={metaKeywords}
                    onChange={(e) => setMetaKeywords(e.target.value)}
                    maxLength={200}
                    placeholder="키워드1, 키워드2, 키워드3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug
                    <span className="ml-1 text-xs font-normal text-gray-400">SEO 친화적 URL 경로 (예: minyo-bawoogi)</span>
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    maxLength={200}
                    placeholder="minyo-bawoogi"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </details>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">내용 *</label>
              <div
                className="quill-editor-wrapper [&_.ql-container]:min-h-[400px] [&_.ql-editor]:min-h-[380px]"
                onDropCapture={handleEditorDrop}
                onDragOver={(e) => e.preventDefault()}
                onPasteCapture={handleEditorPaste}
              >
                {!editorReady ? (
                  <div className="min-h-[400px] flex items-center justify-center border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    에디터 로딩 중...
                  </div>
                ) : sourceMode ? (
                  <>
                    <textarea
                      value={sourceDraft}
                      onChange={(e) => setSourceDraft(e.target.value)}
                      className="w-full min-h-[380px] p-4 font-mono text-sm border border-gray-300 rounded-t-lg bg-[#23241f] text-[#f8f8f2] resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="HTML 코드를 직접 입력하세요. <style> 태그도 사용 가능합니다."
                      spellCheck={false}
                    />
                    <div className="flex items-center justify-end gap-2 px-3 py-2 bg-[#f8f9fa] border border-t-0 border-gray-300 rounded-b-lg">
                      <button
                        type="button"
                        onClick={toggleSourceMode}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="적용 후 에디터로 돌아가기"
                      >
                        <span className="text-base">&lt;&gt;</span>
                        적용
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <ReactQuill
                      {...({ ref: quillRef } as object)}
                      theme="snow"
                      value={content}
                      onChange={setContent}
                      modules={modules}
                      formats={QUILL_FORMATS}
                      placeholder="내용을 입력하세요. 이미지는 드래그 앤 드롭 또는 이미지 버튼으로 추가할 수 있습니다."
                      className="[&_.ql-toolbar]:rounded-t-lg [&_.ql-container]:rounded-b-none [&_.ql-editor]:rounded-b-none"
                    />
                    <div className="flex items-center justify-end gap-2 px-3 py-2 bg-[#f8f9fa] border border-t-0 border-gray-300 rounded-b-lg">
                      <button
                        type="button"
                        onClick={toggleSourceMode}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="HTML 소스 코드 직접 편집"
                      >
                        <span className="text-base">&lt;&gt;</span>
                        HTML 소스
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 p-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {saving ? "저장 중..." : isEdit ? "수정하기" : "등록하기"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
