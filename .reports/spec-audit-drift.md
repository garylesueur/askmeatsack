# Spec drift — questionnaire-sessions-answering

**Date:** 2026-08-17  
**Spec:** `specs/questionnaire/sessions/answering.md`

## Behaviours

| ID | Badge | Verdict | Notes |
| --- | --- | --- | --- |
| B1 | 🟡 | Matches | Create/poll/wait/cancel/callback/MCP in. Email-on-create missing (blocked). |
| B2 | 🟢 | Matches | One-page answering UI. |
| B3 | 🟢 | Matches | Autosave on choose/type. |
| B4 | 🟢 | Matches | First save → `in_progress`. |
| B5 | 🟢 | Matches | Submit freeze; idempotent resubmit. |
| B6 | 🟢 | Matches | Required guards on API and submit disabled in UI. |
| B7 | 🟢 | Matches | Agent status after submit; tool matches HTTP. |
| B8 | 🟢 | Matches | Expiry, page, poll, read window. |
| B9 | 🟢 | Matches | Invalid options/text refused. |
| B10 | 🟡 | Matches | Tokens and create key. Email doorway not in. |
| B11 | 🟢 | Matches | Thank-you / submitted_view. |
| B12 | 🟢 | Matches | Unknown/wrong token. Badge was 🟡; raised — expired/cancelled screens exist. |
| B13 | 🟢 | Matches | Wait max 60s. |
| B14 | 🟢 | Matches | Opened POST from client; HTML GET does not call it. |
| B15 | 🟢 | Matches | Recommended marked, not preselected. |
| B16 | 🟢 | Matches | Text, choice, comment. |
| B17 | 🟢 | Matches | Cancel table. |
| B18 | 🟢 | Matches | Callback once on terminal; failure leaves status. |
| B19 | 🟢 | Matches | Download after submit only. |
| B20 | 🟢 | Matches | Skill file + create returns `answerUrl`. Email in the skill is specified; send is not built. |
| B21 | 🔵 | Matches | Not implemented; blocked on Resend terms. |

## Invariants

| Invariant | Verdict |
| --- | --- |
| Choice 2–8 options; text has none | Matches (`schema.ts`) |
| Required defaults yes | Matches |
| Freeze at submit/expiry/cancel | Matches |
| TTL 24h / max 7 days | Matches |
| One-hour read window then gone | Matches |
| Prompts may be markdown | **Drifted** — rendered as plain text. Spec is ahead. Recommend spec stay (future renderer) or drop “may be markdown” until shipped. **Code is incomplete relative to spec; do not treat as a product change.** |
| Raw HTML not rendered | Matches (React text) |
| Agent secret not in page/download | Matches (tests) |
| Metadata stored and returned to agent | **Was missing; fixed** — now on `agentView` |
| Tool named askmeatsack.com | Matches |
| Wait ≤ 60s | Matches |
| Opened only from running page | Matches |
| Text ≤ 2000 | Matches |
| Callback once per terminal | Matches |
| One email recipient | Unenforced (no email yet) |

## Flow

F1.T1–T15 and F2.T1–T12 implemented. F2.T13/T14 (send email) **Missing** — expected while B21 is 🔵.

No undeclared Slack posting path found.

## Unspecced

In-memory `globalThis` store and hosted MCP at `/mcp` are implementation, not extra product behaviours.

## Roll-up

Front-matter `partial` is still right (B1/B10 🟡, B21 🔵).
