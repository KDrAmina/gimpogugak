import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "김포국악원 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="py-12 sm:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-3xl text-ink font-semibold">개인정보처리방침</h1>
        <p className="mt-4 text-ink-light">
          개인정보처리방침 본문 (필수 페이지, 콘텐츠 작성 예정)
        </p>
      </div>
    </div>
  );
}
