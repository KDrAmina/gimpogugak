import Link from "next/link";

export function HomeConnect() {
  return (
    <section aria-label="Connect" className="mt-16 pt-10 border-t border-[#111]/10">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Connect</p>
      <ul className="flex flex-col gap-3">
        <li>
          <a
            href="https://instagram.com/seodo_music"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1 group"
          >
            Instagram (@seodo_music)
            <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform" aria-hidden>↗</span>
          </a>
        </li>
        <li>
          <a
            href="https://blog.naver.com/gimpogugak"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1 group"
          >
            Naver Blog
            <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform" aria-hidden>↗</span>
          </a>
        </li>
        <li>
          <Link
            href="/privacy"
            className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1"
          >
            개인정보처리방침
          </Link>
        </li>
      </ul>
    </section>
  );
}
