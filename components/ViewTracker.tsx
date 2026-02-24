"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export default function ViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    const key = `blog_view_${postId}`;
    const stored = localStorage.getItem(key);
    const now = Date.now();

    if (stored) {
      const lastViewed = parseInt(stored, 10);
      if (!isNaN(lastViewed) && now - lastViewed < TWENTY_FOUR_HOURS) {
        return;
      }
    }

    async function track() {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("posts")
        .select("views")
        .eq("id", postId)
        .single();

      const currentViews = (data?.views ?? 0) as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("posts")
        .update({ views: currentViews + 1 })
        .eq("id", postId);

      if (!error) {
        localStorage.setItem(key, String(now));
      }
    }

    track();
  }, [postId]);

  return null;
}
