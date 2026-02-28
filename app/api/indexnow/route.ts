import { NextRequest, NextResponse } from "next/server";
import { notifyIndexNow } from "@/lib/indexnow";

/**
 * GET /api/indexnow?path=<postSlugOrId>
 * 블로그 글 발행/수정 후 IndexNow 색인 요청을 백그라운드로 전달합니다.
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "missing_path" }, { status: 400 });
  }
  await notifyIndexNow(path);
  return NextResponse.json({ ok: true });
}
