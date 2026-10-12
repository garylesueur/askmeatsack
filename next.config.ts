import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Link",
            value:
              '</index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/s/:sessionId.md",
          destination: "/s/:sessionId/md",
        },
        {
          source: "/s/:sessionId/manage.md",
          destination: "/s/:sessionId/manage/md",
        },
        {
          source: "/mcp.md",
          destination: "/agent/mcp",
        },
        {
          source: "/skill.md",
          destination: "/agent/skill",
        },
        {
          source: "/llms.txt",
          destination: "/agent/llms",
        },
      ],
    };
  },
};

export default nextConfig;
