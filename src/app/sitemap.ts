import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/public-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  return [
    { url: origin, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/mcp`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/mcp.md`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${origin}/skill.md`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${origin}/llms.txt`, changeFrequency: "weekly", priority: 0.5 },
  ];
}
