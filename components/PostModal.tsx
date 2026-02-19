"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import "quill-resize-module/dist/resize.css";

const SizeStyle = Quill.import("attributors/style/size");
(SizeStyle as { whitelist: string[] }).whitelist = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Quill.register(SizeStyle as any, true);

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <p>에디터 로딩중...</p>,
});

const BUCKET = "public-media";
const BLOG_CONTENT_PATH = "blog-content";
const DEFAULT_CATEGORY = "소식";

const FONT_WHITELIST = ["pretendard", "notosans", "nanummyeongjo", "mapoaemin", "kyobohand", "jalnan"];

const QUILL_MODULES = (imageHandler: () => void) => ({
  toolbar: {
    container: [
      [{ font: ["", ...FONT_WHITELIST] }],
      [{ size: ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"] }],
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic"],
      [{ align: [] }],
      ["image"],
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

const QUILL_FORMATS = ["font", "size", "header", "bold", "italic", "align", "image", "resize-inline", "resize-block"];

export type PostForEdit = {
  id: string;
  title: string;
  content: string;
  thumbnail_url: string | null;
  external_url: string | null;
};

type Props = {
  editingPost: PostForEdit | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function PostModal({ editingPost, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quillRef = useRef<unknown>(null);
  const supabase = createClient();

  const isEdit = !!editingPost;

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title);
      setContent(editingPost.content);
      setExternalUrl(editingPost.external_url || "");
      setThumbnailPreview(editingPost.thumbnail_url);
    } else {
      setTitle("");
      setContent("");
      setExternalUrl("");
      setThumbnailFile(null);
      setThumbnailPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [editingPost]);

  const uploadImageAndInsert = useCallback(async (file: File) => {
    const editor = (quillRef.current as { getEditor?: () => { getSelection: (x: boolean) => { index: number; length: number } | null; getLength: () => number; insertEmbed: (i: number, t: string, u: string, s: string) => void; setSelection: (i: number, l: number) => void } })?.getEditor?.();
    if (!editor) return;
    const range = editor.getSelection(true) ?? { index: editor.getLength(), length: 0 };
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${BLOG_CONTENT_PATH}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) {
      alert(`이미지 업로드 실패: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    editor.insertEmbed(range.index, "image", data.publicUrl, "user");
    editor.setSelection(range.index + 1, 0);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const Quill = (await import("quill")).default;
      const QuillResize = (await import("quill-resize-module")).default;
      Quill.register("modules/resize", QuillResize);
      const Font = Quill.import("formats/font");
      (Font as { whitelist: string[] }).whitelist = FONT_WHITELIST;
      Quill.register("formats/font", Font, true);
      setEditorReady(true);
    };
    init();
  }, []);

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) await uploadImageAndInsert(file);
    };
  }, [uploadImageAndInsert]);

  const handleEditorDrop = useCallback(async (e: React.DragEvent) => {
    const file = e.dataTransfer?.files?.[0];
    if (file?.type.startsWith("image/")) {
      e.preventDefault();
      e.stopPropagation();
      await uploadImageAndInsert(file);
    }
  }, [uploadImageAndInsert]);

  const modules = QUILL_MODULES(imageHandler);

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
        const ext = thumbnailFile.name.split(".").pop() || "jpg";
        const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, thumbnailFile, { upsert: true });
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
      const payload = {
        title: title.trim(),
        content: content.trim(),
        category: DEFAULT_CATEGORY,
        tag: DEFAULT_CATEGORY,
        thumbnail_url: thumbnailUrl,
        external_url: externalUrl.trim() || null,
        author_id: user?.id ?? null,
      };

      if (isEdit && editingPost) {
        const { error } = await supabase
          .from("posts")
          .update(payload)
          .eq("id", editingPost.id)
          .eq("category", DEFAULT_CATEGORY);

        if (error) throw new Error(error.message);
        alert("✅ 게시글이 수정되었습니다.");
      } else {
        const { error } = await supabase.from("posts").insert(payload);
        if (error) throw new Error(error.message);
        alert("✅ 게시글이 등록되었습니다.");
      }

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
              <label className="block text-sm font-medium text-gray-700 mb-1">내용 *</label>
              <div
                className="quill-editor-wrapper [&_.ql-container]:min-h-[400px] [&_.ql-editor]:min-h-[380px]"
                onDrop={handleEditorDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {!editorReady ? (
                  <div className="min-h-[400px] flex items-center justify-center border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    에디터 로딩 중...
                  </div>
                ) : (
                  <ReactQuill
                    {...({ ref: quillRef } as object)}
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    modules={modules}
                    formats={QUILL_FORMATS}
                    placeholder="내용을 입력하세요. 이미지는 드래그 앤 드롭 또는 이미지 버튼으로 추가할 수 있습니다."
                    className="[&_.ql-toolbar]:rounded-t-lg [&_.ql-container]:rounded-b-lg [&_.ql-editor]:rounded-b-lg"
                  />
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
