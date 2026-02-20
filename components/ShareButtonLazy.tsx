"use client";

import dynamic from "next/dynamic";

// dynamic({ ssr: false }) must live in a Client Component — not a Server Component.
// ShareButton uses window / navigator (event-handler only), so we skip its SSR output.
const ShareButton = dynamic(() => import("./ShareButton"), { ssr: false });

export default function ShareButtonLazy() {
  return <ShareButton />;
}
