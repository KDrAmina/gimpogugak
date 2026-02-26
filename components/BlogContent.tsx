/**
 * BlogContent — Server Component
 *
 * Parses sanitized Quill HTML and replaces <img> tags that point to Supabase
 * Storage with Next.js <Image> components so they are optimized (AVIF/WebP
 * conversion, lazy loading, CDN caching).  All other tags are rendered as-is.
 *
 * Caller is responsible for running sanitizeHtml() before passing `html`.
 */

import Image from "next/image";
import parse, {
  HTMLReactParserOptions,
  Element,
  DOMNode,
} from "html-react-parser";

// Must match next.config.ts remotePatterns hostname exactly.
const SUPABASE_HOSTNAME = "zvwukvwtunqfptanctuc.supabase.co";

interface BlogContentProps {
  html: string;
}

/** Parse an integer from a string; return 0 on failure. */
function toInt(val: string | undefined): number {
  if (!val) return 0;
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

/** Extract a px value for `prop` from an inline style string. */
function pxFromStyle(style: string | undefined, prop: "width" | "height"): number {
  if (!style) return 0;
  const m = style.match(new RegExp(`${prop}:\\s*(\\d+)px`));
  return m ? parseInt(m[1], 10) : 0;
}

const parserOptions: HTMLReactParserOptions = {
  replace(domNode: DOMNode) {
    // Only intercept <img> elements.
    if (!(domNode instanceof Element) || domNode.name !== "img") return;

    const { src, alt, width, height, style } = domNode.attribs;
    if (!src) return;

    // Only optimise images hosted on our own Supabase project.
    // External images fall through to the regular <img> rendered by the parser.
    try {
      const hostname = new URL(src).hostname;
      if (hostname !== SUPABASE_HOSTNAME) return;
    } catch {
      // Malformed URL — skip optimisation.
      return;
    }

    // Prefer explicit HTML attributes, then inline style, then safe fallbacks.
    const w = toInt(width) || pxFromStyle(style, "width") || 800;
    const h = toInt(height) || pxFromStyle(style, "height") || 600;

    return (
      <Image
        src={src}
        alt={alt ?? ""}
        width={w}
        height={h}
        loading="lazy"
        // Responsive: fill container width but never exceed natural size,
        // and let height scale proportionally.
        style={{ display: "block", margin: "0 auto", width: "100%", height: "auto", maxWidth: `${w}px` }}
      />
    );
  },
};

export default function BlogContent({ html }: BlogContentProps) {
  return (
    <div className="ql-snow">
      <div
        className="ql-editor"
        style={{ padding: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      >
        {parse(html, parserOptions)}
      </div>
    </div>
  );
}
