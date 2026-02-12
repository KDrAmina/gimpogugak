import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true, // 결과물 압축 (유지)
  
  images: {
    formats: ['image/avif', 'image/webp'], // 최신 이미지 포맷 사용
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zvwukvwtunqfptanctuc.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'], // 기존 설정 유지
    optimizeCss: true, // 👈 [추가됨] 렌더링 차단 CSS 해결 (critters 필요)
  },
};

export default nextConfig;