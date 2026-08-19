# askmeatsack.com — repository instructions

**Domain:** askmeatsack.com

Greenfield project. Next.js App Router, TypeScript, Tailwind, pnpm. Merge gates live in `.engineering/config.yaml`.

## Commands

```bash
pnpm env         # Write .env.local from the Development item
pnpm dev         # Dev server (reads .env.local)
pnpm dev:op      # Dev server with Development secrets in-process, nothing on disk
pnpm env:op-items                     # Create the three 1Password items if missing
pnpm env:vercel [preview|production]  # Push tpl → Vercel (default: both)
pnpm env:vercel --var KEY --only-new  # One key, skip existing
pnpm typecheck   # TypeScript
pnpm lint        # ESLint
pnpm test        # Vitest
pnpm build       # Production build
```

1Password holds three items in the **Agents** vault (`mep374l3cpdtzwibf5fswsimbi`, override with `OP_VAULT`): `askmeatsack.com Development`, `askmeatsack.com Preview`, and `askmeatsack.com Production`. Same field names, different values. Local commands use the Development item only. Preview and Production are pushed to Vercel; they are not for a laptop. Marketplace KV on Vercel can still inject `KV_REST_API_*` for that environment; leave those fields empty in 1Password so sync does not overwrite them. Leave Development Redis empty to stay local. File uploads need R2 on the environment you are using (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). The app serves those files itself; `R2_PUBLIC_BASE_URL` is optional. `.env.development.tpl`, `.env.preview.tpl`, and `.env.production.tpl` hold `op://` references only. `.env.example` is the empty placeholder. Never print `.env` contents, never commit secrets.

On Vercel, Preview and Production already have Upstash. `AGENT_API_KEY` and R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) belong in the matching 1Password items and are pushed with `pnpm env:vercel`. Preview and Production should each have their own R2 bucket.

## What this is

An agent asks a human questions. Create returns an askmeatsack.com link for the conversation (skill does that inline). Humans answer in the browser. Posting that same link to Slack, email, or anywhere else is the calling agent’s job.

Always call the product **askmeatsack.com** in user-facing copy. The agent tool is named `askmeatsack.com`. Answer links are `https://askmeatsack.com/…`.

## Where things live

- `.engineering/config.yaml` is the contract calm-craft skills read — paths, gates, tickets. Re-run `engineering-setup` after the toolchain lands.
- Specs live in `specs/`. Format: `specs/README.md`. Start with `specs/questionnaire/sessions/answering.md` for the product.
- Conventions will live in `.engineering/conventions.yaml` once `conventions-decide` has been run. Do not invent a parallel rule list here.
- calm-craft is vendored as a submodule at `.agents/plugins/calm-craft`.
- The askmeatsack skill is `skills/askmeatsack/SKILL.md` — **the single source of truth** (create → inspect/edit on manageUrl → paste answerUrl → wait, or one unique questionnaire per person from an unattended job). Edit that file, then run `pnpm sync:skill`, which regenerates `.cursor/skills/askmeatsack/SKILL.md` and `src/lib/askmeatsack-skill.ts`. Never edit either generated file; `pnpm test` fails if they drift. The generated constant is what the site serves at `/skill.md` and what the MCP server sends as its `instructions`.
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
