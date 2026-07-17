import type { MetadataRoute } from "next";

const getBaseUrl = (): string => {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    "https://aicare.sumbu.xyz";

  return configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`;
};

const publicRoutes: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/about", changeFrequency: "weekly", priority: 0.9 },
  { path: "/about/features", changeFrequency: "weekly", priority: 0.85 },
  { path: "/about/research", changeFrequency: "monthly", priority: 0.8 },
  { path: "/about/aika", changeFrequency: "weekly", priority: 0.8 },
  { path: "/about/privacy", changeFrequency: "monthly", priority: 0.7 },
  { path: "/resources", changeFrequency: "weekly", priority: 0.85 },
  { path: "/activities", changeFrequency: "weekly", priority: 0.75 },
  { path: "/caretoken", changeFrequency: "weekly", priority: 0.7 },
  { path: "/carequest", changeFrequency: "weekly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.6 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
