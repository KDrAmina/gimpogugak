import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자",
  description: "김포국악원 관리자",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-paper">
      {children}
    </div>
  );
}
