import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { Navbar } from "../components/layout/Navbar";

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

// 👇 [수정됨] 접근성 100점을 위한 표준 설정 (확대 제한 제거)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
  // maximumScale: 1,  <-- ❌ 이 줄을 지웠습니다! (접근성 감점의 원인)
};

export const metadata: Metadata = {
  // ... (나머지 메타데이터는 그대로 유지하세요) ...
  metadataBase: new URL(siteUrl),
  title: {
    default: "김포국악원 | 무형문화재 이수자 직강 (Gimpo Gugak Center)",
    template: "%s | 김포국악원",
  },
  description:
    "황해도무형문화재 제3호 놀량사거리 이수자 원장과 한양대 성악 전공 부원장이 이끄는 김포 대표 국악 교육원. 민요, 장구, 입시, 체험학습 운영.",
  // ...
  robots: { index: true, follow: true },
};

// ... (아래 RootLayout 함수도 그대로 유지) ...
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning className={`${notoSerif.variable} ${notoSans.variable}`}>
      <body className="font-sans min-h-screen bg-[#ffffff] text-[#111111] antialiased">
        <script
          // ... (JSON-LD 스크립트 그대로)
        />
        <Navbar />
        <main className="md:ml-[120px] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}