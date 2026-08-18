import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Nav and footer, shared by both meatsack products.
 *
 * `site/home.md` makes it an invariant that the two home pages are the same
 * structure — only the accent and the words differ. Keeping this file
 * byte-identical in both repos is how that stays true: drift shows up as a
 * diff rather than as two pages that slowly stop looking related.
 */

export type SiblingSite = {
  /** The other product's domain, shown in the nav pill. */
  name: string;
  href: string;
};

export type SiteChromeProps = {
  /** This product's domain. Doubles as the wordmark. */
  wordmark: string;
  sibling: SiblingSite;
  repoHref: string;
  /** Agent-facing documents, linked from the footer rather than the hero. */
  docs: { label: string; href: string }[];
  accountHref?: string;
};

const AUTHOR = { name: "Gary Le Sueur", href: "https://gaz.dev" };

function GitHubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className="size-[15px] shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function SiteNav({
  wordmark,
  sibling,
  repoHref,
  accountHref,
}: Omit<SiteChromeProps, "docs">) {
  return (
    <nav className="flex items-center gap-5 border-b border-border py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
      >
        <span
          aria-hidden="true"
          className="size-[7px] shrink-0 rounded-full bg-primary"
        />
        {wordmark}
      </Link>

      <div className="ml-auto flex items-center gap-4 text-[13px] sm:gap-5">
        <a
          href={sibling.href}
          className="hidden rounded-full border border-border bg-card px-3 py-1 text-muted-foreground transition-colors hover:border-primary hover:text-foreground sm:inline-flex sm:items-center sm:gap-1.5"
        >
          {sibling.name}
          <span aria-hidden="true">&rarr;</span>
        </a>
        <a
          href={repoHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <GitHubMark />
          <span className="hidden sm:inline">GitHub</span>
        </a>
        <a
          href={AUTHOR.href}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          gaz.dev
        </a>
        {accountHref ? (
          <a
            href={accountHref}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </a>
        ) : null}
      </div>
    </nav>
  );
}

export function SiteFooter({
  sibling,
  repoHref,
  docs,
}: Omit<SiteChromeProps, "wordmark" | "accountHref">) {
  return (
    <footer className="mt-24 flex flex-wrap items-baseline gap-x-7 gap-y-3 border-t border-border pt-9 pb-14 text-[13px] text-muted-foreground">
      <span>
        Built by{" "}
        <a
          href={AUTHOR.href}
          target="_blank"
          rel="noreferrer"
          className="text-foreground/80 transition-colors hover:text-primary"
        >
          {AUTHOR.name}
        </a>
      </span>
      <span className="ml-auto flex flex-wrap gap-x-4 gap-y-2">
        <a
          href={repoHref}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-primary"
        >
          GitHub
        </a>
        <a href={sibling.href} className="transition-colors hover:text-primary">
          {sibling.name}
        </a>
        {docs.map((doc) => (
          <a
            key={doc.href}
            href={doc.href}
            className="transition-colors hover:text-primary"
          >
            {doc.label}
          </a>
        ))}
      </span>
    </footer>
  );
}

export function SiteShell({
  children,
  ...chrome
}: SiteChromeProps & { children: ReactNode }) {
  const { wordmark, sibling, repoHref, docs, accountHref } = chrome;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 sm:px-8">
      <SiteNav
        wordmark={wordmark}
        sibling={sibling}
        repoHref={repoHref}
        accountHref={accountHref}
      />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter sibling={sibling} repoHref={repoHref} docs={docs} />
    </div>
  );
}
