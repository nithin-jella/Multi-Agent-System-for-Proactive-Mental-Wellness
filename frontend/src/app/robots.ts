import type { MetadataRoute } from "next";

const getBaseUrl = (): string => {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    "https://aicare.sumbu.xyz";

  return configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`;
};

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard",
          "/aika",
          "/appointments",
          "/profile",
          "/journaling",
          "/quests",
          "/survey",
          "/proof",
          "/signin",
          "/signin-ugm",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/access-denied",
          "/counselor/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
