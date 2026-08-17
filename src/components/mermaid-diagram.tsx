"use client";

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

let mermaidReady = false;

function ensureMermaid() {
  if (mermaidReady) {
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "neutral",
  });
  mermaidReady = true;
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureMermaid();
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
  }, [chart, reactId]);

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
      className="overflow-x-auto py-1 [&_svg]:mx-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
