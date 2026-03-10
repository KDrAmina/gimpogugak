/**
 * BlogContent — Server Component
 *
 * Parses sanitized Quill HTML and renders <img> tags as plain HTML img elements
 * (no Next.js Image optimization). All other tags are rendered as-is.
 *
 * Caller is responsible for running sanitizeHtml() before passing `html`.
 */

import parse, {
  HTMLReactParserOptions,
  Element,
  DOMNode,
} from "html-react-parser";

interface BlogContentProps {
  html: string;
}

const parserOptions: HTMLReactParserOptions = {
  replace(domNode: DOMNode) {
    // Only intercept <img> elements.
    if (!(domNode instanceof Element) || domNode.name !== "img") return;

    const { src, alt } = domNode.attribs;
    if (!src) return;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        style={{
          display: "block",
          margin: "0 auto",
          width: "100%",
          height: "auto",
          maxWidth: "800px",
        }}
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
