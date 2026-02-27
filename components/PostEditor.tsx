"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeHtml } from "@/lib/html-utils";
import { uploadBlogImage, normalizeImage } from "@/lib/upload-image";
import { toDatetimeLocalKST, parseDatetimeLocalAsKST } from "@/lib/date-utils";

// ⚠️ react-quill-new / quill are NOT statically imported here.
// All Quill module loading and format registration happens inside the
// useEffect init() below so that the editor code stays out of the main
// (public) JS bundle and is only fetched when the admin page first mounts.

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-gray-50 animate-pulse flex items-center justify-center">
      에디터 로딩 중...
    </div>
  ),
});

const BUCKET = "public-media";
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
  editingPost?: PostForEdit | null;
};

type ImageTooltipState = {
  visible: boolean;
  imgEl: HTMLImageElement | null;
  alt: string;
  caption: string;
  top: number;
  left: number;
};

export default function PostEditor({ editingPost = null }: Props) {
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
  const [imageTooltip, setImageTooltip] = useState<ImageTooltipState>({
    visible: false, imgEl: null, alt: "", caption: "", top: 0, left: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<unknown>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const clipboardMatcherAdded = useRef(false);
  const supabase = createClient();
  const router = useRouter();

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
      editor.insertEmbed(insertIndex, "image", { url: result.url, alt: "" } as unknown as string, "user");
      editor.setSelection(insertIndex + 1, 0);
    },
    [supabase]
  );

  useEffect(() => {
    const init = async () => {
      const { Quill: QuillCore } = await import("react-quill-new");

      const SizeStyle = QuillCore.import("attributors/style/size") as { whitelist: string[] };
      SizeStyle.whitelist = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      QuillCore.register(SizeStyle as any, true);

      const Font = QuillCore.import("formats/font") as { whitelist: string[] };
      Font.whitelist = ["gowunDodum", "nanumMyeongjo"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      QuillCore.register(Font as any, true);

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

      const QuillModule = (await import("quill")).default;
      const QuillResize = (await import("quill-resize-module")).default;
      QuillModule.register("modules/resize", QuillResize);

      // @ts-ignore
      await import("react-quill-new/dist/quill.snow.css");
      // @ts-ignore
      await import("quill-resize-module/dist/resize.css");

      setEditorReady(true);
    };
    init();
  }, []);

  // Image click → floating tooltip
  useEffect(() => {
    if (!editorReady || sourceMode) return;
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;

    function findCaptionP(img: HTMLImageElement): HTMLParagraphElement | null {
      // Quill wraps images in <p>; the caption sits after that wrapper
      const anchor = img.closest("p") || img;
      const next = anchor.nextElementSibling;
      if (next?.tagName === "P" && next.classList.contains("ql-image-caption")) {
        return next as HTMLParagraphElement;
      }
      return null;
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" && target.closest(".ql-editor")) {
        const img = target as HTMLImageElement;
        const wrapperRect = wrapper!.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        const captionP = findCaptionP(img);
        setImageTooltip({
          visible: true,
          imgEl: img,
          alt: img.getAttribute("alt") || "",
          caption: captionP?.textContent || "",
          top: imgRect.bottom - wrapperRect.top + 8,
          left: imgRect.left - wrapperRect.left + imgRect.width / 2,
        });
        e.stopPropagation();
      } else if (!target.closest(".image-tooltip-popover")) {
        setImageTooltip((prev) => (prev.visible ? { ...prev, visible: false, imgEl: null } : prev));
      }
    }

    wrapper.addEventListener("click", handleClick, true);
    return () => wrapper.removeEventListener("click", handleClick, true);
  }, [editorReady, sourceMode]);

  const handleTooltipAltChange = useCallback((value: string) => {
    setImageTooltip((prev) => {
      if (prev.imgEl) prev.imgEl.setAttribute("alt", value);
      return { ...prev, alt: value };
    });
  }, []);

  const handleTooltipCaptionChange = useCallback((value: string) => {
    // Only update local React state — NO DOM manipulation here.
    // Caption is applied to the Quill Delta via the "적용" button or Enter key.
    setImageTooltip((prev) => ({ ...prev, caption: value }));
  }, []);

  const applyCaption = useCallback(() => {
    const img = imageTooltip.imgEl;
    if (!img) return;
    const editor = (quillRef.current as { getEditor?: () => QuillEditor & { root?: HTMLElement } })?.getEditor?.();
    if (!editor?.root) return;

    const captionText = imageTooltip.caption.trim();

    // Find the <p> wrapping the image
    const anchor = img.closest("p") || img;
    const next = anchor.nextElementSibling;
    const existingCaptionEl =
      next?.tagName === "P" && next.classList.contains("ql-image-caption")
        ? next
        : null;

    if (existingCaptionEl) {
      if (captionText) {
        existingCaptionEl.textContent = captionText;
      } else {
        existingCaptionEl.remove();
      }
    } else if (captionText) {
      const captionP = document.createElement("p");
      captionP.className = "ql-image-caption";
      captionP.style.textAlign = "center";
      captionP.textContent = captionText;
      anchor.after(captionP);
    }

    // Sync DOM → React state via innerHTML so Quill's content stays in sync
    setContent(editor.root.innerHTML);
    // Close tooltip after applying
    setImageTooltip((prev) => ({ ...prev, visible: false, imgEl: null }));
  }, [imageTooltip.imgEl, imageTooltip.caption]);

  const closeTooltip = useCallback(() => {
    setImageTooltip((prev) => ({ ...prev, visible: false, imgEl: null }));
  }, []);

  // Clipboard matcher: IMG paste 시 Base64 삽입 차단
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

      if (isEdit && editingPost) {
        const { error } = await supabase
          .from("posts")
          .update(payload)
          .eq("id", editingPost.id);

        if (error) throw new Error(error.message);
        alert("✅ 게시글이 수정되었습니다.");
      } else {
        const { error } = await supabase.from("posts").insert(payload);
        if (error) throw new Error(error.message);
        alert("✅ 게시글이 등록되었습니다.");
      }

      router.push("/admin/posts/manage");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Save error:", err);
      alert(`저장 중 오류가 발생했습니다. ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (title.trim() || content.replace(/<p><br><\/p>/g, "").trim()) {
      if (!confirm("작성 중인 내용이 있습니다. 정말 나가시겠습니까?")) return;
    }
    router.push("/admin/posts/manage");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
      {/* Main Content Area (Left/Center) */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Title */}
        <div className="mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full px-4 py-3 text-xl font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col">
          <div
            ref={editorWrapperRef}
            className="quill-editor-wrapper flex-1 relative [&_.ql-container]:min-h-[500px] [&_.ql-editor]:min-h-[480px] [&_.ql-container]:border-gray-300 [&_.ql-toolbar]:border-gray-300 [&_.ql-toolbar]:bg-white [&_.ql-toolbar]:sticky [&_.ql-toolbar]:top-16 [&_.ql-toolbar]:z-10"
            onDropCapture={handleEditorDrop}
            onDragOver={(e) => e.preventDefault()}
            onPasteCapture={handleEditorPaste}
          >
            {!editorReady ? (
              <div className="min-h-[500px] flex items-center justify-center border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                에디터 로딩 중...
              </div>
            ) : sourceMode ? (
              <>
                <textarea
                  value={sourceDraft}
                  onChange={(e) => setSourceDraft(e.target.value)}
                  className="w-full min-h-[500px] p-4 font-mono text-sm border border-gray-300 rounded-t-lg bg-[#23241f] text-[#f8f8f2] resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <div className="mx-auto max-w-2xl">
                  <ReactQuill
                    {...({ ref: quillRef } as object)}
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    modules={modules}
                    formats={QUILL_FORMATS}
                    placeholder="내용을 입력하세요. 이미지는 드래그 앤 드롭 또는 이미지 버튼으로 추가할 수 있습니다."
                    className="bg-white [&_.ql-toolbar]:rounded-t-lg [&_.ql-container]:rounded-b-none [&_.ql-editor]:rounded-b-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 px-3 py-2 bg-[#f8f9fa] border border-t-0 border-gray-300 rounded-b-lg max-w-2xl mx-auto">
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

            {/* Image Tooltip Popover */}
            {imageTooltip.visible && (
              <div
                className="image-tooltip-popover absolute z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-72"
                style={{
                  top: imageTooltip.top,
                  left: Math.max(0, imageTooltip.left - 144),
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-800">이미지 설정</span>
                  <button
                    type="button"
                    onClick={closeTooltip}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      SEO 텍스트 (Alt)
                    </label>
                    <input
                      type="text"
                      value={imageTooltip.alt}
                      onChange={(e) => handleTooltipAltChange(e.target.value)}
                      placeholder="이미지를 설명하는 텍스트"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      사진 설명 (Caption)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={imageTooltip.caption}
                        onChange={(e) => handleTooltipCaptionChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCaption(); } }}
                        placeholder="사진 아래에 표시될 설명"
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={applyCaption}
                        className="shrink-0 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        적용
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  캡션 입력 후 적용 버튼 또는 Enter를 눌러주세요.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Sidebar (Right) */}
      <div className="w-full lg:w-80 xl:w-96 shrink-0">
        <div className="lg:sticky lg:top-20 space-y-5">
          {/* Action Buttons */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
            >
              {saving ? "저장 중..." : isEdit ? "수정하기" : "등록하기"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
            >
              취소
            </button>
          </div>

          {/* Category */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">카테고리</h3>
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

          {/* Published At */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">발행 일시</h3>
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1.5">미래 시각을 선택하면 예약 발행됩니다.</p>
          </div>

          {/* Thumbnail */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">썸네일 이미지</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {thumbnailPreview && (
              <div className="mt-3 relative inline-block">
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

          {/* External URL */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">외부 링크</h3>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1.5">언론보도인 경우 기사 링크를 입력하세요.</p>
          </div>

          {/* SEO Settings */}
          <details className="bg-white border border-gray-200 rounded-xl">
            <summary className="px-4 py-3 text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-50 rounded-xl">
              SEO 설정
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug
                  <span className="ml-1 text-xs font-normal text-gray-400">SEO URL (예: minyo-bawoogi)</span>
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  maxLength={200}
                  placeholder="minyo-bawoogi"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Title
                  <span className="ml-1 text-xs font-normal text-gray-400">비우면 제목 사용</span>
                </label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  maxLength={100}
                  placeholder="검색결과에 표시될 제목 (권장 60자 이내)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Description
                  <span className="ml-1 text-xs font-normal text-gray-400">비우면 본문 사용</span>
                </label>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="검색결과에 표시될 설명 (권장 150자 이내)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </details>
        </div>
      </div>
    </form>
  );
}
