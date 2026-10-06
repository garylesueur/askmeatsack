"use client";

import { useState } from "react";
import { MARKETPLACE_HREF, PLUGIN_INSTALL } from "@/lib/plugin-install";

const LINK = "underline underline-offset-4 hover:text-primary";

function InstallCode({ code, label }: { code: string; label: string }) {
  const [feedback, setFeedback] = useState<"copied" | "error" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
  }

  return (
    <div className="my-4 min-w-0 overflow-hidden rounded-lg bg-muted">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => {
            void copy();
          }}
          className="rounded px-2 py-1 text-sm font-medium hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={"Copy " + label.toLowerCase()}
        >
          {feedback === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 sm:text-sm">
        <code>{code}</code>
      </pre>
      <output className={feedback === "error" ? "block px-4 pb-3 text-sm" : "sr-only"}>
        {feedback === "copied"
          ? "Copied to clipboard."
          : feedback === "error"
            ? "Copy unavailable. Select and copy the command above."
            : ""}
      </output>
    </div>
  );
}

/** Marketplace setup comes first; direct MCP setup is an optional fallback. */
export function PluginInstall({ mcpUrl, cursorHref }: { mcpUrl: string; cursorHref: string }) {
  return (
    <div className="mt-10 space-y-12 text-sm leading-7 sm:text-base">
      <nav
        aria-label="Choose your app"
        className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-5 font-medium"
      >
        <a href="#codex" className={LINK}>
          Codex
        </a>
        <a href="#claude-code" className={LINK}>
          Claude Code
        </a>
        <a href="#cursor" className={LINK}>
          Cursor
        </a>
      </nav>

      <section id="codex" className="scroll-mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">Codex</h2>
        <p className="mt-3">Run this once in your terminal to add the Meatsack marketplace:</p>
        <InstallCode code={PLUGIN_INSTALL.codex} label="Terminal command" />
        <p>
          Restart the desktop app, open <strong>Plugins</strong>, and choose the{" "}
          <strong>Meatsack</strong> source. Select <strong>{PLUGIN_INSTALL.displayName}</strong> and
          install it.
        </p>
        <p className="mt-3 text-muted-foreground">
          This also works with Plugins in the ChatGPT desktop app. Adding the marketplace makes the
          three plugins available; you choose which ones to install.
        </p>
        <a
          href="https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli"
          className={LINK}
        >
          Codex marketplace documentation
        </a>
      </section>

      <section id="claude-code" className="scroll-mt-8 border-t border-border pt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Claude Code</h2>
        <p className="mt-3">
          Enter these commands one at a time in your Claude Code session. Skip the first if you
          already added Meatsack.
        </p>
        <InstallCode code={PLUGIN_INSTALL.claudeMarketplace} label="Add marketplace" />
        <InstallCode code={PLUGIN_INSTALL.claudePlugin} label="Choose this plugin" />
        <p>Confirm the install in the plugin panel, then start a new session.</p>
        <a href="https://code.claude.com/docs/en/discover-plugins" className={LINK}>
          Claude Code plugin documentation
        </a>
      </section>

      <section id="cursor" className="scroll-mt-8 border-t border-border pt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Cursor</h2>
        <h3 className="mt-4 font-semibold">Teams and Enterprise</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            A team admin opens{" "}
            <strong>Dashboard → Plugins &amp; MCPs → Add Marketplace → Import from Repo</strong>.
          </li>
          <li>
            Paste the repository URL below. Review the plugins, set marketplace access, and save.
          </li>
          <li>
            Open <strong>Customize</strong> in Cursor, find Meatsack, and install{" "}
            <strong>{PLUGIN_INSTALL.displayName}</strong>.
          </li>
        </ol>
        <InstallCode code={MARKETPLACE_HREF} label="Marketplace URL" />
        <details className="mt-5 border-y border-border py-4">
          <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Local install on a personal account
          </summary>
          <p className="mt-3">
            Run this in a terminal. It clones the marketplace and copies this plugin into
            Cursor&apos;s local plugin folder. If you already cloned the marketplace, run the last
            two commands from the folder that contains it.
          </p>
          <InstallCode code={PLUGIN_INSTALL.cursor} label="Local install commands" />
          <p>
            Restart Cursor or run <strong>Developer: Reload Window</strong>. In{" "}
            <strong>Customize</strong>, confirm the plugin&apos;s skill and MCP server are
            available. Your account or team must allow local plugin imports.
          </p>
        </details>
        <a href="https://cursor.com/docs/plugins" className={LINK}>
          Cursor plugin documentation
        </a>
      </section>

      <section className="border-t border-border pt-10">
        <h2 className="text-2xl font-semibold tracking-tight">Try it in a new chat</h2>
        <p className="mt-3">With the plugin installed, ask your agent:</p>
        <blockquote className="mt-3 text-lg font-medium">
          &ldquo;{PLUGIN_INSTALL.examplePrompt}&rdquo;
        </blockquote>
      </section>

      <section className="border-t border-border pt-10">
        <h2 className="text-2xl font-semibold tracking-tight">One marketplace, three plugins</h2>
        <p className="mt-3">
          Add Meatsack once in each app you use. Install one, two, or all three plugins from the
          same source.
        </p>
        <ul className="mt-4 space-y-3">
          <li>
            <a href="https://askmeatsack.com/install" className={LINK}>
              askmeatsack.com
            </a>{" "}
            — Ask a person questions and wait for answers.
          </li>
          <li>
            <a href="https://showmeatsack.com/install" className={LINK}>
              showmeatsack.com
            </a>{" "}
            — Publish a page for someone to open.
          </li>
          <li>
            <a href="https://sharemeatsack.com/install" className={LINK}>
              sharemeatsack.com
            </a>{" "}
            — Send files or request them from someone.
          </li>
        </ul>
        <a href={MARKETPLACE_HREF} className={LINK}>
          View the Meatsack marketplace on GitHub
        </a>
      </section>

      <details className="border-t border-border pt-6">
        <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Using another MCP client?
        </summary>
        <p className="mt-3">
          Add this URL as a remote HTTP MCP server. No API key is required. The plugin route also
          installs the workflow skill; for a manual connection, read{" "}
          <a href="/skill.md" className={LINK}>
            the skill
          </a>
          .
        </p>
        <InstallCode code={mcpUrl} label="MCP server URL" />
        <p>
          <a href={cursorHref} className={LINK}>
            Add just the MCP connection to Cursor
          </a>{" "}
          ·{" "}
          <a href="/mcp.md" className={LINK}>
            API guide
          </a>{" "}
          ·{" "}
          <a href="https://grok.com/connectors" className={LINK}>
            Grok connectors
          </a>
        </p>
      </details>
    </div>
  );
}
