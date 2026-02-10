import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // 👇 여기가 중요합니다! 실제 도메인(.com)으로 수정했습니다.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gimpogugak.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}