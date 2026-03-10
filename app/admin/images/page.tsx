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

export default function AdminImagesPage() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [storedImages, setStoredImages] = useState<{ name: string; url: string }[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadStoredImages();
  }, []);

  async function loadStoredImages() {
    try {
      const { data, error } = await supabase.storage
        .from("images")
        .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });

      if (error) throw error;

      const images = (data || [])
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from("images").getPublicUrl(f.name).data.publicUrl,
        }));

      setStoredImages(images);
    } catch (error) {
      console.error("Error loading images:", error);
    } finally {
      setLoadingImages(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newUploads: UploadItem[] = Array.from(files).map((file) => ({
      file,
      name: file.name,
      status: "pending" as const,
      preview: URL.createObjectURL(file),
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Reset input so same files can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Start processing (capture caption/category at click time)
    processUploads(newUploads, caption, category);
  }

  async function processUploads(items: UploadItem[], captionVal: string, categoryVal: string) {
    for (const item of items) {
      await processOneUpload(item, captionVal, categoryVal);
    }
  }

  async function processOneUpload(item: UploadItem, captionVal: string, categoryVal: string) {
    const updateItem = (extra: Partial<UploadItem>) => {
      setUploads((prev) =>
        prev.map((u) =>
          u.preview === item.preview ? { ...u, ...extra } : u
        )
      );
    };

    try {
      // 1. Compress & convert to WebP
      updateItem({ status: "compressing" });

      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/webp" as const,
      };

      const compressedFile = await imageCompression(item.file, options);

      // 2. Generate unique filename
      const timestamp = Date.now();
      const baseName = item.name.replace(/\.[^/.]+$/, "");
      const fileName = `${baseName}_${timestamp}.webp`;

      // 3. Upload to Supabase Storage
      updateItem({ status: "uploading" });

      const { error: storageError } = await supabase.storage
        .from("images")
        .upload(fileName, compressedFile, {
          contentType: "image/webp",
          upsert: false,
        });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 4. Insert into gallery DB table
      const insertPayload: Record<string, string> = { image_url: publicUrl };
      if (captionVal.trim()) insertPayload.caption = captionVal.trim();
      if (categoryVal.trim()) insertPayload.category = categoryVal.trim();

      console.log("[gallery insert] payload:", insertPayload);

      const { data: dbData, error: dbError } = await supabase
        .from("gallery")
        .insert(insertPayload)
        .select()
        .single();

      if (dbError) {
        console.error("[gallery insert] DB 저장 실패 ❌", {
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          payload: insertPayload,
        });
        updateItem({ status: "done", url: publicUrl, dbSaved: false, dbError: dbError.message });
      } else {
        console.log("[gallery insert] DB 저장 성공 ✅", dbData);
        updateItem({ status: "done", url: publicUrl, dbSaved: true });
      }

      // Add to stored images list
      setStoredImages((prev) => [
        { name: fileName, url: publicUrl },
        ...prev,
      ]);
    } catch (error: any) {
      console.error("[upload] Storage 업로드 실패:", error);
      updateItem({ status: "error", error: error.message || "업로드 실패" });
    }
  }

  function removeUploadItem(preview: string) {
    setUploads((prev) => {
      const item = prev.find((u) => u.preview === preview);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((u) => u.preview !== preview);
    });
  }

  async function handleDeleteImage(name: string) {
    if (!confirm(`"${name}" 이미지를 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase.storage.from("images").remove([name]);
      if (error) throw error;
      setStoredImages((prev) => prev.filter((img) => img.name !== name));
    } catch (error) {
      console.error("Delete error:", error);
      alert("이미지 삭제 중 오류가 발생했습니다.");
    }
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
              설명 (caption) <span className="text-gray-400 font-normal">선택</span>
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="예: 2025 김포예술제 공연"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리 (category) <span className="text-gray-400 font-normal">선택</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="예: 공연, 수업, 행사"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="image-upload"
        />
        <label
          htmlFor="image-upload"
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
        >
          <div className="text-5xl mb-3">📷</div>
          <p className="text-lg font-medium text-gray-700">
            클릭하여 사진 선택
          </p>
          <p className="text-sm text-gray-500 mt-1">
            여러 장을 한 번에 선택할 수 있습니다 (자동 WebP 변환, 갤러리 DB 자동 저장)
          </p>
        </label>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">업로드 현황</h2>
            {pendingCount > 0 && (
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

      {/* Stored Images Gallery */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          저장된 이미지 ({storedImages.length})
        </h2>
        {loadingImages ? (
          <p className="text-center text-gray-500 py-8">로딩 중...</p>
        ) : storedImages.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            저장된 이미지가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {storedImages.map((img) => (
              <div
                key={img.name}
                className="relative group rounded-lg overflow-hidden border border-gray-200"
              >
                <div className="aspect-square relative">
                  <Image
                    src={img.url}
                    alt={img.name}
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
                      onClick={() => handleCopyUrl(img.url)}
                      className="flex-1 bg-white text-gray-700 text-xs py-1.5 rounded hover:bg-gray-100 transition-colors font-medium"
                    >
                      URL 복사
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.name)}
                      className="bg-red-600 text-white text-xs px-2 py-1.5 rounded hover:bg-red-700 transition-colors font-medium"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                {/* File name */}
                <div className="p-1.5">
                  <p className="text-xs text-gray-500 truncate" title={img.name}>
                    {img.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
