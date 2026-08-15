import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

// 1. 기본 Next.js 설정
const nextConfig: NextConfig = {
  compress: true, // 압축 유지 (Good)

  // Turbopack 설정 (Next.js 16 기본값) — 빈 객체로 경고 억제
  turbopack: {},

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zvwukvwtunqfptanctuc.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
    // inlineCss는 CSS가 작을 때만 이득이다. 이 프로젝트에서는 인라인된 CSS가
    // <style> 블록과 RSC flight payload에 각각 한 번씩, 즉 문서마다 2배로
    // 직렬화되며 외부 stylesheet가 0개가 되어 페이지 이동·재방문 때마다
    // 전량 재전송된다. 외부 CSS로 되돌려 immutable 캐시를 회복한다.
    inlineCss: false,
  },

  async headers() {
    return [
      {
        source: '/(images|fonts)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*.webp',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

// 2. 번들 분석기 설정 래핑
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// 3. 최종 내보내기 
export default bundleAnalyzer(nextConfig);