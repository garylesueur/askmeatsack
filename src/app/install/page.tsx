import Image from "next/image";
import type { Metadata } from "next";
import { PluginInstall } from "@/components/plugin-install";
import { SiteShell } from "@/components/site-chrome";
import { CURSOR_PLUGIN_HREF, cursorInstallPageHref } from "@/lib/cursor-install";
import { PLUGIN_INSTALL } from "@/lib/plugin-install";
import { publicOrigin } from "@/lib/public-origin";

export const metadata: Metadata = {
  title: "Install plugin",
  description:
    "Install " +
    PLUGIN_INSTALL.displayName +
    " from the Meatsack marketplace in Codex, Claude Code, or Cursor.",
  alternates: { canonical: "/install" },
  openGraph: { title: "Install " + PLUGIN_INSTALL.displayName, url: "/install" },
};

export default function InstallPage() {
  const origin = publicOrigin();
  const mcpUrl = origin + "/mcp";
  return (
    <SiteShell
      wordmark={PLUGIN_INSTALL.displayName}
      repoHref={CURSOR_PLUGIN_HREF}
      sibling={{ name: "showmeatsack.com", href: "https://showmeatsack.com" }}
      docs={[
        { label: "Install plugin", href: "/install" },
        { label: "skill.md", href: "/skill.md" },
        { label: "mcp.md", href: "/mcp.md" },
        { label: "llms.txt", href: "/llms.txt" },
      ]}
    >
      <div className="mx-auto w-full max-w-2xl pt-12 sm:pt-16">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
          <Image
            src="/plugin-icon.png"
            alt=""
            width={72}
            height={72}
            className="size-16 shrink-0 rounded-xl sm:size-18"
          />
          <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            Install {PLUGIN_INSTALL.displayName}
          </h1>
        </div>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Add the Meatsack marketplace once, then choose the plugins you need. Each plugin includes
          the hosted connection and the instructions your agent needs to use it.
        </p>
        <PluginInstall mcpUrl={mcpUrl} cursorHref={cursorInstallPageHref(mcpUrl)} />
      </div>
    </SiteShell>
  );
}
