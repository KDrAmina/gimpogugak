import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

// 1. 기본 Next.js 설정 (이미지, CSS 최적화 등)
const nextConfig: NextConfig = {
  compress: true,
  
  images: {
    formats: ['image/avif', 'image/webp'],
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
    optimizePackageImports: ['lucide-react', 'date-fns'],
    inlineCss: true, // 👈 App Router용 CSS 인라인 (렌더링 차단 해결)
  },
};

// 2. 번들 분석기 설정 래핑 (환경변수 ANALYZE가 true일 때만 작동)
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// 3. 최종 내보내기
export default bundleAnalyzer(nextConfig);