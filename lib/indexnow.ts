/**
 * Bing IndexNow API — 블로그 글 발행/수정 시 검색엔진(Bing, Naver 등)에 즉시 색인 요청
 * @see https://www.indexnow.org/
 */

const INDEXNOW_KEY = "c4f2a7b9e1d8305c6f4a2b9d7e1f803c";
const HOST = "gimpogugak.com";
const BASE_URL = "https://gimpogugak.com";

/**
 * IndexNow API에 URL 색인 요청을 전송합니다.
 * @param postSlugOrId - 블로그 글의 slug 또는 id (예: "minyo-bawoogi" 또는 "uuid")
 */
export async function notifyIndexNow(postSlugOrId: string): Promise<void> {
  const url = `${BASE_URL}/blog/${encodeURIComponent(postSlugOrId)}`;
  const keyLocation = `${BASE_URL}/${INDEXNOW_KEY}.txt`;

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation,
    urlList: [url],
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.error("[IndexNow] API error:", res.status, await res.text());
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      console.error("[IndexNow] Request failed:", err);
    }
  }
}
