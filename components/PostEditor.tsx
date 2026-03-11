"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeHtml } from "@/lib/html-utils";
import { uploadBlogImage, normalizeImage } from "@/lib/upload-image";
import { toDatetimeLocalKST, parseDatetimeLocalAsKST } from "@/lib/date-utils";
import { getBlogPostPath } from "@/lib/blog-utils";
import TableEditor, { tableElToData, tableDataToHtml, type TableData } from "@/components/TableEditor";

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
  blur?: () => void;
};

const QUILL_MODULES = (imageHandler: () => void, videoHandler: () => void) => ({
  toolbar: {
    container: [
      [{ font: [false, "gowunDodum", "nanumMyeongjo"] }],
      [{ size: ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"] }],
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ align: [] }],
      ["link", "image", "video"],
      ["clean"],
    ],
    handlers: { image: imageHandler, video: videoHandler },
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
  "table-embed",
  "video-embed",
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
  const [tableMode, setTableMode] = useState(false);
  const [tableInitialData, setTableInitialData] = useState<TableData | null>(null);
  const [editingTableIndex, setEditingTableIndex] = useState<number | null>(null);
  const [floatingTableBar, setFloatingTableBar] = useState<{
    top: number;
    left: number;
    tableEl: HTMLElement;
    tableIndex: number;
  } | null>(null);
  const [videoPopup, setVideoPopup] = useState<{ url: string; visible: boolean }>({
    url: "",
    visible: false,
  });
  const [imageTooltip, setImageTooltip] = useState<ImageTooltipState>({
    visible: false, imgEl: null, alt: "", caption: "", top: 0, left: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<unknown>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipAltRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const floatingTableBarRef = useRef<HTMLDivElement>(null);
  const clipboardMatcherAdded = useRef(false);
  const savedCursorIndex = useRef<number | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const isEdit = !!editingPost;

  /**
   * DB에서 가져온 raw HTML 속의 <table>을 .ql-table-embed 래퍼로 감싸서
   * Quill이 TableEmbedBlot으로 인식하게 변환한다.
   * 이미 래퍼가 있는 표는 건드리지 않는다.
   */
  const preprocessContentForEditor = useCallback((html: string): string => {
    if (!html || typeof window === "undefined") return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const rawTables = [
      ...doc.querySelectorAll("table"),
    ].filter((t) => !t.closest(".ql-table-embed"));
    rawTables.forEach((table) => {
      const wrapper = doc.createElement("div");
      wrapper.className = "ql-table-embed";
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
    return doc.body.innerHTML;
  }, []);

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title);
      setPostCategory(
        BLOG_CATEGORIES.includes(editingPost.category as BlogCategory)
          ? (editingPost.category as BlogCategory)
          : "음악교실"
      );
      // DB 콘텐츠의 raw <table>을 ql-table-embed로 미리 변환 → Quill 삭제 방지
      setContent(preprocessContentForEditor(editingPost.content));
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
  }, [editingPost, preprocessContentForEditor]);

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

      // ── TableEmbedBlot: 표를 에디터 내에서 실제 격자로 렌더링 ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BlockEmbed = QuillCore.import("blots/block/embed") as any;
      class TableEmbedBlot extends BlockEmbed {
        static blotName = "table-embed";
        static tagName = "div";
        static className = "ql-table-embed";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static create(value: string): any {
          const node = super.create();
          node.setAttribute("contenteditable", "false");
          node.innerHTML = value;
          return node;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static value(node: any): string {
          return node.innerHTML ?? "";
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      QuillCore.register(TableEmbedBlot as any, true);

      // ── VideoEmbedBlot: YouTube/NaverTV iframe 임베드 ──
      class VideoEmbedBlot extends BlockEmbed {
        static blotName = "video-embed";
        static tagName = "div";
        static className = "ql-video-embed";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static create(value: string): any {
          const node = super.create();
          node.setAttribute("contenteditable", "false");
          node.setAttribute("data-embed-url", value);
          const iframe = document.createElement("iframe");
          iframe.setAttribute("src", value);
          iframe.setAttribute("frameborder", "0");
          iframe.setAttribute("allowfullscreen", "true");
          iframe.setAttribute(
            "allow",
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          );
          node.appendChild(iframe);
          return node;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static value(node: any): string {
          return (
            node.getAttribute("data-embed-url") ||
            node.querySelector("iframe")?.getAttribute("src") ||
            ""
          );
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      QuillCore.register(VideoEmbedBlot as any, true);

      // @ts-ignore
      await import("react-quill-new/dist/quill.snow.css");
      // @ts-ignore
      await import("quill-resize-module/dist/resize.css");

      setEditorReady(true);
    };
    init();
  }, []);

  // 에디터가 준비되면 현재 content의 raw <table>도 ql-table-embed로 변환
  // (editingPost 로딩이 init()보다 먼저 실행된 경우 대비)
  useEffect(() => {
    if (!editorReady) return;
    setContent((prev) => preprocessContentForEditor(prev));
  }, [editorReady, preprocessContentForEditor]);

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

  // Table click → floating toolbar
  useEffect(() => {
    if (!editorReady || sourceMode || tableMode) return;
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;

    function handleTableClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // 1순위: .ql-table-embed 래퍼 (새 방식)
      const embedEl = target.closest(".ql-table-embed");
      if (embedEl && embedEl.closest(".ql-editor")) {
        const allEmbeds = [
          ...wrapper!.querySelectorAll(".ql-editor .ql-table-embed"),
        ];
        const tableIndex = allEmbeds.indexOf(embedEl);
        const wrapperRect = wrapper!.getBoundingClientRect();
        const embedRect = embedEl.getBoundingClientRect();
        setFloatingTableBar({
          top: embedRect.top - wrapperRect.top - 44,
          left: embedRect.left - wrapperRect.left,
          tableEl: embedEl as HTMLElement,
          tableIndex,
        });
        e.stopPropagation();
        return;
      }
      // 2순위: 래퍼 없는 raw <table> (하위 호환)
      const tableEl = target.closest("table");
      if (tableEl && tableEl.closest(".ql-editor")) {
        const allTables = [
          ...wrapper!.querySelectorAll(".ql-editor table"),
        ].filter((t) => !t.closest(".ql-table-embed"));
        const tableIndex = allTables.indexOf(tableEl as HTMLTableElement);
        const wrapperRect = wrapper!.getBoundingClientRect();
        const tableRect = tableEl.getBoundingClientRect();
        setFloatingTableBar({
          top: tableRect.top - wrapperRect.top - 44,
          left: tableRect.left - wrapperRect.left,
          tableEl: tableEl as HTMLElement,
          tableIndex,
        });
        e.stopPropagation();
        return;
      }
      if (!target.closest(".floating-table-bar")) {
        setFloatingTableBar(null);
      }
    }

    wrapper.addEventListener("click", handleTableClick, true);
    return () => wrapper.removeEventListener("click", handleTableClick, true);
  }, [editorReady, sourceMode, tableMode]);

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
    const editor = (quillRef.current as { getEditor?: () => QuillEditor & { root?: HTMLElement; enable?: (v: boolean) => void } })?.getEditor?.();
    if (!editor?.root) return;

    // ★ v2.09 핵심: ReadOnly 상태에서 DOM 변경 시 Quill 인덱스 손상 방지
    // 에디터를 일시적으로 활성화한 뒤 DOM 수정 → 콘텐츠 동기화 → 다시 잠금
    editor.enable?.(true);

    const captionText = imageTooltip.caption.trim();

    // Find the <p> wrapping the image — re-verify image still exists in DOM
    const anchor = img.closest("p") || img;
    if (!editor.root.contains(anchor)) {
      // Image node was lost; abort safely
      editor.enable?.(false);
      setImageTooltip((prev) => ({ ...prev, visible: false, imgEl: null }));
      return;
    }

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
    // Ensure editor doesn't reclaim focus after tooltip closes
    editor.blur?.();
    // Close tooltip — useEffect will handle editor.enable(true) since visible becomes false
    setImageTooltip((prev) => ({ ...prev, visible: false, imgEl: null }));
  }, [imageTooltip.imgEl, imageTooltip.caption]);

  const closeTooltip = useCallback(() => {
    setImageTooltip((prev) => ({ ...prev, visible: false, imgEl: null }));
  }, []);

  // Editor ReadOnly lock: Quill의 네이티브 키보드 리스너를 원천 무력화
  useEffect(() => {
    if (!editorReady) return;
    const editor = (quillRef.current as { getEditor?: () => { enable?: (v: boolean) => void } })?.getEditor?.();
    if (!editor?.enable) return;
    if (imageTooltip.visible) {
      editor.enable(false);
    } else {
      editor.enable(true);
    }
  }, [imageTooltip.visible, editorReady]);

  // Native DOM event isolation: stopImmediatePropagation으로 Quill 네이티브 리스너 도달 차단
  useEffect(() => {
    const el = tooltipRef.current;
    if (!el || !imageTooltip.visible) return;
    const stop = (e: Event) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    el.addEventListener("keydown", stop, true);
    el.addEventListener("keypress", stop, true);
    el.addEventListener("keyup", stop, true);
    el.addEventListener("input", stop, true);
    return () => {
      el.removeEventListener("keydown", stop, true);
      el.removeEventListener("keypress", stop, true);
      el.removeEventListener("keyup", stop, true);
      el.removeEventListener("input", stop, true);
    };
  }, [imageTooltip.visible]);

  // Auto-focus: 툴팁 열릴 때 Alt input에 자동 포커스
  useEffect(() => {
    if (!imageTooltip.visible) return;
    const timer = setTimeout(() => {
      tooltipAltRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [imageTooltip.visible]);

  // Clipboard matchers:
  //  - IMG: base64 붙여넣기 차단
  //  - TABLE: table-embed 블롯으로 자동 변환 → Quill이 <table> 태그를 제거하지 못하게 방지
  useEffect(() => {
    if (!editorReady || clipboardMatcherAdded.current) return;
    const timer = setTimeout(() => {
      const editor = (
        quillRef.current as {
          getEditor?: () => {
            clipboard?: {
              addMatcher: (
                sel: string,
                fn: (node: Node, delta: unknown) => unknown
              ) => void;
            };
          };
        }
      )?.getEditor?.();
      const clipboard = editor?.clipboard;
      if (clipboard && !clipboardMatcherAdded.current) {
        clipboardMatcherAdded.current = true;
        import("quill").then(({ default: Quill }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Delta = Quill.import("delta") as any;
          // IMG: base64 차단
          clipboard.addMatcher("IMG", () => new Delta());
          // TABLE → table-embed 블롯으로 보존 (Quill 기본 sanitize 우회)
          clipboard.addMatcher("TABLE", (node: Node) => {
            const tableHtml = (node as HTMLElement).outerHTML;
            return new Delta([{ insert: { "table-embed": tableHtml } }]);
          });
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [editorReady]);

  const toggleSourceMode = useCallback(() => {
    if (sourceMode) {
      // 소스 → 에디터: raw <table>을 ql-table-embed로 변환 후 적용 (경고 없음)
      const sanitized = sanitizeHtml(sourceDraft);
      setContent(preprocessContentForEditor(sanitized));
      setSourceMode(false);
    } else {
      // 에디터 → 소스: content에는 이미 ql-table-embed 래퍼가 포함됨
      setSourceDraft(content);
      setSourceMode(true);
    }
  }, [sourceMode, sourceDraft, content, preprocessContentForEditor]);

  // Helper: content HTML에서 idx번째 표(ql-table-embed 래퍼 또는 raw table)를 newHtml로 교체
  // newHtml이 빈 문자열이면 해당 표를 제거
  const replaceTableInContent = useCallback(
    (currentContent: string, idx: number, newHtml: string): string => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(currentContent, "text/html");

      // 1순위: ql-table-embed 래퍼
      const embeds = doc.querySelectorAll("div.ql-table-embed");
      if (embeds.length > 0 && idx >= 0 && idx < embeds.length) {
        if (newHtml === "") {
          embeds[idx].remove();
        } else {
          embeds[idx].innerHTML = newHtml.trim();
        }
        return doc.body.innerHTML;
      }

      // 2순위: raw <table>
      const tables = doc.querySelectorAll("table");
      if (idx >= 0 && idx < tables.length) {
        if (newHtml === "") {
          tables[idx].remove();
        } else {
          const tpl = document.createElement("template");
          tpl.innerHTML = `<div class="ql-table-embed">${newHtml.trim()}</div>`;
          const newEl = tpl.content.firstElementChild;
          if (newEl) tables[idx].replaceWith(newEl);
        }
      }
      return doc.body.innerHTML;
    },
    []
  );

  // TableEditor에서 "에디터에 삽입" 클릭 시
  const handleTableInsert = useCallback(
    (html: string) => {
      const quill = (
        quillRef.current as { getEditor?: () => QuillEditor } | null
      )?.getEditor?.();

      if (editingTableIndex !== null) {
        // 기존 표 교체: content 문자열의 해당 인덱스 표를 업데이트
        const newContent = replaceTableInContent(
          content,
          editingTableIndex,
          html
        );
        setContent(newContent);
      } else if (quill) {
        // 새 표: 저장된 커서 위치 우선 사용 (tableMode 진입 시 blur로 getSelection()이 null이 되기 때문)
        const idx = savedCursorIndex.current ?? quill.getLength() - 1;
        quill.insertEmbed(idx, "table-embed", html, "user");
        quill.setSelection(idx + 1, 0);
        savedCursorIndex.current = null;
      } else {
        // Fallback: 소스 모드로 추가
        const newContent = content + html;
        setContent(newContent);
        setSourceDraft(newContent);
        setSourceMode(true);
      }

      setTableMode(false);
      setTableInitialData(null);
      setEditingTableIndex(null);
    },
    [content, editingTableIndex, replaceTableInContent]
  );

  const handleTableCancel = useCallback(() => {
    setTableMode(false);
    setTableInitialData(null);
    setEditingTableIndex(null);
  }, []);

  // "표 삽입" 버튼 → TableEditor 열기 (새 표)
  // 커서 위치를 미리 저장: tableMode 진입 시 에디터가 blur되어 getSelection()이 null 반환하기 때문
  const handleInsertTable = useCallback(() => {
    const quill = (quillRef.current as { getEditor?: () => QuillEditor } | null)?.getEditor?.();
    savedCursorIndex.current = quill?.getSelection(false)?.index ?? null;
    setTableInitialData(null);
    setEditingTableIndex(null);
    setTableMode(true);
  }, []);

  // 플로팅 툴바 조작 helpers
  const applyTableOp = useCallback(
    (op: "addRow" | "addCol" | "delRow" | "delCol" | "del") => {
      if (!floatingTableBar) return;
      const { tableEl, tableIndex } = floatingTableBar;

      // tableEl이 .ql-table-embed 래퍼면 내부 <table>을 추출
      const isWrapper = tableEl.classList.contains("ql-table-embed");
      const innerTable = isWrapper
        ? (tableEl.querySelector("table") as HTMLTableElement | null)
        : (tableEl as HTMLTableElement);

      let newContent = content;

      if (op === "del") {
        newContent = replaceTableInContent(content, tableIndex, "");
      } else if (!innerTable) {
        // 내부 테이블 없음 → no-op
      } else if (op === "addRow") {
        const tbody = innerTable.querySelector("tbody") || innerTable;
        const lastRow = tbody.querySelector("tr:last-child");
        const colCount =
          lastRow?.querySelectorAll("td, th").length ??
          innerTable.rows[0]?.cells.length ??
          1;
        const newRow = document.createElement("tr");
        for (let i = 0; i < colCount; i++) {
          const td = document.createElement("td");
          td.textContent = "내용";
          newRow.appendChild(td);
        }
        tbody.appendChild(newRow);
        newContent = replaceTableInContent(
          content,
          tableIndex,
          innerTable.outerHTML
        );
      } else if (op === "addCol") {
        innerTable.querySelectorAll("tr").forEach((tr, ri) => {
          const cell =
            ri === 0
              ? document.createElement("th")
              : document.createElement("td");
          cell.textContent =
            ri === 0 ? `열 ${tr.cells.length + 1}` : "내용";
          tr.appendChild(cell);
        });
        newContent = replaceTableInContent(
          content,
          tableIndex,
          innerTable.outerHTML
        );
      } else if (op === "delRow") {
        const tbody = innerTable.querySelector("tbody");
        const lastRow = tbody?.querySelector("tr:last-child");
        if (lastRow && tbody && tbody.querySelectorAll("tr").length > 1) {
          lastRow.remove();
          newContent = replaceTableInContent(
            content,
            tableIndex,
            innerTable.outerHTML
          );
        }
      } else if (op === "delCol") {
        const maxCols = Math.max(
          ...[...innerTable.rows].map((r) => r.cells.length)
        );
        if (maxCols > 1) {
          innerTable.querySelectorAll("tr").forEach((tr) => {
            if (tr.cells.length > 0) tr.deleteCell(tr.cells.length - 1);
          });
          newContent = replaceTableInContent(
            content,
            tableIndex,
            innerTable.outerHTML
          );
        }
      }

      setContent(newContent);
      setFloatingTableBar(null);
    },
    [floatingTableBar, content, replaceTableInContent]
  );

  // 플로팅 툴바 "편집" → TableEditor로 열기
  const handleEditFromToolbar = useCallback(() => {
    if (!floatingTableBar) return;
    const { tableEl, tableIndex } = floatingTableBar;
    // .ql-table-embed 래퍼면 내부 <table>을 사용
    const innerTableEl = tableEl.classList.contains("ql-table-embed")
      ? tableEl.querySelector("table")
      : tableEl;
    const data = innerTableEl
      ? tableElToData(innerTableEl as HTMLTableElement)
      : null;
    setTableInitialData(data);
    setEditingTableIndex(tableIndex);
    setFloatingTableBar(null);
    setTableMode(true);
  }, [floatingTableBar]);

  // YouTube / 네이버TV URL → embed URL 변환
  function toEmbedUrl(url: string): string | null {
    const s = url.trim();
    // YouTube watch
    const ytId = s.match(
      /(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    )?.[1];
    if (ytId) return `https://www.youtube.com/embed/${ytId}`;
    // YouTube Shorts
    const ytShort = s.match(
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    )?.[1];
    if (ytShort) return `https://www.youtube.com/embed/${ytShort}`;
    // YouTube embed (이미 변환됨)
    if (/youtube\.com\/embed\//.test(s)) return s;
    // 네이버TV
    const naverTV = s.match(/tv\.naver\.com\/v\/(\d+)/)?.[1];
    if (naverTV) return `https://tv.naver.com/embed/${naverTV[1]}`;
    // 네이버TV embed (이미 변환됨)
    if (/tv\.naver\.com\/embed\//.test(s)) return s;
    return null;
  }

  const videoHandler = useCallback(() => {
    setVideoPopup({ url: "", visible: true });
  }, []);

  const handleVideoInsert = useCallback(() => {
    const embedUrl = toEmbedUrl(videoPopup.url);
    if (!embedUrl) {
      alert(
        "지원하지 않는 URL 형식입니다.\nYouTube 또는 네이버TV URL을 입력해 주세요.\n\n예시:\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ"
      );
      return;
    }
    const quill = (
      quillRef.current as { getEditor?: () => QuillEditor } | null
    )?.getEditor?.();
    if (quill) {
      const range = quill.getSelection(true) ?? {
        index: quill.getLength() - 1,
        length: 0,
      };
      quill.insertEmbed(range.index, "video-embed", embedUrl, "user");
      quill.setSelection(range.index + 1, 0);
    }
    setVideoPopup({ url: "", visible: false });
  }, [videoPopup.url]);

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

  const modules = useMemo(
    () => QUILL_MODULES(imageHandler, videoHandler),
    [imageHandler, videoHandler]
  );

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

      // IndexNow: 실제 발행된 글만 검색엔진에 핑 (예약/미래 발행 글 제외)
      if (publishedAtValue && new Date(publishedAtValue) <= new Date()) {
        fetch(`/api/indexnow?path=${encodeURIComponent(postPath)}`).catch(() => {});
      }

      router.replace("/admin/posts/manage");
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
    router.replace("/admin/posts/manage");
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
            ) : tableMode ? (
              /* ── TableEditor Mode ── */
              <div className="flex flex-col gap-3 py-2">
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <span>⊞</span>
                  <span>
                    {editingTableIndex !== null
                      ? `표 ${editingTableIndex + 1} 편집 중`
                      : "새 표 만들기"}
                  </span>
                  <span className="ml-auto text-xs text-blue-500">
                    내용을 채우고 &apos;에디터에 삽입&apos;을 누르세요
                  </span>
                </div>
                <TableEditor
                  initialData={tableInitialData}
                  onInsert={handleTableInsert}
                  onCancel={handleTableCancel}
                />
              </div>
            ) : sourceMode ? (
              <>
                <textarea
                  ref={textareaRef}
                  value={sourceDraft}
                  onChange={(e) => setSourceDraft(e.target.value)}
                  className="w-full min-h-[500px] p-4 font-mono text-sm border border-gray-300 rounded-t-lg bg-[#23241f] text-[#f8f8f2] resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="HTML 코드를 직접 입력하세요. <style> 태그도 사용 가능합니다."
                  spellCheck={false}
                />
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#f8f9fa] border border-t-0 border-gray-300 rounded-b-lg">
                  <button
                    type="button"
                    onClick={handleInsertTable}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="표(테이블) 삽입 — HTML 커서 위치에 삽입"
                  >
                    <span>⊞</span>
                    표 삽입
                  </button>
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
                {/* 표 감지됨 배너 */}
                {(/<table[\s>]/i.test(content) ||
                  /ql-table-embed/.test(content)) && (
                  <div className="mx-auto max-w-2xl mb-1 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <span>⊞</span>
                    <span>
                      표가 포함되어 있습니다. 에디터에서 직접 보이지 않을 수
                      있습니다.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(content, "text/html");
                        const embed = doc.querySelector("div.ql-table-embed");
                        const rawTable = doc.querySelector("table");
                        const tEl = (embed?.querySelector("table") ?? rawTable) as HTMLTableElement | null;
                        setTableInitialData(tEl ? tableElToData(tEl) : null);
                        setEditingTableIndex(0);
                        setTableMode(true);
                      }}
                      className="ml-auto px-2 py-1 bg-amber-100 hover:bg-amber-200 rounded font-medium transition-colors"
                    >
                      표 편집
                    </button>
                  </div>
                )}

                {/* 플로팅 테이블 툴바 */}
                {floatingTableBar && (
                  <div
                    ref={floatingTableBarRef}
                    className="floating-table-bar absolute z-20 flex items-center gap-1 px-2 py-1.5 bg-white border border-blue-200 rounded-lg shadow-lg text-xs"
                    style={{
                      top: Math.max(0, floatingTableBar.top),
                      left: floatingTableBar.left,
                    }}
                  >
                    <span className="text-blue-600 font-semibold mr-1">⊞ 표</span>
                    {(
                      [
                        { label: "편집", op: "edit" as const, color: "blue" },
                        { label: "+ 행", op: "addRow" as const, color: "gray" },
                        { label: "+ 열", op: "addCol" as const, color: "gray" },
                        { label: "행 삭제", op: "delRow" as const, color: "red" },
                        { label: "열 삭제", op: "delCol" as const, color: "red" },
                        { label: "표 삭제", op: "del" as const, color: "red" },
                      ] as const
                    ).map(({ label, op, color }) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() =>
                          op === "edit"
                            ? handleEditFromToolbar()
                            : applyTableOp(op)
                        }
                        className={`px-2 py-1 rounded border font-medium transition-colors ${
                          color === "blue"
                            ? "border-blue-300 text-blue-700 hover:bg-blue-50"
                            : color === "red"
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFloatingTableBar(null)}
                      className="ml-1 px-1.5 py-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="닫기"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="mx-auto max-w-2xl">
                  <ReactQuill
                    {...({ ref: quillRef } as object)}
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    readOnly={imageTooltip.visible}
                    modules={modules}
                    formats={QUILL_FORMATS}
                    placeholder="내용을 입력하세요. 이미지는 드래그 앤 드롭 또는 이미지 버튼으로 추가할 수 있습니다."
                    className="bg-white [&_.ql-toolbar]:rounded-t-lg [&_.ql-container]:rounded-b-none [&_.ql-editor]:rounded-b-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#f8f9fa] border border-t-0 border-gray-300 rounded-b-lg max-w-2xl mx-auto">
                  <button
                    type="button"
                    onClick={handleInsertTable}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="표(테이블) 삽입 — HTML 소스 모드로 전환 후 표 삽입"
                  >
                    <span>⊞</span>
                    표 삽입
                  </button>
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

            {/* 동영상 삽입 팝업 */}
            {videoPopup.visible && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                onClick={() => setVideoPopup({ url: "", visible: false })}
              >
                <div
                  className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-base font-semibold text-gray-900 mb-4">
                    🎬 동영상 삽입
                  </h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      동영상 URL
                    </label>
                    <input
                      type="url"
                      value={videoPopup.url}
                      onChange={(e) =>
                        setVideoPopup((prev) => ({
                          ...prev,
                          url: e.target.value,
                        }))
                      }
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleVideoInsert();
                        if (e.key === "Escape")
                          setVideoPopup({ url: "", visible: false });
                      }}
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      YouTube (watch / shorts / youtu.be), 네이버TV URL을
                      지원합니다.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setVideoPopup({ url: "", visible: false })}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleVideoInsert}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      삽입
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Image Tooltip Popover — Triple isolation:
                1. Editor ReadOnly lock (readOnly={imageTooltip.visible}) disables Quill's keyboard module entirely
                2. Native DOM addEventListener with stopImmediatePropagation (tooltipRef useEffect)
                3. onMouseDownCapture to prevent click-through to editor
                React Synthetic onKeyDownCapture alone was insufficient because Quill
                attaches native DOM listeners that fire before React's event system. */}
            {imageTooltip.visible && (
              <div
                ref={tooltipRef}
                className="image-tooltip-popover absolute z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-72"
                style={{
                  top: imageTooltip.top,
                  left: Math.max(0, imageTooltip.left - 144),
                }}
                /* Native event isolation is handled via tooltipRef useEffect
                   (stopImmediatePropagation at capture phase on the real DOM).
                   Editor is also locked via readOnly={imageTooltip.visible}. */
                onMouseDownCapture={(e) => {
                  e.stopPropagation();
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
                      ref={tooltipAltRef}
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyCaption();
                          }
                        }}
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
