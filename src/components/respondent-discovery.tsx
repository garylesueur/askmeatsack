import { Button } from "@/components/ui/button";

/** Generic discovery only: never accept questionnaire data or capability links. */
export function RespondentDiscovery() {
  return (
    <nav aria-label="Ask someone else" className="text-sm">
      <details className="group">
        <summary className="w-fit cursor-pointer rounded-sm py-2 font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          Ask someone else
        </summary>
        <div className="mt-2 space-y-3">
          <p>
            Connect ask.imeatsack.com to your existing agent, then sign in to your own account when
            asked. Ask your agent to create a separate questionnaire for each person.
          </p>
          <p className="text-muted-foreground">
            This does not copy your answers, files or the context behind this questionnaire. Your
            agent creates a new answer link; keep this one for your own response.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <a
              href="/install"
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Connect your agent
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
        </div>
      </details>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="mt-2 inline-block rounded-sm py-2 text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        About ask.imeatsack.com
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </nav>
  );
}
