/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 결과물 압축하기 (기본값 true지만 확실하게!)
  compress: true,
  
  // 2. 이미지 최적화 (아까 했던 설정 유지)
  images: {
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
  
  // 3. 실험적 기능: CSS 최적화 (선택 사항)
  // 이걸 켜면 "사용하지 않는 CSS" 경고가 줄어들 수 있습니다.
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'], // 혹시 쓰는 라이브러리 있으면 최적화
  },
};

export default nextConfig;