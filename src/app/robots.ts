import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/public-origin";

export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/s/", "/agent/"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
