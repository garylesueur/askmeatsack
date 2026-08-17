"use client";

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

function pageIsDark(): boolean {
  const root = document.documentElement;
  if (root.classList.contains("light")) {
    return false;
  }
  if (root.classList.contains("dark")) {
    return true;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      setDark(pageIsDark());
    };
    update();
    mq.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "neutral",
    });
    void mermaid
      .render(`mermaid-${reactId}`, chart)
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chart, reactId, dark]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
        {chart}
      </pre>
    );
  }

  if (!svg) {
    return <p className="text-sm text-muted-foreground">Drawing diagram…</p>;
  }

  return (
    <div
      className="mt-3 overflow-x-auto rounded-lg bg-background/80 p-3 [&_svg]:mx-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
