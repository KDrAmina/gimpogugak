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
      title="링크 복사"
      className="p-1 border rounded text-gray-500 hover:bg-gray-100 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </button>
  );
}
