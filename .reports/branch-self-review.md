# Branch self-review — askmeatsack.com answering

**Date:** 2026-08-17  
**Scope:** working tree (there are no commits; `HEAD` does not exist, so merge-base review is empty)

## Diff stat

Uncommitted greenfield: `src/`, `specs/`, `.cursor/skills/askmeatsack/`, plan and config. No `.env` values in `.env.example`.

## Findings

### Critical

_None verified._

### Major

1. **Fixed in this close-out** — Opaque metadata was stored on create and omitted from `agentView` (`src/lib/sessions.ts`). Invariant: metadata is returned to the agent. Status now includes `metadata`; public view still omits it. Test: `src/lib/sessions.test.ts` (“Opaque metadata is returned to the agent and not to the human”).

### Minor

1. **Prompts and context are plain text in the answering page** (`src/app/s/[sessionId]/answering-form.tsx`). Spec invariant: prompts may be markdown. React escapes HTML (good for the raw-HTML rule) but does not render markdown. Recommend: leave until a later slice, or narrow the spec.

2. **MCP `status`/`wait`/`cancel` with the create key can act on any session id** (`src/lib/askmeatsack-tool.ts`). Same as HTTP GET with `AGENT_API_KEY`. Pattern, not a hole, if the create key is treated as operator-wide.

### Nitpick

1. Repo has no git history yet; this review cannot be scoped to committed changes.

## Counts

Critical 0 · Major 1 (fixed) · Minor 2 · Nitpick 1
