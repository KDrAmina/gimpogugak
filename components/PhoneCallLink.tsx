"use client";

import { trackConversion } from "@/lib/gtag";

interface Props {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export default function PhoneCallLink({ href, className, children }: Props) {
  return (
    <a href={href} className={className} onClick={trackConversion}>
      {children}
    </a>
  );
}
