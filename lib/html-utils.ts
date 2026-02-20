/**
 * XSS 방지: 위험한 HTML 태그/속성 제거
 * <script>, iframe, event 핸들러, javascript: URL 등 필터링
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  let s = html;
  // 위험 태그 완전 제거 (내용 포함)
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  s = s.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "");
  s = s.replace(/<embed\b[^>]*\/?>/gi, "");
  s = s.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, "");
  // 이벤트 핸들러 제거 (onclick, onload, onerror 등)
  s = s.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  s = s.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "");
  // javascript: 및 data: URL 제거 (href, src)
  s = s.replace(/\s(href|src)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, " $1=\"#\"");
  s = s.replace(/\s(href|src)\s*=\s*["']?\s*data:\s*text\/html[^"'\s>]*/gi, " $1=\"#\"");
  return s;
}

/**
 * HTML 태그 제거 및 엔티티 디코딩
 * 미리보기/요약 텍스트에서 &nbsp; 등이 그대로 보이는 문제 해결
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function stripHtml(html: string): string {
  if (!html) return "";
  const noTags = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return decodeHtmlEntities(noTags);
}
