"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { cn } from "@/lib/utils";

const markdownComponents: Components = {
  pre({ children }) {
    return <div className="my-3">{children}</div>;
  },
  code({ className, children }) {
    const text = String(children).replace(/\n$/, "");
    if (className?.includes("language-mermaid")) {
      return <MermaidDiagram chart={text} />;
    }
    if (className) {
      return (
        <code className="block overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
          {text}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
        {children}
      </code>
    );
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        className="underline underline-offset-2"
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border-b border-border px-2 py-1.5 font-medium text-foreground">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border-b border-border/60 px-2 py-1.5 align-top">
        {children}
      </td>
    );
  },
};

export function MarkdownBody({
  source,
  className,
  compact = false,
  tone = "detail",
}: {
  source: string;
  className?: string;
  compact?: boolean;
  tone?: "prompt" | "detail";
}) {
  return (
    <div
      className={cn(
        "text-sm leading-6 text-muted-foreground [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_h1]:mb-2 [&_h1]:font-heading [&_h1]:text-lg [&_h1]:font-medium [&_h1]:text-foreground [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-foreground [&_li]:my-1 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
        tone === "prompt" &&
          !compact &&
          "text-base leading-7 text-foreground [&_p]:mb-3 [&_p]:text-base [&_p]:leading-7 [&_p]:text-foreground",
        compact &&
          "text-foreground [&_p]:mb-0 [&_p]:font-heading [&_p]:text-xl [&_p]:font-medium [&_p]:leading-snug [&_p]:tracking-tight",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
