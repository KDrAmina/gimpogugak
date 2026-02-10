import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true, // 결과물 압축 (이건 유지!)
  // swcMinify: true,  <-- ❌ 이건 지웠습니다! (Next.js 16부터는 자동임)
  
  images: {
    formats: ['image/avif', 'image/webp'], // 최신 이미지 포맷 사용
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zvwukvwtunqfptanctuc.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'], // 라이브러리 가볍게
  },
};

export default nextConfig;