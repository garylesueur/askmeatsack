import { HomeLanding } from "@/app/home-landing";
import { cursorInstallPageHref } from "@/lib/cursor-install";
import { publicOrigin } from "@/lib/public-origin";

export default function Home() {
  const origin = publicOrigin();
  const mcpUrl = `${origin}/mcp`;
  const createUrl = `${origin}/api/v1/sessions`;
  const cursorHref = cursorInstallPageHref(mcpUrl);
  const curl = `curl -sS ${createUrl} \\
  -H 'content-type: application/json' \\
  -d '{
    "title": "Quick check",
    "questions": [{
      "id": "Q1",
      "prompt": "Ship it?",
      "options": [
        {"id": "yes", "label": "Yes"},
        {"id": "no", "label": "Not yet"}
      ]
    }]
  }'`;

  return (
    <div className="flex flex-1 flex-col px-6 py-16 sm:px-10 sm:py-24">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">askmeatsack.com</p>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            An agent asks. A human answers.
          </h1>
          <p className="max-w-md text-base leading-7 text-muted-foreground">
            Create a questionnaire, paste the link, wait. No accounts. No API
            key.
          </p>
        </header>

        <HomeLanding
          mcpUrl={mcpUrl}
          cursorHref={cursorHref}
          curl={curl}
          skillHref={`${origin}/skill.md`}
          guideHref={`${origin}/mcp.md`}
        />
      </main>
    </div>
  );
}
