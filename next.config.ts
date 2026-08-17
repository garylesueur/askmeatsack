import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/s/:sessionId.md",
          destination: "/s/:sessionId/md",
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
