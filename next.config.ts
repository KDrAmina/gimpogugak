import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

// 1. 기본 Next.js 설정
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
    inlineCss: true,
  },
};

// 2. 번들 분석기 설정 래핑
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// 3. 최종 내보내기
export default bundleAnalyzer(nextConfig);