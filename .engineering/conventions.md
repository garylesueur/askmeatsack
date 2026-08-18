# Conventions

Generated from `.engineering/conventions.yaml`. Change the decision there, not
this file.

This covers only what a machine cannot enforce. Everything else is a rule that
fails the build, listed at the bottom so you know it exists rather than so you
have to remember it.

## What you have to hold in your head

**Files around 800 lines.** A guideline, deliberately not a lint rule. `sessions.ts`
is 1,349 lines and has a reason to be — it holds the whole session lifecycle.
The number exists so the next large file gets a conversation, not so a build
fails on a file nobody has a better shape for.

**Named exports, except where the framework has no choice.** 400 named to 13
default across the estate, and all 13 are Next.js pages, layouts or routes. Not
linted, because the carve-out for exactly those files would be longer than the
convention it protects.

**Tests sit next to what they cover.** Already true of every test here. Nothing
lints it because a test in the wrong place is visible in review.

## What the machine already stops you doing

You do not need to remember these. They fail.

| Rule                                 | Where                                                          |
| ------------------------------------ | -------------------------------------------------------------- |
| No `any`                             | `@typescript-eslint/no-explicit-any`, via `eslint-config-next` |
| `type`, never `interface`            | `no-restricted-syntax`, `eslint.config.mjs`                    |
| No `@/` imports inside `src/lib`     | `no-restricted-imports`, `eslint.config.mjs`                   |
| Formatting                           | `oxfmt`, `.oxfmtrc.json`                                       |
| No package published in the last day | `minimumReleaseAge`, `pnpm-workspace.yaml`                     |

Two of those are worth a sentence, because the reason is not obvious from the
rule:

**Why `src/lib` may not use the alias.** Inside `src/lib`, a relative import
means "same layer". Reaching for `@/` means crossing one. Allowing the alias in
both places hides a boundary that does not exist. `src/app` is deliberately
unrestricted — reaching into `lib` is exactly what the alias is for.

**Why a one-day cooldown and not a week.** A compromised release is usually
caught within hours, so a day blocks most supply-chain attacks. A week would
sit on security patches at exactly the moment you want them quickly.
