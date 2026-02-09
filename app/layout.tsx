import type { Metadata } from "next";
import { Noto_Serif_KR, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { MinimalNav } from "@/components/layout/MinimalNav";

const notoSerif = Noto_Serif_KR({
  subsets: ["latin"],
  variable: "--font-noto-serif",
  display: "swap",
});

const notoSans = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gimpo-gugak.kr";

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
    "Gimpo Gugak",
    "김포 민요",
    "김포 체험학습",
    "김포 장구",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "김포국악원",
    title: "김포국악원 | 무형문화재 이수자 직강 (Gimpo Gugak Center)",
    description:
      "황해도무형문화재 제3호 놀량사거리 이수자 원장과 한양대 성악 전공 부원장이 이끄는 김포 대표 국악 교육원. 민요, 장구, 입시, 체험학습 운영.",
    url: siteUrl,
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 256,
        alt: "김포국악원 로고",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "김포국악원 | 무형문화재 이수자 직강",
    description:
      "황해도무형문화재 제3호 놀량사거리 이수자 원장과 한양대 성악 전공 부원장이 이끄는 김포 대표 국악 교육원. 민요, 장구, 입시, 체험학습 운영.",
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "김포국악원",
  description: "황해도무형문화재 제3호 놀량사거리 이수자 원장과 한양대 성악 전공 부원장이 이끄는 김포 대표 국악 교육원.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "모담공원로 170-14",
    addressLocality: "김포시",
    addressRegion: "경기도",
    addressCountry: "KR",
  },
  telephone: "010-5948-1843",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${notoSerif.variable} ${notoSans.variable}`}>
      <body className="font-sans min-h-screen bg-[#ffffff] text-[#111111]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <MinimalNav />
        <main className="md:ml-[120px] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
