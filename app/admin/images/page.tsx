"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import imageCompression from "browser-image-compression";
import Image from "next/image";

type UploadItem = {
  file: File;
  name: string;
  status: "pending" | "compressing" | "uploading" | "done" | "error";
  preview?: string;
  error?: string;
  url?: string;
  dbSaved?: boolean;
  dbError?: string;
};

type GalleryItem = {
  id: string;
  image_url: string;
  caption?: string;
  category?: string;
  created_at: string;
  storageName: string; // URL에서 추출한 파일명
};

function extractStorageName(imageUrl: string): string {
  try {
    return new URL(imageUrl).pathname.split("/").pop() ?? imageUrl;
  } catch {
    return imageUrl.split("/").pop() ?? imageUrl;
  }
}

export default function AdminImagesPage() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("");
  // 업로드 진행 중 여부 — 중복 업로드 방지
  const isUploadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadGalleryItems();
  }, []);

  /** gallery DB 테이블에서 최신 데이터를 불러와 화면 갱신 */
  async function loadGalleryItems() {
    setLoadingImages(true);
    try {
      const { data, error } = await supabase
        .from("gallery")
        .select("id, image_url, caption, category, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const items: GalleryItem[] = (data ?? []).map((row) => ({
        id: row.id,
        image_url: row.image_url,
        caption: row.caption,
        category: row.category,
        created_at: row.created_at,
        storageName: extractStorageName(row.image_url),
      }));

      setGalleryItems(items);
    } catch (error) {
      console.error("갤러리 로드 오류:", error);
    } finally {
      setLoadingImages(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 이미 업로드 중이면 무시 (중복 업로드 방지)
    if (isUploadingRef.current) return;

    const newUploads: UploadItem[] = Array.from(files).map((file) => ({
      file,
      name: file.name,
      status: "pending" as const,
      preview: URL.createObjectURL(file),
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // 같은 파일 재선택 가능하도록 input 초기화
    if (fileInputRef.current) fileInputRef.current.value = "";

    // caption/category는 클릭 시점의 값을 캡처해서 넘김
    processUploads(newUploads, caption, category);
  }

  async function processUploads(
    items: UploadItem[],
    captionVal: string,
    categoryVal: string
  ) {
    isUploadingRef.current = true;
    try {
      for (const item of items) {
        await processOneUpload(item, captionVal, categoryVal);
      }
    } finally {
      isUploadingRef.current = false;
      // 업로드 완료 후 DB에서 최신 데이터 재조회
      await loadGalleryItems();
    }
  }

  async function processOneUpload(
    item: UploadItem,
    captionVal: string,
    categoryVal: string
  ) {
    const updateItem = (extra: Partial<UploadItem>) => {
      setUploads((prev) =>
        prev.map((u) =>
          u.preview === item.preview ? { ...u, ...extra } : u
        )
      );
    };

    try {
      // 1. WebP 압축
      updateItem({ status: "compressing" });

      const compressedFile = await imageCompression(item.file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/webp" as const,
      });

      // 2. 고유 파일명 생성
      const baseName = item.name.replace(/\.[^/.]+$/, "");
      const fileName = `${baseName}_${Date.now()}.webp`;

      // 3. Storage 업로드
      updateItem({ status: "uploading" });

      const { error: storageError } = await supabase.storage
        .from("images")
        .upload(fileName, compressedFile, {
          contentType: "image/webp",
          upsert: false, // 동일 파일명 덮어쓰기 금지
        });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 4. gallery DB에 중복 체크 후 insert
      const { data: existing } = await supabase
        .from("gallery")
        .select("id")
        .eq("image_url", publicUrl)
        .maybeSingle();

      if (existing) {
        // 이미 DB에 있으면 insert 건너뜀 (Storage 업로드는 위에서 완료됨)
        console.warn("[gallery insert] 이미 DB에 존재, insert 건너뜀:", publicUrl);
        updateItem({ status: "done", url: publicUrl, dbSaved: true });
        return;
      }

      const insertPayload: Record<string, string> = { image_url: publicUrl };
      if (captionVal.trim()) insertPayload.caption = captionVal.trim();
      if (categoryVal.trim()) insertPayload.category = categoryVal.trim();

      const { data: dbData, error: dbError } = await supabase
        .from("gallery")
        .insert(insertPayload)
        .select()
        .single();

      if (dbError) {
        console.error("[gallery insert] DB 저장 실패", dbError);
        updateItem({
          status: "done",
          url: publicUrl,
          dbSaved: false,
          dbError: dbError.message,
        });
        alert(
          `⚠️ "${item.name}" Storage 업로드는 완료됐지만 DB 저장에 실패했습니다.\n${dbError.message}`
        );
      } else {
        console.log("[gallery insert] DB 저장 성공", dbData);
        updateItem({ status: "done", url: publicUrl, dbSaved: true });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "업로드 실패";
      console.error("[upload] 실패:", error);
      updateItem({ status: "error", error: msg });
    }
  }

  function removeUploadItem(preview: string) {
    setUploads((prev) => {
      const item = prev.find((u) => u.preview === preview);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((u) => u.preview !== preview);
    });
  }

  /** Storage 파일 + gallery DB 행 동시 삭제 */
  async function handleDeleteImage(item: GalleryItem) {
    if (!confirm(`"${item.storageName}" 이미지를 삭제하시겠습니까?`)) return;

    const errors: string[] = [];

    // 1. Storage 삭제
    const { error: storageError } = await supabase.storage
      .from("images")
      .remove([item.storageName]);
    if (storageError) {
      errors.push(`Storage 삭제 실패: ${storageError.message}`);
    }

    // 2. DB 행 삭제
    const { error: dbError } = await supabase
      .from("gallery")
      .delete()
      .eq("id", item.id);
    if (dbError) {
      errors.push(`DB 삭제 실패: ${dbError.message}`);
    }

    if (errors.length > 0) {
      alert(`삭제 중 오류가 발생했습니다:\n${errors.join("\n")}`);
    }

    // 성공 여부와 관계없이 DB 기준으로 화면 갱신
    await loadGalleryItems();
  }

  async function handleCopyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      alert("URL이 클립보드에 복사되었습니다.");
    } catch {
      alert("URL 복사에 실패했습니다.");
    }
  }

  const pendingCount = uploads.filter(
    (u) => u.status !== "done" && u.status !== "error"
  ).length;

  const isUploading = pendingCount > 0;

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">이미지 관리</h1>
        <p className="text-gray-600">
          이미지를 업로드하면 자동으로 WebP로 변환 및 최적화됩니다.
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        {/* Caption / Category inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명 (caption){" "}
              <span className="text-gray-400 font-normal">선택</span>
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isUploading}
              placeholder="예: 2025 김포예술제 공연"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리 (category){" "}
              <span className="text-gray-400 font-normal">선택</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isUploading}
              placeholder="예: 공연, 수업, 행사"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id="image-upload"
        />
        <label
          htmlFor={isUploading ? undefined : "image-upload"}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 transition-colors ${
            isUploading
              ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
              : "border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50"
          }`}
        >
          <div className="text-5xl mb-3">{isUploading ? "⏳" : "📷"}</div>
          <p className="text-lg font-medium text-gray-700">
            {isUploading ? "업로드 중... 잠시 기다려주세요" : "클릭하여 사진 선택"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            여러 장을 한 번에 선택할 수 있습니다 (자동 WebP 변환, 갤러리 DB 자동
            저장)
          </p>
        </label>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">업로드 현황</h2>
            {isUploading && (
              <span className="text-sm text-blue-600 font-medium">
                {pendingCount}개 처리 중...
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {uploads.map((item) => (
              <div
                key={item.preview}
                className="relative group rounded-lg overflow-hidden border border-gray-200"
              >
                {item.preview && (
                  <div className="aspect-square relative">
                    <Image
                      src={item.preview}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  </div>
                )}
                {/* Status overlay */}
                <div
                  className={`absolute inset-0 flex items-center justify-center ${
                    item.status === "done"
                      ? "bg-green-500/20"
                      : item.status === "error"
                      ? "bg-red-500/20"
                      : "bg-black/30"
                  }`}
                >
                  {item.status === "compressing" && (
                    <span className="bg-white/90 text-gray-700 text-xs px-2 py-1 rounded font-medium">
                      변환 중...
                    </span>
                  )}
                  {item.status === "uploading" && (
                    <span className="bg-white/90 text-blue-600 text-xs px-2 py-1 rounded font-medium">
                      업로드 중...
                    </span>
                  )}
                  {item.status === "done" && (
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded font-medium">
                      완료
                    </span>
                  )}
                  {item.status === "error" && (
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-medium">
                      실패
                    </span>
                  )}
                  {item.status === "pending" && (
                    <span className="bg-white/90 text-gray-500 text-xs px-2 py-1 rounded font-medium">
                      대기
                    </span>
                  )}
                </div>
                {/* DB save status badge */}
                {item.status === "done" && (
                  <div className="absolute bottom-1 left-1">
                    {item.dbSaved === true && (
                      <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        DB ✓
                      </span>
                    )}
                    {item.dbSaved === false && (
                      <span
                        className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium cursor-help"
                        title={item.dbError}
                      >
                        DB 실패
                      </span>
                    )}
                  </div>
                )}
                {/* Remove button */}
                {(item.status === "done" || item.status === "error") && (
                  <button
                    type="button"
                    onClick={() => removeUploadItem(item.preview!)}
                    className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full text-xs hover:bg-black/80 transition-colors"
                    aria-label="제거"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gallery from DB */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            갤러리 ({galleryItems.length})
          </h2>
          <button
            type="button"
            onClick={loadGalleryItems}
            disabled={loadingImages}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            새로고침
          </button>
        </div>
        {loadingImages ? (
          <p className="text-center text-gray-500 py-8">로딩 중...</p>
        ) : galleryItems.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            저장된 이미지가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {galleryItems.map((item) => (
              <div
                key={item.id}
                className="relative group rounded-lg overflow-hidden border border-gray-200"
              >
                <div className="aspect-square relative">
                  <Image
                    src={item.image_url}
                    alt={item.caption ?? item.storageName}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                </div>
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-1 p-2 w-full">
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(item.image_url)}
                      className="flex-1 bg-white text-gray-700 text-xs py-1.5 rounded hover:bg-gray-100 transition-colors font-medium"
                    >
                      URL 복사
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(item)}
                      className="bg-red-600 text-white text-xs px-2 py-1.5 rounded hover:bg-red-700 transition-colors font-medium"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                {/* Caption / filename */}
                <div className="p-1.5">
                  <p
                    className="text-xs text-gray-500 truncate"
                    title={item.caption ?? item.storageName}
                  >
                    {item.caption ?? item.storageName}
                  </p>
                  {item.category && (
                    <p className="text-[10px] text-blue-500 truncate">
                      {item.category}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
