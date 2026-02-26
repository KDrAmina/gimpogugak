/**
 * 블로그 에디터용 이미지 업로드 유틸리티
 * Supabase Storage에 이미지를 업로드하고 public URL을 반환합니다.
 * Base64 인라인 대신 URL 삽입으로 DB 용량 절감 및 Next.js Image 최적화 활용.
 *
 * EXIF 회전 보정: createImageBitmap → Canvas 재인코딩으로 업로드 전 자동 회전 적용.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const BLOG_IMAGES_BUCKET = "public-media";
export const BLOG_CONTENT_PATH = "blog-content";

const MAX_WIDTH = 1600;

/**
 * EXIF 회전을 적용하고 최대 너비를 제한한 WebP Blob을 반환합니다.
 * createImageBitmap은 모던 브라우저에서 EXIF orientation을 자동 적용합니다.
 * GIF는 애니메이션 손실 방지를 위해 원본 그대로 반환합니다.
 */
export async function normalizeImage(file: File): Promise<{ blob: Blob; ext: string }> {
  // GIF는 애니메이션이 있을 수 있으므로 변환하지 않음
  if (file.type === "image/gif") {
    return { blob: file, ext: "gif" };
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // 최대 너비 제한 (비율 유지)
  if (width > MAX_WIDTH) {
    height = Math.round((height * MAX_WIDTH) / width);
    width = MAX_WIDTH;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
  return { blob, ext: "webp" };
}

/**
 * 이미지 파일을 Supabase Storage에 업로드하고 public URL을 반환합니다.
 * 업로드 전에 EXIF 회전 보정 및 WebP 변환을 수행합니다.
 * @param supabase - Supabase 클라이언트 (createClient() from @/lib/supabase/client)
 * @param file - 업로드할 이미지 파일
 * @returns public URL 또는 null (실패 시)
 */
export async function uploadBlogImage(
  supabase: SupabaseClient,
  file: File
): Promise<{ url: string } | { error: string }> {
  let uploadBlob: Blob = file;
  let uploadExt = file.name.split(".").pop()?.toLowerCase() || "jpg";

  try {
    const { blob, ext } = await normalizeImage(file);
    uploadBlob = blob;
    uploadExt = ext;
  } catch {
    // Canvas 변환 실패 시 원본 파일 그대로 업로드
    const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(uploadExt) ? uploadExt : "jpg";
    uploadExt = safeExt;
  }

  const path = `${BLOG_CONTENT_PATH}/${Date.now()}-${Math.random().toString(36).slice(2)}.${uploadExt}`;

  const { error } = await supabase.storage.from(BLOG_IMAGES_BUCKET).upload(path, uploadBlob, {
    upsert: true,
    contentType: uploadExt === "webp" ? "image/webp" : uploadExt === "gif" ? "image/gif" : `image/${uploadExt}`,
  });

  if (error) {
    return { error: error.message };
  }

  const { data } = supabase.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
