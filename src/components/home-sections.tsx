import type { ReactNode } from "react";

/**
 * The three sections both home pages share: the seam, the sequence, and the
 * use cases. Content comes in as props — the shape lives here so the two
 * products cannot drift apart, per the invariant in `site/home.md`.
 */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-7 border-b border-border pb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </h2>
  );
}

export type SeamProps = {
  /** What the agent sends. Monospace, on the cold panel. */
  agent: ReactNode;
  /** What the person sees. On the warm panel. */
  person: ReactNode;
  personLabel: string;
  wireLabel: string;
};

/**
 * The one animated moment on the page: a link travels out to the person and an
 * answer comes back. On narrow screens the panels stack and the same wire runs
 * vertically, so the two halves are never touching.
 */
export function Seam({ agent, person, personLabel, wireLabel }: SeamProps) {
  return (
    <div className="mt-16 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
      <section className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-machine-rule bg-machine text-machine-foreground shadow-sm">
        <header className="flex items-center gap-2 border-b border-machine-rule bg-machine-raised px-4 py-3 font-mono text-[11px] uppercase tracking-[0.13em] text-machine-muted">
          <Dots className="bg-machine-rule" />
          the agent
        </header>
        <div className="flex-1 overflow-x-auto whitespace-pre px-4 py-5 font-mono text-[12.5px] leading-[1.75]">
          {agent}
        </div>
      </section>

      <Wire label={wireLabel} />

      <section className="flex min-h-[300px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <header className="flex items-center gap-2 border-b border-border bg-muted px-4 py-3 font-mono text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
          <Dots className="bg-border" />
          {personLabel}
        </header>
        <div className="flex-1 p-5">{person}</div>
      </section>
    </div>
  );
}

function Dots({ className }: { className: string }) {
  return (
    <span className="inline-flex gap-[5px]" aria-hidden="true">
      {[0, 1, 2].map((n) => (
        <span key={n} className={`block size-2 rounded-full ${className}`} />
      ))}
    </span>
  );
}

function Wire({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      className="relative h-16 w-auto lg:h-auto lg:w-[72px]"
    >
      <span className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent lg:inset-x-0 lg:left-0 lg:top-1/2 lg:bottom-auto lg:h-px lg:w-full lg:bg-gradient-to-r" />
      <span className="meatsack-pulse absolute size-[9px] rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_22%,transparent)]" />
      <span className="absolute left-[calc(50%+18px)] top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground lg:left-1/2 lg:top-[calc(50%-26px)] lg:-translate-x-1/2 lg:translate-y-0">
        {label}
      </span>
    </div>
  );
}

export type Step = { n: string; heading: string; body: string };

/** Numbered because it genuinely is a sequence; the rule above each fades out. */
export function Steps({ steps }: { steps: Step[] }) {
  const fade = ["border-t-primary", "border-t-primary/55", "border-t-border"];
  return (
    <div className="grid gap-7 md:grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.n}
          className={`border-t-2 pt-5 ${fade[index] ?? "border-t-border"}`}
        >
          <span className="mb-2 block font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
            {step.n}
          </span>
          <h3 className="mb-1.5 text-[15px] font-semibold tracking-tight">
            {step.heading}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export type UseCase = {
  tag: string;
  heading: string;
  body: string;
  quote?: string;
};

export function UseCases({ cases }: { cases: UseCase[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cases.map((item) => (
        <article
          key={item.heading}
          className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md motion-reduce:hover:translate-y-0"
        >
          <span className="font-mono text-[10.5px] uppercase tracking-[0.13em] text-primary">
            {item.tag}
          </span>
          <h3 className="text-[15px] font-semibold tracking-tight">
            {item.heading}
          </h3>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            {item.body}
          </p>
          {item.quote ? (
            <p className="mt-1 border-l-2 border-border pl-3 text-[12.5px] text-muted-foreground/80">
              {item.quote}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
