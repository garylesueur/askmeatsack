"use client";

import Image from "next/image";
import { useState } from "react";
import { HomeDemo } from "@/app/home-demo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type HomeLandingProps = {
  mcpUrl: string;
  cursorHref: string;
  pluginHref: string;
  curl: string;
  skillHref: string;
  guideHref: string;
};

export function HomeLanding({
  mcpUrl,
  cursorHref,
  pluginHref,
  curl,
  skillHref,
  guideHref,
}: HomeLandingProps) {
  const [copied, setCopied] = useState<"mcp" | "curl" | null>(null);
  const [tryOpen, setTryOpen] = useState(false);

  async function copy(kind: "mcp" | "curl", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => {
      setCopied(null);
    }, 1500);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground">
          {mcpUrl}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void copy("mcp", mcpUrl);
          }}
        >
          {copied === "mcp" ? "Copied" : "Copy"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        For agents:{" "}
        <a href={guideHref} className="underline underline-offset-4">
          API guide
        </a>
        {" · "}
        <a href={skillHref} className="underline underline-offset-4">
          skill
        </a>
        {" · "}
        <a href="/llms.txt" className="underline underline-offset-4">
          llms.txt
        </a>
      </p>

      <div className="flex flex-col gap-2">
        <a href={cursorHref} className="inline-flex w-fit">
          <Image
            src="/mcp-install-light.svg"
            alt="Add askmeatsack.com to Cursor"
            width={126}
            height={28}
            unoptimized
            className="dark:invert"
          />
        </a>
        <a
          href={pluginHref}
          className="w-fit text-sm underline underline-offset-4"
        >
          Cursor plugin
        </a>
        <p className="text-sm text-muted-foreground">
          The plugin is the MCP server plus the skill. Install it from GitHub.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <a
            href="https://grok.com/connectors"
            target="_blank"
            rel="noreferrer"
          >
            Add in Grok
          </a>
        </Button>
        <p className="text-sm text-muted-foreground">
          Grok has no one-click badge yet. Open connectors, choose Custom, paste
          the MCP URL above.
        </p>
      </div>

      <Dialog open={tryOpen} onOpenChange={setTryOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            Try it
          </Button>
        </DialogTrigger>
        <DialogContent size="large" className="gap-4">
          <DialogHeader className="shrink-0 pr-10">
            <DialogTitle>Try it</DialogTitle>
            <DialogDescription>
              A real questionnaire. Submit and you will see what the agent gets.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            {tryOpen ? <HomeDemo /> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Or curl
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void copy("curl", curl);
            }}
          >
            {copied === "curl" ? "Copied" : "Copy"}
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto font-mono text-[13px] leading-6 text-foreground">
            {curl}
          </pre>
        </CardContent>
      </Card>
    </>
  );
}
