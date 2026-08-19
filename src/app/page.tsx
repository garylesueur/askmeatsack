import { CurlBlock, HomeLanding } from "@/app/home-landing";
import { AGENT_SAMPLE, HERO, SEAM_QUESTION, USE_CASES } from "@/app/home-content";
import { SectionLabel, Seam, Steps, UseCases } from "@/components/home-sections";
import { SiteShell } from "@/components/site-chrome";
import { SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/agent-docs";
import { CURSOR_PLUGIN_HREF, cursorInstallPageHref } from "@/lib/cursor-install";
import { publicOrigin } from "@/lib/public-origin";

const SIBLING = {
  name: "showmeatsack.com",
  href: "https://showmeatsack.com",
};

export default function Home() {
  const origin = publicOrigin();
  const mcpUrl = `${origin}/mcp`;
  const createUrl = `${origin}/api/v1/sessions`;
  const curl = `curl -sS ${createUrl} \\
  -H 'content-type: application/json' \\
  -d '{
    "title": "Quick check",
    "questions": [{
      "id": "Q1",
      "prompt": "Ship it?",
      "options": [
        {"id": "yes", "label": "Yes"},
        {"id": "no",  "label": "Not yet"}
      ]
    }]
  }'`;

  return (
    <SiteShell
      wordmark="askmeatsack.com"
      sibling={SIBLING}
      repoHref={CURSOR_PLUGIN_HREF}
      docs={[
        { label: "skill.md", href: `${origin}/skill.md` },
        { label: "mcp.md", href: `${origin}/mcp.md` },
        { label: "llms.txt", href: "/llms.txt" },
      ]}
    >
      <header className="pt-16 sm:pt-20">
        <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {HERO.eyebrow}
        </p>
        <h1 className="max-w-[15ch] font-heading text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] text-balance text-foreground sm:text-6xl">
          {SITE_TAGLINE}
        </h1>
        <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
          {SITE_DESCRIPTION}
        </p>

        <HomeLanding
          mcpUrl={mcpUrl}
          cursorHref={cursorInstallPageHref(mcpUrl)}
          pluginHref={CURSOR_PLUGIN_HREF}
        />

        <Seam
          wireLabel="one link"
          personLabel="the person"
          agent={AGENT_SAMPLE.map(([className, text], index) => (
            <span key={index} className={className}>
              {text}
            </span>
          ))}
          person={
            <>
              <p className="mb-1 text-[15px] font-semibold tracking-tight">{SEAM_QUESTION.title}</p>
              <p className="mb-4 text-sm text-muted-foreground">{SEAM_QUESTION.prompt}</p>
              {SEAM_QUESTION.options.map((option) => {
                const picked = option.id === SEAM_QUESTION.picked;
                return (
                  <div
                    key={option.id}
                    className={`mb-2 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                      picked ? "border-primary bg-primary/[0.07]" : "border-border bg-background"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`relative size-[15px] shrink-0 rounded-full border-[1.5px] ${
                        picked ? "border-primary" : "border-muted-foreground"
                      }`}
                    >
                      {picked ? (
                        <span className="absolute inset-[3px] rounded-full bg-primary" />
                      ) : null}
                    </span>
                    {option.label}
                  </div>
                );
              })}
            </>
          }
        />
      </header>

      <section className="pt-20 sm:pt-24">
        <SectionLabel>How it goes</SectionLabel>
        <Steps steps={HERO.steps} />
      </section>

      <section className="pt-20 sm:pt-24">
        <SectionLabel>What people use it for</SectionLabel>
        <UseCases cases={USE_CASES} />
      </section>

      <section className="pt-20 sm:pt-24">
        <SectionLabel>Or just curl it</SectionLabel>
        <CurlBlock endpoint="POST /api/v1/sessions" curl={curl} />
      </section>
    </SiteShell>
  );
}
