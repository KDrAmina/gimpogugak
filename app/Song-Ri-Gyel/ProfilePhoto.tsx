"use client";

import Image from "next/image";

export function ProfilePhoto() {
  return (
    <button
      type="button"
      className="block mx-auto w-24 h-24 rounded-full overflow-hidden shadow-md cursor-pointer transition-transform duration-300 ease-in-out hover:scale-105 active:scale-110 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
      aria-label="프로필 사진"
    >
      <Image
        src="/Song-Ri-Gyeol-profile.jpg"
        alt="송리결 원장 프로필 사진"
        width={96}
        height={96}
        className="w-full h-full object-cover"
      />
    </button>
  );
}
