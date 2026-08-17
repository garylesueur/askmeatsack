# askmeatsack.com — repository instructions

**Domain:** askmeatsack.com

Greenfield project. Next.js App Router, TypeScript, Tailwind, pnpm. Merge gates live in `.engineering/config.yaml`.

## Commands

```bash
pnpm dev         # Dev server
pnpm typecheck   # TypeScript
pnpm lint        # ESLint
pnpm test        # Vitest
pnpm build       # Production build
```

Copy `.env.example` to `.env.local`. Never print `.env` contents, never commit secrets.

## What this is

An agent asks a human questions. Create returns an askmeatsack.com link for the conversation (skill does that inline). The agent can also email the link to someone else and wait. Humans answer in the browser. Posting that same link to Slack or anywhere else is the calling agent’s job.

Always call the product **askmeatsack.com** in user-facing copy. The agent tool is named `askmeatsack.com`. Answer links are `https://askmeatsack.com/…`.

## Where things live

- `.engineering/config.yaml` is the contract calm-craft skills read — paths, gates, tickets. Re-run `engineering-setup` after the toolchain lands.
- Specs live in `specs/`. Format: `specs/README.md`. Start with `specs/questionnaire/sessions/answering.md` for the product.
- Conventions will live in `.engineering/conventions.yaml` once `conventions-decide` has been run. Do not invent a parallel rule list here.
- calm-craft is vendored as a submodule at `.agents/plugins/calm-craft`.
- The askmeatsack skill is `.cursor/skills/askmeatsack/SKILL.md` (inline create → paste link → wait, or email → wait). The same instructions ship as the Agent Plugin skill at `skills/askmeatsack/SKILL.md`.
- The repository root is an [Agent Plugin](https://agent-plugins.org/): `plugin.json`, `mcp.json`, and `skills/`. `.mcp.json` is for [cursor.directory](https://cursor.directory/plugins/new) detection.
- Implementation plans and review reports go in `.plans/` and `.reports/` (gitignored).

## Repository operations

- Do not commit, push, create a branch, or open a pull request unless explicitly asked.
- Preserve unrelated user changes in a dirty worktree.
- Prefer non-destructive and non-interactive commands.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
