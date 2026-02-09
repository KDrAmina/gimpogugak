import Link from "next/link";
import Image from "next/image";
import { Phone, MessageCircle, MapPin } from "lucide-react";

const FOOTER_LINKS = [
  { href: "/about", label: "국악원 소개" },
  { href: "/teachers", label: "강사진" },
  { href: "/classes", label: "수업 안내" },
  { href: "/notices", label: "공지사항" },
  { href: "/gallery", label: "갤러리" },
  { href: "/booking", label: "공연·섭외" },
  { href: "/contact", label: "문의하기" },
  { href: "/privacy", label: "개인정보처리방침" },
];

export function Footer() {
  const phone = process.env.NEXT_PUBLIC_PHONE ?? "031-XXX-XXXX";
  const kakaoUrl = process.env.NEXT_PUBLIC_KAKAO_URL ?? "#";
  const address = process.env.NEXT_PUBLIC_ADDRESS ?? "경기 김포시";

  return (
    <footer className="bg-ink text-paper border-t border-ink/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* 브랜드 & 한 줄 소개 */}
          <div>
            <Link
              href="/"
              className="font-serif text-xl text-paper font-semibold"
            >
              김포국악원
            </Link>
            <p className="mt-2 text-sm text-paper/80 leading-relaxed">
              김포 대표 국악 교육, 전통을 제대로 배우는 곳
            </p>
          </div>

          {/* 링크 */}
          <div>
            <h3 className="text-sm font-semibold text-paper/90 uppercase tracking-wider mb-4">
              바로가기
            </h3>
            <ul className="space-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-paper/80 hover:text-paper transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 연락처 & 주소 */}
          <div>
            <h3 className="text-sm font-semibold text-paper/90 uppercase tracking-wider mb-4">
              연락처
            </h3>
            <ul className="space-y-3 text-sm text-paper/80">
              <li>
                <a
                  href={`tel:${phone.replace(/-/g, "")}`}
                  className="inline-flex items-center gap-2 hover:text-paper transition-colors"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  {phone}
                </a>
              </li>
              <li>
                <a
                  href={kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-paper transition-colors"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  카카오톡 문의
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{address}</span>
              </li>
            </ul>
          </div>
        </div>

        <hr className="hanji-line my-8 border-paper/20" />

        <div className="flex flex-col items-center justify-center gap-3 text-sm text-paper/60">
          <Link href="/" className="shrink-0">
            <Image
              src="/logo-white.png"
              alt="김포국악원 GIMPO GUGAK CENTER"
              width={120}
              height={48}
              className="h-10 w-auto object-contain opacity-90"
            />
          </Link>
          <span>© {new Date().getFullYear()} 김포국악원. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
