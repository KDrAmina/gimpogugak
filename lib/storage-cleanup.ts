/**
 * Storage 경로 추출 및 정리 유틸리티
 * 게시글/공지 삭제 시 public-media 버킷의 미사용 이미지를 함께 삭제합니다.
 */

const BUCKET = "public-media";

/**
 * Supabase public-media URL에서 저장소 내부 경로를 추출합니다.
 * 예: https://xxx.supabase.co/storage/v1/object/public/public-media/blog-content/123.png
 *  → blog-content/123.png
 */
function extractPathFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    const match = url.match(/\/storage\/v1\/object\/public\/public-media\/(.+?)(?:\?|$)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * HTML content에서 public-media 버킷을 가리키는 img src URL들을 추출하고
 * 저장소 내부 경로 배열로 반환합니다.
 */
function extractPathsFromHtmlContent(html: string | null | undefined): string[] {
  if (!html || typeof html !== "string") return [];
  const paths: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const path = extractPathFromUrl(match[1]);
    if (path && !paths.includes(path)) paths.push(path);
  }
  return paths;
}

/**
 * thumbnail_url과 content에서 public-media 버킷 내 파일 경로를 모두 추출합니다.
 */
export function extractStoragePaths(thumbnailUrl: string | null | undefined, content: string | null | undefined): string[] {
  const paths: string[] = [];
  const thumbPath = extractPathFromUrl(thumbnailUrl);
  if (thumbPath) paths.push(thumbPath);
  const contentPaths = extractPathsFromHtmlContent(content);
  for (const p of contentPaths) {
    if (!paths.includes(p)) paths.push(p);
  }
  return paths;
}

/**
 * 게시글 삭제 전 Storage에서 관련 이미지를 삭제합니다.
 * @returns 삭제된 파일 경로 수 (실패 시 -1)
 */
export async function deletePostStorageFiles(
  supabase: { storage: { from: (bucket: string) => { remove: (paths: string[]) => Promise<{ error: unknown }> } } },
  thumbnailUrl: string | null | undefined,
  content: string | null | undefined
): Promise<number> {
  const paths = extractStoragePaths(thumbnailUrl, content);
  if (paths.length === 0) return 0;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) {
    console.warn("Storage cleanup warning (proceeding with DB delete):", error);
    return -1;
  }
  return paths.length;
}
