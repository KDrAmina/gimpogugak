import type { Metadata } from "next";

export const metadata: Metadata = {
  title: '회원 전용 (비공개)',
  robots: {
    index: false,
    follow: false,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}