"use client";

export default function ShareButton() {
  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("주소가 복사되었습니다. 카카오톡 등에 붙여넣기 해주세요!");
    } catch (err) {
      console.error("Copy failed:", err);
      alert("주소 복사에 실패했습니다.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors"
    >
      🔗 공유하기
    </button>
  );
}
