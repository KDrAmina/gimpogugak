/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true, // 결과물 압축
  swcMinify: true, // 코드 최소화
  images: {
    formats: ['image/avif', 'image/webp'], // 최신 이미지 포맷 우선 사용
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
    optimizePackageImports: ['lucide-react', 'date-fns'], // 라이브러리 최적화
  },
};

export default nextConfig;