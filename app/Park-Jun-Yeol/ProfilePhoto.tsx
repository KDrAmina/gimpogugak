"use client";

import Image from "next/image";

export function ProfilePhoto() {
  return (
    <div
      className="block mx-auto w-24 h-24 rounded-full overflow-hidden shadow-md transition-transform duration-300 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
      aria-hidden
    >
      <Image
        src="/Park-Jun-Yeol-profile.png"
        alt="박준열 부원장 프로필 사진"
        width={96}
        height={96}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
