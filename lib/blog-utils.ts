/** 블로그 URL 경로: slug가 있으면 slug, 없으면 id 사용 */
export function getBlogPostPath(slug: string | null, id: string): string {
  return slug?.trim() ? slug : id;
}
