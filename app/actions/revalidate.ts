"use server";

import { revalidatePath } from "next/cache";

/** 블로그 목록 페이지 강제 갱신 */
export async function revalidateBlogList() {
  revalidatePath("/blog");
}

/** 블로그 개별 게시글 페이지 강제 갱신 */
export async function revalidateBlogPost(postPath: string) {
  revalidatePath(`/blog/${postPath}`);
}

/** 활동 갤러리 페이지 강제 갱신 */
export async function revalidateActivities() {
  revalidatePath("/activities");
}
