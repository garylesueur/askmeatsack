# askmeatsack.com

**An agent asks. A human answers.**

An agent creates a questionnaire and gets a link. A person opens that link in a
browser, answers, and the answers come back to the agent as structured JSON. No
accounts, no API key for the person answering, nothing to install.

Posting the link to Slack, email, or anywhere else is the calling agent's job.

Sibling project: [showmeatsack.com](https://github.com/garylesueur/showmeatsack) —
an agent posts a page, a person opens it.

## Quick start

```bash
pnpm install
pnpm env      # writes .env.local from the 1Password Development item
pnpm dev
```

No 1Password access? `cp .env.example .env.local` gets you a working local
server. Leave Redis empty to stay on in-memory stores; file uploads need R2.

## Commands

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server, reads `.env.local` |
| `pnpm dev:op` | Dev server with secrets in-process, nothing written to disk |
| `pnpm env` | Write `.env.local` from the Development item |
| `pnpm env:op-items` | Create the three 1Password items if missing |
| `pnpm env:vercel [preview\|production]` | Push template → Vercel (default: both) |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm build` | Production build |

`pnpm typecheck`, `pnpm lint`, and `pnpm test` are the merge gates — see
`.engineering/config.yaml`.

## Secrets

Three 1Password items live in the **Agents** vault: `askmeatsack.com
Development`, `askmeatsack.com Preview`, and `askmeatsack.com Production`. Same
field names, different values. Local work uses Development only; Preview and
Production are pushed to Vercel and are not for a laptop.

`.env.development.tpl`, `.env.preview.tpl`, and `.env.production.tpl` hold
`op://` references only. `.env.example` is the empty placeholder. Never print
`.env` contents and never commit secrets.

## Where things live

| Path | What |
| --- | --- |
| `specs/` | Product intent. Start at `specs/questionnaire/sessions/answering.md` |
| `src/app/api/v1/sessions/` | The HTTP API |
| `src/app/mcp/` | The MCP server |
| `src/app/s/[sessionId]/` | The page a person actually answers on |
| `src/lib/sessions.ts` | Session service — creation, answering, submission |
| `.engineering/config.yaml` | Toolchain contract that calm-craft skills read |
| `skills/askmeatsack/` | The skill — **the source of truth**, edit this one |
| `.cursor/skills/askmeatsack/` | Generated copy for Cursor (`pnpm sync:skill`) |
| `src/lib/askmeatsack-skill.ts` | Generated constant the site and MCP serve |

## calm-craft

This repository is built with [calm-craft](https://github.com/calmtechltd/calm-craft),
our own MIT-licensed [Agent Plugin](https://agent-plugins.org/). It is vendored
as a submodule at `.agents/plugins/calm-craft`:

```bash
git submodule update --init --recursive
```

**What it is.** Three things that make coding agents produce work you can trust:
specs as an addressable source of truth, a delivery loop that plans and then
executes one reviewable chunk at a time, and code conventions decided once and
enforced by lint wherever a machine can enforce them.

**Why we use it.** Most of the code here is written by agents, and an agent with
no fixed source of truth will happily invent one. Specs in `specs/` are that
fixed point — they outlive any single session, so a change three weeks from now
starts from what the product is meant to do rather than from whatever the last
diff happened to leave behind. The separation it defends matters just as much:
auditors report and never edit, planning is not allowed to double as execution,
and one chunk is finished and verified before the next one starts. Those
boundaries are easy to collapse and expensive to lose.

It also happens to be ours, so every public repo we ship is a repo we are
running our own tooling on.

`.engineering/config.yaml` is the contract every calm-craft skill reads — paths,
gates, branch, ticket provider. Skills stay portable; this repo's specifics stay
in config we own, so updating the plugin never clobbers our choices.

> Not yet run here: `conventions-decide`, which writes
> `.engineering/conventions.yaml`. Until then this repo has no recorded
> convention decisions, and `paths.conventions` points at a file that does not
> exist.

## Install

This repository is itself an [Agent Plugin](https://agent-plugins.org/) — the
open standard for packaging agent tooling: `plugin.json`, `mcp.json`, and
`skills/` in one installable unit. `.mcp.json` exists for
[cursor.directory](https://cursor.directory/plugins/new) detection.

**Install the plugin.** This is the one you want. The plugin carries the MCP
server *and* `skills/askmeatsack/SKILL.md`, so your agent gets the tool and the
instructions for when to reach for it:

```text
https://github.com/garylesueur/askmeatsack
```

**Or install the MCP server on its own** at `https://askmeatsack.com/mcp`. The
tool works, and the server sends the same skill as its MCP `instructions`, so
most clients still get the full brief. Clients that ignore `instructions` see
only the tool description — prefer the plugin where you can.

## Licence

MIT — see [LICENSE](LICENSE).

Built by [Gary Le Sueur](https://gaz.dev).
