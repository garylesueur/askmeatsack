# Agent Questionnaire Service — Product & Implementation Spec

**Purpose:** A small hosted service that replaces Cursor Desktop’s native `AskQuestion` UI for **Cloud Agents** and any other agent that can `POST` JSON and poll an HTTP endpoint.

**Deploy target:** Vercel (Next.js App Router or similar).

**Primary users:**

1. **Agent** — creates a session, shares a URL with the human, polls until `submitted` (or `expired`), consumes structured answers.

2. **Human** — opens one URL, answers all questions in a browser, submits once (with optional per-question autosave for progress visibility).

---

## Problem

Cloud Agents do not expose Cursor’s blocking `AskQuestion` tool. Agents fall back to plain chat. For decision-heavy work (12+ multiple-choice product questions), humans need:

- One link to answer everything in one sitting

- Structured answers the agent can parse reliably

- Optional visibility of **partial progress** while the human is still on the page

- A clear **terminal state** `submitted`, `expired`, `cancelled`) so the agent knows when to stop polling

---

## Non-goals (v1)

- Authentication / user accounts

- Integration with Cursor product APIs

- Free-text questions (v1 is **multiple-choice only**; extensible later)

- Real-time WebSockets (polling is sufficient)

- Long-term archival of answers (sessions are ephemeral; TTL + delete)

---

## Core flows

### Flow A — Agent creates session

1. Agent `POST /api/v1/sessions` with title + questions array.

2. Service returns:

   - `sessionId`

   - `answerUrl` — HTTPS link for the human (includes public token)

   - `pollUrl` — HTTPS URL for agent status polling (includes agent secret)

   - `expiresAt` — ISO timestamp

3. Agent posts `answerUrl` in chat (or PR comment): “Answer here: …”

### Flow B — Human answers

1. Human opens `answerUrl` in any browser.

2. UI shows all questions on one scrollable page (or stepped wizard — **single page preferred for v1**).

3. On each selection, UI **autosaves** that question (PATCH) so agent polling can show progress.

4. Human clicks **Submit all** → session status becomes `submitted`; further edits blocked (or allowed until agent ack — see lifecycle).

5. Optional **Save draft & close** without submitting (status stays `in_progress`).

### Flow C — Agent polls

1. Agent loops: `GET pollUrl` every **3–5 seconds** (back off to 10s after 2 minutes).

2. Response includes:

   - `status`: `pending` | `in_progress` | `submitted` | `expired` | `cancelled`

   - `progress`: `{ answeredCount, totalCount, questionIdsAnswered[] }`

   - `answers`: map of `questionId → { selectedOptionIds, answeredAt }` (partial OK before submit)

3. When `status === 'submitted'`, agent reads `answers`, stops polling, continues work.

4. When `status === 'expired'`, agent tells human link expired; offer to create new session.

---

## Session lifecycle

| Status | Meaning |

| --- | --- |

| `pending` | Created; human has not opened URL (optional; may skip straight to `in_progress` on first PATCH) |

| `in_progress` | At least one answer saved, or page opened, not submitted |

| `submitted` | Human clicked Submit; answers frozen |

| `expired` | Past `expiresAt`; read-only or 410 |

| `cancelled` | Agent or human explicitly cancelled (optional v1) |

**Default TTL:** 24 hours from creation (configurable per session, max 7 days).

**After `submitted`:** Keep session readable via poll URL for **1 hour**, then delete or mark expired.

---

## Data model

### Session (stored as JSON in KV/DB)

```typescript

type SessionStatus =

  | "pending"

  | "in_progress"

  | "submitted"

  | "expired"

  | "cancelled";

type QuestionOption = {

  id: string; // stable slug, e.g. "opt-recommended"

  label: string; // display text (markdown plain text only in v1)

};

type Question = {

  id: string; // e.g. "Q1"

  prompt: string; // markdown allowed in UI render

  options: QuestionOption[]; // min 2, max 8

  allowMultiple?: boolean; // default false

  required?: boolean; // default true

};

type Answer = {

  selectedOptionIds: string[];

  answeredAt: string; // ISO

};

type Session = {

  id: string; // uuid

  createdAt: string;

  expiresAt: string;

  submittedAt?: string;

  status: SessionStatus;

  title?: string;

  context?: string; // optional markdown blurb for human ("Site Map product decisions")

  questions: Question[];

  answers: Record<string, Answer>; // keyed by [question.id](http://question.id)

  publicToken: string; // for answerUrl

  agentToken: string; // for pollUrl — never expose in answer UI

  metadata?: Record<string, string>; // e.g. agentRunId, repo, branch — opaque

};

```

---

## API specification

Base URL: `https://<your-vercel-domain>`

All JSON. Errors: `{ "error": { "code": string, "message": string } }`.

### `POST /api/v1/sessions`

**Auth:** Bearer `AGENT_API_KEY` (env var on Vercel; agent receives key via Cursor secret / 1Password — out of scope for this app).

**Request body:**

```json

{

  "title": "Site Map — product decisions",

  "context": "Answer these so the agent can align specs. Recommended options are labeled in copy.",

  "expiresInSeconds": 86400,

  "metadata": {

    "repo": "calmtechltd/halcyon",

    "branch": "codex/floor-planner"

  },

  "questions": [

    {

      "id": "Q1",

      "prompt": "What is this product called in specs and UI?",

      "options": [

        { "id": "1", "label": "Site Map everywhere (recommended in review)" },

        { "id": "2", "label": "Site Map nav only; mixed copy elsewhere" },

        { "id": "3", "label": "Keep Floor Planner as indoor name" },

        { "id": "4", "label": "Keep three distinct product names" }

      ],

      "required": true

    }

  ]

}

```

**Response `201`:**

```json

{

  "sessionId": "550e8400-e29b-41d4-a716-446655440000",

  "answerUrl": "[https://ask.example.com/s/550e8400-e29b-41d4-a716-446655440000?t=pub_…](https://ask.example.com/s/550e8400-e29b-41d4-a716-446655440000?t=pub_…)",

  "pollUrl": "[https://ask.example.com/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000?token=agent_…](https://ask.example.com/api/v1/sessions/550e8400-e29b-41d4-a716-446655440000?token=agent_…)",

  "expiresAt": "2026-08-17T18:00:00.000Z",

  "status": "pending"

}

```

---

### `GET /api/v1/sessions/:sessionId`

**Query:** `token=<agentToken>` **or** `Authorization: Bearer AGENT_API_KEY`

**Response `200`:**

```json

{

  "sessionId": "…",

  "status": "in_progress",

  "expiresAt": "…",

  "submittedAt": null,

  "title": "…",

  "progress": {

    "totalCount": 12,

    "answeredCount": 5,

    "requiredCount": 12,

    "requiredAnsweredCount": 4,

    "questionIdsAnswered": ["Q1", "Q2", "Q3", "Q4", "Q6"]

  },

  "answers": {

    "Q1": { "selectedOptionIds": ["1"], "answeredAt": "…" },

    "Q2": { "selectedOptionIds": ["1"], "answeredAt": "…" }

  },

  "questions": [ "… full question defs …" ]

}

```

Agent uses this for **polling**. Include full `questions` only if needed; may omit in poll response for size (answers + progress sufficient).

---

### `PATCH /api/v1/sessions/:sessionId/answers/:questionId`

**Auth:** `token=<publicToken>` from answer URL (cookie or query param).

**Request:**

```json

{

  "selectedOptionIds": ["2"]

}

```

**Behaviour:**

- Validates option ids exist and respect `allowMultiple`.

- Upserts answer; sets session `status` to `in_progress` if was `pending`.

- Returns updated progress snippet.

**Response `200`:**

```json

{

  "questionId": "Q6",

  "progress": { "answeredCount": 6, "totalCount": 12, "questionIdsAnswered": ["Q1","Q2",…] }

}

```

---

### `POST /api/v1/sessions/:sessionId/submit`

**Auth:** public token.

**Behaviour:**

- Validates all `required` questions have answers.

- Sets `status: submitted`, `submittedAt: now`.

- Idempotent if already submitted.

**Response `200`:**

```json

{

  "status": "submitted",

  "submittedAt": "…",

  "answers": { "Q1": { … }, … }

}

```

---

### `GET /api/v1/sessions/:sessionId/status` (optional lightweight poll)

Same as GET session but **minimal payload** for agents:

```json

{

  "status": "in_progress",

  "progress": { "answeredCount": 5, "totalCount": 12, "questionIdsAnswered": ["Q1","Q2"] },

  "submittedAt": null

}

```

Implement as query flag `?fields=minimal` on main GET to avoid duplicate routes.

---

## Human-facing UI `/s/[sessionId]`)

**Requirements:**

- Mobile-friendly, accessible (radio groups, fieldset/legend, focus order).

- Show `title` + optional `context` at top.

- Each question: prompt (markdown render), options as **large tap targets** (not tiny radios).

- Show **progress bar**: “5 of 12 answered”.

- **Autosave** on option change (PATCH per question); show subtle “Saved” per row.

- **Submit** disabled until all required answered; clear validation messages.

- After submit: thank-you screen; “You can close this tab.”

- If `expired`: explain + no edit.

- Do **not** expose `agentToken` in HTML or client bundle.

**Optional v1.1:** “Recommended” badge on an option if question includes `recommendedOptionId` in schema.

---

## Agent integration contract (for Cursor Cloud Agent)

Document this in the new repo’s README so agents know exactly what to do.

### 1. Create session

```bash

curl -sS -X POST "$BASE/api/v1/sessions" \

  -H "Authorization: Bearer $AGENT_API_KEY" \

  -H "Content-Type: application/json" \

  -d @questions.json

```

### 2. Tell the human

Post in chat:

```text

Please answer these product decisions (one page, ~10 min):

[https://ask.example.com/s/…](https://ask.example.com/s/…)

I'll wait until you've submitted.

```

### 3. Poll until done

```bash

while true; do

  STATUS=$(curl -sS "$POLL_URL&fields=minimal" | jq -r .status)

  if [ "$STATUS" = "submitted" ]; then break; fi

  if [ "$STATUS" = "expired" ]; then exit 1; fi

  sleep 5

done

curl -sS "$POLL_URL" | jq .answers > answers.json

```

Agent may **log progress** to the user: “Q1–Q5 answered so far…” when `answeredCount` increases.

### 4. Stop conditions

- `submitted` → consume answers, continue task

- `expired` → apologize, offer new link

- Max poll duration (e.g. 2 hours wall clock) → stop polling, ask human to ping when done

### 5. Answer shape for downstream use

Agent should parse:

```typescript

type AgentDecision = {

  questionId: string;

  selectedOptionIds: string[];

  // resolve labels from questions[] for human-readable summary

};

```

---

## Security

| Threat | Mitigation |

| --- | --- |

| Guess session UUID | Use UUID v4 + high-entropy tokens `publicToken`, `agentToken` ≥ 32 bytes base64url) |

| Public token leaks | Token only allows PATCH answers + submit for **that** session; not list/create |

| Agent key leaks | Rotate `AGENT_API_KEY`; rate limit POST by IP + key |

| Scraping | Rate limit GET/PATCH per session |

| XSS in prompts | Sanitize markdown render; no raw HTML from untrusted agents in v1 |

**CORS:** Answer UI same-origin only. API POST from agent server-side (no browser CORS needed for agent).

---

## Vercel implementation notes

**Stack (recommended):**

- Next.js 15 App Router

- **Vercel KV** (Redis) for session documents — ideal for TTL-ish ephemeral data

- Or **Neon Postgres** if you prefer SQL audit trail (overkill v1)

**Routes:**

| Route | Runtime |

| --- | --- |

| `app/s/[sessionId]/page.tsx` | Server component loads session by public token |

| `app/api/v1/sessions/route.ts` | POST create |

| `app/api/v1/sessions/[sessionId]/route.ts` | GET poll |

| `app/api/v1/sessions/[sessionId]/answers/[questionId]/route.ts` | PATCH |

| `app/api/v1/sessions/[sessionId]/submit/route.ts` | POST |

**Env vars:**

- `AGENT_API_KEY` — required for session creation

- `KV_*` — Vercel KV binding

- `SESSION_DEFAULT_TTL_SECONDS` — default 86400

- `PUBLIC_BASE_URL` — e.g. `https://ask.yourdomain.com`

**Expiry cleanup:**

- Vercel Cron daily: scan/delete sessions where `expiresAt < now` OR `submittedAt < now - 1h`

- Or rely on KV TTL if storing with expiration (preferred)

**Rate limits:** `@vercel/firewall` or simple in-memory/token bucket per IP on PATCH (optional v1).

---

## Example: full agent prompt to populate questions

When an agent creates a session, it should send **structured** questions — not prose. Example payload file the Calm agent would generate from `.active/site-map-decisions.md`.

---

## Testing checklist

- [ ] Create session with 12 questions

- [ ] Open answer URL incognito; answer Q1 only; poll shows `answeredCount: 1`

- [ ] Complete all required; submit; poll flips to `submitted`

- [ ] Double submit idempotent

- [ ] Expired session returns 410 on PATCH

- [ ] Invalid option id rejected

- [ ] `allowMultiple: true` accepts multiple ids

- [ ] Agent key required on POST; public token insufficient for POST create

- [ ] Mobile layout usable

---

## Future (v2)

- Free-text optional per question

- `recommendedOptionId` hint in UI

- Webhook on submit `callbackUrl` in create body) so agent need not poll

- Cursor MCP wrapper tool `create_questionnaire` / `wait_for_questionnaire`

- Export answers as JSON download for human

---

## Copy-paste prompt for the **other project** (give this to that agent)

Use everything below as the implementation brief.

---

### IMPLEMENTATION PROMPT START

Build **Agent Questionnaire Service** — a Vercel-hosted micro-app.

**Goal:** Let autonomous agents POST a structured multiple-choice questionnaire, receive an `answerUrl` for a human and a `pollUrl` for the agent, support incremental saves per question, and a final submit. Agent polls every 3–5s until `status === 'submitted'`.

**Implement exactly:**

1. **POST /api/v1/sessions** (Bearer `AGENT_API_KEY`) — body: `{ title?, context?, expiresInSeconds?, metadata?, questions[] }` where each question has `id`, `prompt`, `options[{id,label}]`, optional `allowMultiple`, `required`.

2. **Returns** `{ sessionId, answerUrl, pollUrl, expiresAt, status }`.

3. **GET /api/v1/sessions/:id?token=agentToken** — full status for polling; support `fields=minimal` returning only `{ status, progress, submittedAt }`.

4. **PATCH /api/v1/sessions/:id/answers/:questionId?token=publicToken** — autosave one answer.

5. **POST /api/v1/sessions/:id/submit?token=publicToken** — validate required, set submitted.

6. **UI** at `/s/[sessionId]?t=publicToken` — single page, progress bar, autosave, submit.

**Storage:** Vercel KV, session JSON as documented in spec. TTL 24h default.

**Security:** Separate public vs agent tokens; never expose agent token to browser.

**Tech:** Next.js App Router, TypeScript, Tailwind, shadcn/ui optional.

**Deliverables:** Deployed Vercel app, README with curl examples for agent polling loop, `.env.example`.

Follow the full spec in the “Agent Questionnaire Service” document (sections: Data model, API, UI, Security, Testing checklist).

### IMPLEMENTATION PROMPT END

---

## Related: wiring Calm Cloud Agent later

Once deployed:

1. Add `AGENT_QUESTIONNAIRE_URL` + `AGENT_QUESTIONNAIRE_KEY` to cloud agent secrets.

2. Add optional skill `.agents/skills/agent-questionnaire/SKILL.md` in Calm: “when user needs multi-choice decisions, POST sessions, share link, poll until submitted.”

3. Do **not** block Calm PR work on this — parallel project.

