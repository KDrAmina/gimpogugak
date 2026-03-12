/**
 * BlogContent — Server Component
 *
 * Parses sanitized TinyMCE HTML and renders <img> tags as native img elements.
 * Caller is responsible for running sanitizeHtml() before passing `html`.
 */

import parse, { HTMLReactParserOptions, Element, DOMNode } from "html-react-parser";

interface BlogContentProps {
  html: string;
}

const parserOptions: HTMLReactParserOptions = {
  replace(domNode: DOMNode) {
    if (!(domNode instanceof Element) || domNode.name !== "img") return;
    const { src, alt, width, height } = domNode.attribs;
    if (!src) return;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        width={width ? Number(width) : undefined}
        height={height ? Number(height) : undefined}
        loading="lazy"
        style={{ display: "block", margin: "0.6em auto", maxWidth: "100%", height: "auto" }}
      />
    );
  },
};

export default function BlogContent({ html }: BlogContentProps) {
  return (
    <div className="blog-content">
      {parse(html, parserOptions)}
    </div>
  );
}
