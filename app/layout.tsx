import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { Navbar } from "../components/layout/Navbar";

// 1. 폰트 최적화 (성능 100점 유지)
const notoSerif = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-noto-serif",
  display: "swap",
});

const notoSans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gimpo-gugak.kr";

// 2. 뷰포트 설정 (접근성 100점 유지 - 확대 제한 없음)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

// 3. SEO 메타데이터 (사람과 검색엔진을 위한 정보)
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "김포국악원 | 무형문화재 이수자 직강 (Gimpo Gugak Center)",
    template: "%s | 김포국악원",
  },
  description:
    "황해도무형문화재 제3호 놀량사거리 이수자 원장과 한양대 성악 전공 부원장이 이끄는 김포 대표 국악 교육원. 민요, 장구, 입시, 체험학습 운영.",
  keywords: [
    "김포국악원",
    "서도민요",
    "국악학원",
    "민요배우기",
    "무형문화재",
    "김포 국악",
    "경기민요",
    "김포 장구",
    "김포 체험",
    "김포민요",
    "김포장구",
    "전문 국악원",
    "김포 학원",
    "김포학원",
  ],
  // 카카오톡/페이스북 공유 시 뜨는 카드 설정
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "김포국악원",
    title: "김포국악원 | 무형문화재 이수자 직강",
    description: "우리 소리의 깊이를 더하는 곳, 김포국악원입니다.",
    url: siteUrl,
    images: [
      {
        url: "/logo.png", // (나중에 로고 이미지 경로 확인 필요)
        width: 800,
        height: 400,
        alt: "김포국악원 전경",
      },
    ],
  },
  robots: { index: true, follow: true },
};

// 4. GEO 데이터 (AI 봇을 위한 디지털 명함 - JSON-LD)
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization", // "교육 기관"이라고 명시
  "name": "김포국악원",
  "alternateName": "Gimpo Gugak Center",
  "url": siteUrl,
  "description": "황해도무형문화재 제3호 놀량사거리 이수자 원장이 직접 지도하는 김포 국악 교육 전문 기관",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "모담공원로 170-14",
    "addressLocality": "김포시",
    "addressRegion": "경기도",
    "postalCode": "10076", // (우편번호는 필요시 수정)
    "addressCountry": "KR"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+82-10-5948-1843",
    "contactType": "customer service",
    "areaServed": "KR",
    "availableLanguage": "Korean"
  },
  "sameAs": [
    "https://blog.naver.com/gimpogugak",
    "https://instagram.com/seodo_music"
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${notoSerif.variable} ${notoSans.variable}`}>
      <body className="font-sans min-h-screen bg-[#ffffff] text-[#111111] antialiased">
        {/* 👇 봇에게 건네는 명함 (JSON-LD) 삽입 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Navbar />
        <main className="md:ml-[120px] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}