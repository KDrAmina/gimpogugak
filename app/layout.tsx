import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Noto_Serif_KR, Noto_Sans_KR, Gowun_Dodum, Nanum_Myeongjo, Nanum_Gothic } from "next/font/google";
import Script from "next/script";
import GoogleAnalyticsWrapper from "../components/GoogleAnalyticsWrapper";
import "./globals.css";
import { Navbar } from "../components/layout/Navbar";
import { AnalyticsSpeedInsights } from "../components/AnalyticsSpeedInsights";

const pretendard = localFont({
  src: "../public/fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-pretendard",
});

const notoSerif = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif",
  display: "swap",
  preload: true,
});

const notoSans = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans",
  display: "swap",
  preload: true,
});

const gowunDodum = Gowun_Dodum({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-gowun-dodum",
  display: "swap",
  // preload: false — this font is only used inside the TinyMCE editor / blog
  // viewer, not on public pages. Skipping the <link rel="preload"> removes
  // a bandwidth competitor that delayed the hero-image LCP fetch.
  preload: false,
});

const nanumMyeongjo = Nanum_Myeongjo({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-nanum-myeongjo",
  display: "swap",
  // preload: false — same rationale as gowunDodum above.
  preload: false,
});

const nanumGothic = Nanum_Gothic({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-nanum-gothic",
  display: "swap",
  // preload: false — editor/blog only, not on public critical path.
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gimpogugak.com";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

// 3. SEO 메타데이터
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "김포국악원 | 장기동·사우동·고촌 민요·성악·국악학원",
    template: "%s | 김포국악원",
  },
  description:
    "무형문화재 제3호 놀량사거리 이수자 원장과 한양대 성악 전공 부원장이 이끄는 김포국악학원. 장기동·사우동·고촌읍 인근. 민요교실·성악발성·장구·진로체험 운영.",
  keywords: [
    "김포국악원",
    "김포국악학원",
    "김포민요교실",
    "김포성악",
    "김포성악학원",
    "장기동국악원",
    "사우동국악원",
    "고촌읍국악원",
    "김포민요",
    "김포장구",
    "김포장구교실",
    "김포체험학습",
    "서도민요",
    "경기민요",
    "국악학원",
    "민요배우기",
    "무형문화재",
    "김포 국악",
    "전문 국악원",
  ],
  verification: {
    other: {
      "naver-site-verification": "6c40f80aacb11e514a73265d9c91cd94ad53424b",
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "김포국악원",
    title: "김포국악원 | 장기동·사우동·고촌 민요·성악·국악학원",
    description: "김포 장기동·사우동·고촌읍 인근 국악 전문 교육원. 무형문화재 이수자 원장 직강, 민요·성악·장구 정규반, 교육부 진로체험 인증기관.",
    url: siteUrl,
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 400,
        alt: "김포국악원 전경",
      },
    ],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: siteUrl },
  other: {
    "geo.region": "KR-41",
    "ICBM": "37.6153, 126.7159",
  },
};

// 4. GEO + SEO 데이터 (JSON-LD)
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "김포국악원",
  "alternateName": ["Gimpo Gugak Center", "김포 국악원"],
  "url": siteUrl,
  "description": "무형문화재 제3호 놀량사거리 이수자 원장과 한양대 성악 전공 부원장이 함께 운영하는 김포 국악 교육 전문 기관. 장기동·사우동·고촌읍 인근.",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "모담공원로 170-14",
    "addressLocality": "김포시 장기동",
    "addressRegion": "경기도",
    "postalCode": "10076",
    "addressCountry": "KR"
  },
  "areaServed": ["김포시 장기동", "김포시 사우동", "김포시 고촌읍", "김포시"],
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 37.6153,
    "longitude": 126.7159
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
  ],
  "knowsAbout": ["서도민요", "경기민요", "놀량사거리", "장구", "국악교육", "진로체험", "성악발성", "민요교실", "국악체험"]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${pretendard.variable} ${notoSerif.variable} ${notoSans.variable} ${gowunDodum.variable} ${nanumMyeongjo.variable} ${nanumGothic.variable}`}>
      <head>
        {/* Google Ads 전체 사이트 태그 (AW-17945851352) — lazyOnload로 LCP 차단 방지 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17945851352"
          strategy="lazyOnload"
        />
        <Script id="google-ads-init" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17945851352');
          `}
        </Script>
      </head>
      <body className={`${pretendard.className} min-h-screen bg-[#ffffff] text-[#111111] antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "김포국악원",
              alternateName: "Gimpo Gugak Center",
              url: siteUrl,
              description: "경기 김포시 국악 교육원. 무형문화재 제3호 놀량사거리 이수자 직강.",
              inLanguage: "ko-KR",
              publisher: { "@type": "Organization", name: "김포국악원", url: siteUrl },
            }),
          }}
        />
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
        
        <AnalyticsSpeedInsights />
        <GoogleAnalyticsWrapper />
      </body>
    </html>
  );
}