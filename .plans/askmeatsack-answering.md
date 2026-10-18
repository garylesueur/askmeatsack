# askmeatsack.com — implementation plan

**Spec:** `specs/questionnaire/sessions/answering.md`  
**Flow:** `specs/questionnaire/sessions/answering.flow.yaml`  
**How to use:** Implement exactly one chunk per session (`run-implementation-plan`). Do not skip Depends on.

**Next up:** _none — plan complete (E1 was the last blocked card)_

---

## Restate

- An agent creates a questionnaire and always gets an askmeatsack.com answer URL plus a status URL.
- A human opens the answer URL, answers on one page, submits once; answers freeze.
- The agent waits via status, a bounded wait, or a callback.
- Email is a delivery this service owns. Slack and other chats are the calling agent posting the URL we already return.
- Tool name is `askmeatsack.com`. HTTP matches the tool. No accounts.

## Strategy

**Foundation then UI**, then vertical slices. One foundation chunk so the app boots; from B3 the human can complete a questionnaire in the running app.

## Phases

- **A** — App boots as askmeatsack.com. Outcome: `pnpm dev` serves a named placeholder.
- **B** — Create, answer, submit. Outcome: curl creates a session; a browser can submit answers; poll shows `submitted`.
- **C** — Opened, expiry, cancel, download, text and recommended. Outcome: the lifecycle table is true in the running app.
- **D** — Bounded wait, callback, MCP tool. Outcome: an agent can wait without curling by hand.
- **E** — Email and skill. Outcome: mail sends the same link; the skill tells an agent to create, paste, wait.

## Chunks

### A1 — Scaffold the Next.js app

- **Depends on:** none
- **Spec(s):** none (foundation). Product name from AGENTS.md / spec intro.
- **Work:** Next.js App Router, TypeScript, Tailwind, pnpm. Keep existing `AGENTS.md`, specs, calm-craft submodule. `.env.example` with `AGENT_API_KEY` and `PUBLIC_BASE_URL`. Merge `.gitignore` for Next.js. Fill `.engineering/config.yaml` commands from what actually runs. Placeholder home page that says askmeatsack.com.
- **Done when:** `pnpm typecheck` passes. `pnpm dev` shows an askmeatsack.com page in the browser. No session API yet.
- **Out of scope:** sessions, Zod questionnaire schemas, answering UI, MCP, email, KV.
- **Status:** complete 2026-08-16 — Next.js 16 app boots; typecheck and lint pass; home page is askmeatsack.com.

### B1 — Create a session and poll status

- **Depends on:** A1
- **Spec(s):** B1, B4 (pending only), B7 (shape, not submitted yet), B10 (create credential vs tokens), B12. F2.T1, F2.T2.
- **Work:** Zod create schema (choice questions for now). Object-factory session store (in-memory for local). `POST /api/v1/sessions` (Bearer `AGENT_API_KEY`). `GET /api/v1/sessions/:id` with agent token. Returns `sessionId`, `answerUrl`, `pollUrl`, `expiresAt`, `status: pending`. Errors `{ error: { code, message } }`. Unique question ids; at least one question; choice questions 2–8 options.
- **Done when:** curl without a key is refused. curl with a key returns two URLs. GET with the agent token shows `pending` and empty answers. GET with a junk token does not leak another session.
- **Out of scope:** PATCH answers, submit, UI, email, wait, callback, MCP, text questions.
- **Status:** complete 2026-08-16 — POST create and GET poll; tests for F2.T1, F2.T2, B10, B12.

### B2 — Save answers and submit

- **Depends on:** B1
- **Spec(s):** B3, B5, B6, B9, B10 (public token). Saving and Submit tables. F1.T5–T8 (API side).
- **Work:** `PATCH .../answers/:questionId` (public token). `POST .../submit` (public token). First save → `in_progress`. Submit requires required questions. Idempotent re-submit. Invalid option ids refused; previous answers unchanged.
- **Done when:** tests cover both branches of save and submit guards. curl: answer one, poll shows progress; submit without required fails; submit with all required → `submitted`; second submit succeeds with the same answers.
- **Out of scope:** UI, expiry, cancel, opened, download, email.
- **Status:** complete 2026-08-16 — PATCH save, POST submit, freeze, idempotent resubmit; F1.T5–T8 tested.

### B3 — Answering page

- **Depends on:** B2
- **Spec(s):** B2, B3, B5, B6, B11, B12. F1.T1–T4, T5, T7, T8, T10.
- **Work:** `/s/[sessionId]?t=` public token. One scrollable page, title, context, large choice targets, progress “n of m”, autosave on choose, submit disabled until required done, thank-you after submit, expired/unknown/already-submitted screens. Agent token never in the page.
- **Done when:** In the running app: create via curl, open `answerUrl`, pick options, see Saved, submit, see thank-you, reopen shows finished not the form.
- **Out of scope:** text questions, recommended badge, cancel button, download, opened ping, email.
- **Status:** complete 2026-08-16 — `/s/[sessionId]` answering page; autosave; thank-you; reopen finished; unknown link.

### C1 — Opened signal

- **Depends on:** B3
- **Spec(s):** B14. F1.T12.
- **Work:** Page running in a browser notifies opened (not the HTML GET). Status shows opened time; still `pending` until a save.
- **Done when:** Fetching `answerUrl` as a bare GET does not set opened. Loading the page in a browser does. Poll still `pending` with no answers.
- **Out of scope:** flipping `in_progress` on open.
- **Status:** complete 2026-08-16 — POST opened from the answering page; HTML GET does not set it; poll stays pending.

### C2 — Expiry

- **Depends on:** B2
- **Spec(s):** B8. F1.T3, F1.T9. F2.T4.
- **Work:** Past `expiresAt`, PATCH/submit refused; page explains expired; agent status is `expired` with partial answers; readable one hour then gone.
- **Done when:** A session with a short TTL cannot be answered after expiry; poll shows `expired` and any saved answers.
- **Out of scope:** cancel, email.
- **Status:** complete 2026-08-16 — Past expiry, PATCH/submit refused; page shows expired; poll is `expired` with saved answers; gone after one hour.

### C3 — Cancel

- **Depends on:** B2
- **Spec(s):** B17. Cancel table (refuse after submit/expire; idempotent if already cancelled). F1.T11, F1.T15. F2.T6, F2.T11, F2.T12.
- **Work:** Human cancel on the page; agent cancel on status. Answers freeze. Follow the **decision table**, not the contradictory sentence in B17.
- **Done when:** Cancel while open → `cancelled`. Cancel again → still `cancelled`. Cancel after submit → refused, still `submitted`.
- **Out of scope:** email, callback.
- **Status:** complete 2026-08-16 — Human and agent cancel while open; idempotent if already cancelled; refused after submit or expiry.

### C4 — Download and richer questions

- **Depends on:** B3
- **Spec(s):** B15, B16, B19. F1.T13, F1.T14.
- **Work:** Text questions, choice+comment, recommended mark. JSON download on thank-you / already-submitted only. No agent secret in the file.
- **Done when:** A mixed questionnaire renders; recommended is marked not preselected; after submit the human can download JSON with labels and ids.
- **Out of scope:** email, MCP.
- **Status:** complete 2026-08-16 — Text, choice+comment, recommended mark; JSON download after submit only.

### D1 — Bounded wait

- **Depends on:** B2
- **Spec(s):** B13. F2.T7–T10. Wait table. Max 60 seconds per call.
- **Work:** Wait endpoint/tool action. Returns terminal status inside the bound, or current progress when the bound ends. Over-max refused.
- **Done when:** Wait 2s on an open session returns still-open. Submit during wait → wait returns `submitted`.
- **Out of scope:** MCP wrapper, callback, email.
- **Status:** complete 2026-08-16 — POST wait, max 60s; returns terminal inside the bound or current progress; over-max refused.

### D2 — Callback

- **Depends on:** B2
- **Spec(s):** B18.
- **Work:** Optional `callbackUrl` on create. POST once on `submitted` / `expired` / `cancelled`. Failure does not undo status.
- **Done when:** A test HTTP listener receives one body on submit; a failing callback still leaves the session `submitted`.
- **Out of scope:** retry storms, MCP.
- **Status:** complete 2026-08-16 — Optional callbackUrl; POST once on submitted/expired/cancelled; failure leaves status.

### D3 — askmeatsack.com tool

- **Depends on:** D1, B1
- **Spec(s):** B1, B7, B13, B20 (tool name). Invariant: tool and HTTP equivalent.
- **Work:** Hosted MCP (Streamable HTTP). One tool named `askmeatsack.com` with actions for create, status, wait, cancel (email later). Same Zod as HTTP.
- **Done when:** An MCP client can create and read status without using curl. HTTP still works.
- **Out of scope:** email action (E1), skill file (E2).
- **Status:** complete 2026-08-16 — Hosted MCP at `/mcp`; one tool named askmeatsack.com with create, status, wait, cancel; HTTP create still works.

### E1 — Email

- **Depends on:** B1
- **Spec(s):** B21. Email table. F2.T13, F2.T14.
- **Work:** Send/resend while open, from askmeatsack.com, one recipient. Failure does not delete the session. Agent can see send failed.
- **Done when:** Create with a valid address attempts send; invalid address refused; failed provider still returns `answerUrl`.
- **Out of scope:** Slack, multiple recipients, MCP email action unless it is the same as HTTP.
- **Status:** complete 2026-08-17 — Resend provisioned; send/resend while open; invalid address refused; provider failure keeps `answerUrl`.

### E2 — Skill

- **Depends on:** D3, B3
- **Spec(s):** B20.
- **Work:** Repo skill: when the agent needs structured answers, call askmeatsack.com, paste the link in the conversation, wait. Email path when the person is not in the conversation.
- **Done when:** Skill file exists and matches B20/B21. No Slack posting instructions as a service feature.
- **Out of scope:** wiring secrets in other repos.
- **Status:** complete 2026-08-17 — `.cursor/skills/askmeatsack/SKILL.md`: create, paste `answerUrl`, wait; email path for someone not in the conversation; no Slack-as-a-service.

## Order

A1 → B1 → B2 → B3 → (C1, C2, C3, C4 in any order after their deps) → D1 → D2 → D3 → E1 → E2

**After B3:** a human can finish a questionnaire in the browser. That is the first demo.

## Open decisions

| Topic | Status |
| --- | --- |
| Slack / chat posting | Settled: not this service. Agent posts the URL. |
| Cancel after submit/expire | Settled: refuse; keep existing terminal status (decision table wins over B17 prose). |
| Create “usable questions” | Settled for executors: ≥1 question, unique ids, choice 2–8 options. |
| Tool shape | One tool `askmeatsack.com` with an action; D3 must not invent extra tool names. |

## Checklist per chunk

- [ ] Depends on complete
- [ ] Tests for cited transitions/guards where there is a test surface
- [ ] Spec badges via `spec-maintain-on-ship` for shipped behaviours
- [ ] Plan status line dated; Next up advanced
- [ ] Next chunk not started
