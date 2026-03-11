"use client";

export const dynamic = "force-dynamic";

import { Fragment, useEffect, useRef, useState } from "react";
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
  storageName: string;
};

// 마스터 카테고리 목록: 갤러리 필터 버튼(activities 페이지)과 반드시 동일하게 유지하세요.
const MASTER_CATEGORIES = ["공연", "체험", "수업"] as const;

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

  // 다중 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingMultiple, setDeletingMultiple] = useState(false);

  // 일괄 수정 (Bulk Edit)
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditCaption, setBulkEditCaption] = useState("");
  const [bulkEditCategory, setBulkEditCategory] = useState("");
  const [bulkApplyCaption, setBulkApplyCaption] = useState(false);
  const [bulkApplyCategory, setBulkApplyCategory] = useState(true);
  const [bulkSaving, setBulkSaving] = useState(false);

  // 사후 편집
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // 목록 필터
  const [listFilter, setListFilter] = useState<string>("전체");

  const isUploadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadGalleryItems();
  }, []);

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

  // 현재 필터 기준 목록
  const filteredItems =
    listFilter === "전체"
      ? galleryItems
      : galleryItems.filter((item) => item.category === listFilter);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (isUploadingRef.current) return;

    const newUploads: UploadItem[] = Array.from(files).map((file) => ({
      file,
      name: file.name,
      status: "pending" as const,
      preview: URL.createObjectURL(file),
    }));

    setUploads((prev) => [...prev, ...newUploads]);

    if (fileInputRef.current) fileInputRef.current.value = "";
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
      await loadGalleryItems();
      setUploads([]);
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
      updateItem({ status: "compressing" });

      const compressedFile = await imageCompression(item.file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/webp" as const,
      });

      const baseName = item.name.replace(/\.[^/.]+$/, "");
      const fileName = `${baseName}_${Date.now()}.webp`;

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

      const { data: existing } = await supabase
        .from("gallery")
        .select("id")
        .eq("image_url", publicUrl)
        .maybeSingle();

      if (existing) {
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

  // ── 다중 선택 ──────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allFilteredSelected =
      filteredItems.length > 0 &&
      filteredItems.every((i) => selectedIds.has(i.id));
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((i) => next.add(i.id));
        return next;
      });
    }
  }

  /** Storage 파일 + gallery DB 행 일괄 삭제 */
  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (
      !confirm(`선택한 ${selectedIds.size}개의 이미지를 삭제하시겠습니까?`)
    )
      return;

    setDeletingMultiple(true);
    const errors: string[] = [];

    const toDelete = galleryItems.filter((i) => selectedIds.has(i.id));
    const storageNames = toDelete.map((i) => i.storageName);

    const { error: storageError } = await supabase.storage
      .from("images")
      .remove(storageNames);
    if (storageError)
      errors.push(`Storage 삭제 실패: ${storageError.message}`);

    const { error: dbError } = await supabase
      .from("gallery")
      .delete()
      .in("id", Array.from(selectedIds));
    if (dbError) errors.push(`DB 삭제 실패: ${dbError.message}`);

    if (errors.length > 0) alert(`삭제 중 오류:\n${errors.join("\n")}`);

    if (editingItem && selectedIds.has(editingItem.id)) setEditingItem(null);
    setSelectedIds(new Set());
    setDeletingMultiple(false);
    await loadGalleryItems();
  }

  // ── 일괄 수정 ──────────────────────────────────────────────────────────────

  function openBulkEdit() {
    setBulkEditCaption("");
    setBulkEditCategory("");
    setBulkApplyCaption(false);
    setBulkApplyCategory(true);
    setBulkEditOpen(true);
    setEditingItem(null); // 개별 수정 패널 닫기
  }

  async function handleBulkEdit() {
    if (selectedIds.size === 0) return;
    if (!bulkApplyCaption && !bulkApplyCategory) {
      alert("수정할 항목(Caption 또는 Category)을 하나 이상 선택하세요.");
      return;
    }

    setBulkSaving(true);
    try {
      const updatePayload: Record<string, string | null> = {};
      if (bulkApplyCaption) updatePayload.caption = bulkEditCaption.trim() || null;
      if (bulkApplyCategory) updatePayload.category = bulkEditCategory.trim() || null;

      const { error } = await supabase
        .from("gallery")
        .update(updatePayload)
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      // 로컬 상태 즉시 반영
      setGalleryItems((prev) =>
        prev.map((item) =>
          selectedIds.has(item.id)
            ? {
                ...item,
                ...(bulkApplyCaption ? { caption: bulkEditCaption.trim() || undefined } : {}),
                ...(bulkApplyCategory ? { category: bulkEditCategory.trim() || undefined } : {}),
              }
            : item
        )
      );

      setBulkEditOpen(false);
      setSelectedIds(new Set());
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "저장 실패";
      alert(`일괄 수정 실패: ${msg}`);
    } finally {
      setBulkSaving(false);
    }
  }

  // ── 사후 편집 ──────────────────────────────────────────────────────────────

  function handleItemClick(item: GalleryItem) {
    if (editingItem?.id === item.id) {
      setEditingItem(null);
      return;
    }
    setBulkEditOpen(false); // 일괄 수정 패널 닫기
    setEditingItem(item);
    setEditCaption(item.caption ?? "");
    setEditCategory(item.category ?? "");
  }

  async function handleSaveEdit() {
    if (!editingItem) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("gallery")
        .update({
          caption: editCaption.trim() || null,
          category: editCategory.trim() || null,
        })
        .eq("id", editingItem.id);

      if (error) throw error;

      // 로컬 상태 즉시 반영
      const updatedItem: GalleryItem = {
        ...editingItem,
        caption: editCaption.trim() || undefined,
        category: editCategory.trim() || undefined,
      };
      setGalleryItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? updatedItem : i))
      );
      setEditingItem(updatedItem);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "저장 실패";
      alert(`저장 실패: ${msg}`);
    } finally {
      setSaving(false);
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

  const isUploading = uploads.some(
    (u) => u.status !== "done" && u.status !== "error"
  );
  const pendingCount = uploads.filter(
    (u) => u.status !== "done" && u.status !== "error"
  ).length;

  // 필터별 카운트
  const categoryCounts = MASTER_CATEGORIES.reduce<Record<string, number>>(
    (acc, cat) => {
      acc[cat] = galleryItems.filter((i) => i.category === cat).length;
      return acc;
    },
    {}
  );

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

        {/* ── 마스터 카테고리 선택 ───────────────────────────────────────────── */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            카테고리{" "}
            <span className="text-gray-400 font-normal text-xs">
              사진 업로드 전에 먼저 선택하세요 — 모든 사진에 일괄 적용됩니다
            </span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {MASTER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                disabled={isUploading}
                onClick={() =>
                  setCategory((prev) => (prev === cat ? "" : cat))
                }
                className={`px-5 py-2 rounded-full text-sm font-medium border-2 transition-all duration-150 ${
                  category === cat
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm scale-105"
                    : "bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {category === cat ? "✓ " : ""}
                {cat}
              </button>
            ))}
          </div>
          {category ? (
            <p className="text-xs text-blue-600 mt-2">
              <strong>{category}</strong> 카테고리가 선택됐습니다. 이제 사진을
              업로드하면 자동으로 적용됩니다.
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-2">
              카테고리를 선택하지 않으면 미분류로 업로드됩니다.
            </p>
          )}
        </div>

        {/* ── 설명(Caption) 입력 ─────────────────────────────────────────────── */}
        <div className="mb-4">
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
            {isUploading
              ? `업로드 중... (${pendingCount}개 처리 중)`
              : "클릭하여 사진 선택"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            여러 장을 한 번에 선택할 수 있습니다 (자동 WebP 변환, 갤러리 DB
            자동 저장)
          </p>
        </label>
      </div>

      {/* Gallery + Upload Progress (통합) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">
              저장된 이미지 ({filteredItems.length}
              {listFilter !== "전체" && (
                <span className="text-sm font-normal text-gray-500">
                  {" "}/ 전체 {galleryItems.length}
                </span>
              )}
              )
              {isUploading && (
                <span className="text-sm text-blue-600 font-medium ml-2">
                  + {pendingCount}개 업로드 중...
                </span>
              )}
            </h2>
            {filteredItems.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-1"
              >
                {filteredItems.every((i) => selectedIds.has(i.id)) &&
                filteredItems.length > 0
                  ? "전체 해제"
                  : "전체 선택"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={openBulkEdit}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors font-medium border ${
                    bulkEditOpen
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-blue-400 text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {bulkEditOpen ? "✓ 일괄 수정 중" : `${selectedIds.size}개 일괄 수정`}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={deletingMultiple}
                  className="bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {deletingMultiple ? "삭제 중..." : `${selectedIds.size}개 삭제`}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={loadGalleryItems}
              disabled={loadingImages}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* ── 목록 카테고리 필터 ─────────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap mb-5">
          {(["전체", ...MASTER_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setListFilter(cat);
                setEditingItem(null);
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                listFilter === cat
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : "bg-white border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {cat}
              <span className="ml-1.5 text-xs opacity-70">
                ({cat === "전체" ? galleryItems.length : (categoryCounts[cat] ?? 0)})
              </span>
            </button>
          ))}
        </div>

        {/* ── 일괄 수정 패널 ──────────────────────────────────────────────── */}
        {bulkEditOpen && selectedIds.size > 0 && (
          <div className="mb-5 border border-blue-300 rounded-xl bg-blue-50/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-800">선택 항목 일괄 수정</span>
                <span className="bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  {selectedIds.size}개 선택됨
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBulkEditOpen(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                닫기
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Caption 일괄 적용 */}
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkApplyCaption}
                    onChange={(e) => setBulkApplyCaption(e.target.checked)}
                    className="accent-blue-600 w-3.5 h-3.5"
                  />
                  Caption 일괄 적용
                </label>
                <input
                  type="text"
                  value={bulkEditCaption}
                  onChange={(e) => setBulkEditCaption(e.target.value)}
                  disabled={!bulkApplyCaption}
                  placeholder="예: 2025 김포예술제 공연"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
                {bulkApplyCaption && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    빈칸으로 두면 선택한 이미지의 Caption을 모두 제거합니다.
                  </p>
                )}
              </div>

              {/* Category 일괄 적용 */}
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkApplyCategory}
                    onChange={(e) => setBulkApplyCategory(e.target.checked)}
                    className="accent-blue-600 w-3.5 h-3.5"
                  />
                  Category 일괄 적용
                </label>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {MASTER_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      disabled={!bulkApplyCategory}
                      onClick={() =>
                        setBulkEditCategory((prev) => (prev === cat ? "" : cat))
                      }
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        bulkEditCategory === cat
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-gray-300 text-gray-500 hover:border-blue-400"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={bulkEditCategory}
                  onChange={(e) => setBulkEditCategory(e.target.value)}
                  disabled={!bulkApplyCategory}
                  placeholder="직접 입력 또는 위 버튼 선택"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBulkEdit}
                disabled={bulkSaving || (!bulkApplyCaption && !bulkApplyCategory)}
                className="bg-blue-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {bulkSaving ? (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    저장 중...
                  </span>
                ) : (
                  `${selectedIds.size}개 일괄 적용`
                )}
              </button>
              <p className="text-xs text-gray-400">
                {bulkApplyCaption && bulkApplyCategory
                  ? "Caption과 Category를 동시에 수정합니다."
                  : bulkApplyCaption
                  ? "Caption만 수정합니다."
                  : bulkApplyCategory
                  ? "Category만 수정합니다."
                  : "수정할 항목을 체크하세요."}
              </p>
            </div>
          </div>
        )}

        {/* Uploading items (업로드 현황 통합) */}
        {uploads.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4 pb-4 border-b border-gray-100">
            {uploads.map((item) => (
              <div
                key={item.preview}
                className="relative rounded-lg overflow-hidden border-2 border-blue-200 bg-blue-50/30"
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
                <div className="p-1.5">
                  <p className="text-xs text-gray-500 truncate">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gallery grid */}
        {loadingImages ? (
          <p className="text-center text-gray-500 py-8">로딩 중...</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {listFilter === "전체"
              ? "저장된 이미지가 없습니다."
              : `'${listFilter}' 카테고리 이미지가 없습니다.`}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const isEditing = editingItem?.id === item.id;
              return (
                <Fragment key={item.id}>
                  {/* 이미지 카드 */}
                  <div
                    onClick={() => handleItemClick(item)}
                    className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      isEditing
                        ? "border-blue-500 shadow-md"
                        : isSelected
                        ? "border-red-400"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-2 border-white shadow accent-red-500 cursor-pointer"
                      />
                    </div>

                    <div className="aspect-square relative">
                      <Image
                        src={item.image_url}
                        alt={item.caption ?? item.storageName}
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    </div>

                    {/* Hover: URL 복사 */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-1 p-2 w-full">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyUrl(item.image_url);
                          }}
                          className="flex-1 bg-white text-gray-700 text-xs py-1.5 rounded hover:bg-gray-100 transition-colors font-medium"
                        >
                          URL 복사
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

                  {/* 인라인 수정 패널 (선택된 카드 바로 뒤 전체 너비) */}
                  {isEditing && (
                    <div className="col-span-full border border-blue-200 rounded-xl bg-blue-50/40 p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                          <Image
                            src={editingItem.image_url}
                            alt={editCaption || editingItem.storageName}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800 mb-3">
                            사진 정보 수정
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Caption{" "}
                                <span className="text-gray-400 font-normal">
                                  (alt 속성에 즉시 반영)
                                </span>
                              </label>
                              <input
                                type="text"
                                value={editCaption}
                                onChange={(e) => setEditCaption(e.target.value)}
                                placeholder="예: 2025 김포예술제 공연"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Category
                              </label>
                              <div className="flex gap-1.5 flex-wrap mb-2">
                                {MASTER_CATEGORIES.map((cat) => (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() =>
                                      setEditCategory((prev) =>
                                        prev === cat ? "" : cat
                                      )
                                    }
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                                      editCategory === cat
                                        ? "bg-blue-600 border-blue-600 text-white"
                                        : "bg-white border-gray-300 text-gray-500 hover:border-blue-400"
                                    }`}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                              <input
                                type="text"
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                placeholder="직접 입력 (예: 행사)"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={saving}
                              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                            >
                              {saving ? "저장 중..." : "수정 완료"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItem(null)}
                              className="border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              닫기
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
