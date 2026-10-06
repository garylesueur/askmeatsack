"use client";

import { useState } from "react";
import Link from "next/link";
import { HomeDemo } from "@/app/home-demo";
import { Button } from "@/components/ui/button";
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
};

/** The interactive parts of the hero: connect, try, or curl it. */
export function HomeLanding({ mcpUrl, cursorHref, pluginHref }: HomeLandingProps) {
  const [copied, setCopied] = useState<"mcp" | null>(null);
  const [tryOpen, setTryOpen] = useState(false);

  async function copy(kind: "mcp", value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be refused. The value is on the page either way.
      return;
    }
    setCopied(kind);
    window.setTimeout(() => {
      setCopied(null);
    }, 1500);
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/install"
          className="inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Install plugin
        </Link>
        <Dialog open={tryOpen} onOpenChange={setTryOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="lg" variant="outline">
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
            <div className="min-h-0 overflow-y-auto">{tryOpen ? <HomeDemo /> : null}</div>
          </DialogContent>
        </Dialog>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Connection and skill together. Codex, Claude Code, or Cursor.
      </p>

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Connect an MCP client directly
        </summary>
        <div className="pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full break-all rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground">
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
              {copied === "mcp" ? "Copied" : "Copy MCP URL"}
            </Button>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Paste that into any MCP client.{" "}
            <a href={cursorHref} className="underline underline-offset-4 hover:text-foreground">
              Add MCP to Cursor
            </a>
            {" · "}
            <a href={pluginHref} className="underline underline-offset-4 hover:text-foreground">
              Plugin source
            </a>
            {" · "}
            <a
              href="https://grok.com/connectors"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Grok connectors
            </a>
          </p>
        </div>
      </details>
    </>
  );
}

/** The raw API, for anyone who would rather not connect an agent at all. */
export function CurlBlock({ endpoint, curl }: { endpoint: string; curl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(curl);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-machine-rule bg-machine shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-machine-rule bg-machine-raised px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.13em] text-machine-muted">
          {endpoint}
        </span>
        <button
          type="button"
          onClick={() => {
            void copy();
          }}
          className="rounded-md border border-machine-rule px-3 py-1 font-mono text-xs text-machine-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-5 font-mono text-[12.5px] leading-[1.75] text-machine-foreground">
        {curl}
      </pre>
    </div>
  );
}
