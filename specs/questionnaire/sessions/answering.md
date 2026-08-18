---
id: questionnaire-sessions-answering
area: Questionnaire / Sessions
status: partial
---

# Answering a questionnaire

**askmeatsack.com** is how an agent asks a human a set of questions. Create returns an askmeatsack.com link to put in the conversation there and then, or to send from an unattended job. The human answers in the browser and submits once. The agent learns the result by checking status, waiting a bounded time, or being called back.

## Behaviours

### B1 — Agent starts a questionnaire 🟢

An agent calls the **askmeatsack.com** tool, or sends the same JSON over HTTP. It sends a title, optional context, the questions, optional expiry, optional opaque metadata, optionally a callback URL, and optionally a theme (dark or light, and/or one accent colour). When the questions are usable, it always receives the askmeatsack.com answer link (to put in the conversation, or anywhere else the agent already can post), a status link, and a private manage link. It also learns when the questionnaire will expire. The askmeatsack.com tool and HTTP produce the same questionnaire.

If a question is not usable, create is refused and no answer link is returned. The refusal names the question id and the rule (for example that `allowComment` needs options, items, or fields). Several bad questions are listed; the message is the first of those. HTTP and the tool use the same error body: `error.code`, `error.message`, and `error.issues`.

### B2 — Human answers one question at a time 🟢

The human opens the answer link in a browser and sees the title, any context, and one question. Choice questions show their options as large tap targets; a recommended option is marked as recommended. Text questions show a text field. Choosing a single option without a comment or files moves on to the next question. Multi-choice, text, comments, and files use a continue control. Step numbers above the question jump to any question. A back control returns to the previous question. Progress shows which step they are on, for example “2 of 12”. Closing the tab and opening the same link again resumes at the first question that still needs an answer, or at review if every required question already has an answer.

### B3 — Answers are kept as they go 🟢

When the human picks an option or types in a text field, that answer is saved without a separate save button. They can change a saved answer until they submit. Closing the tab and opening the same link again still shows the saved answers.

### B4 — Agent can see progress before submit 🟢

Once at least one answer is saved, the agent’s status (askmeatsack.com tool or HTTP) shows work is under way (`in_progress`), how many questions have answers, which question ids those are, and the answers so far. Opening the page with nothing saved yet stays `pending`. Partial answers are enough; the agent does not have to wait for submit to see progress.

### B5 — Submit once, then answers freeze 🟢

After the last question the human sees a review of every answer. They can jump back to change one, then submit. After that, the questionnaire is finished: answers cannot be changed. Submitting again after a successful submit still succeeds and returns the same answers.

### B6 — Cannot submit until required questions are answered 🟢

Continue and submit stay unavailable, and submit is refused if forced, until every required question has an answer. Optional questions may be left blank. A required choice needs a valid option. A required text question needs non-empty text. On a required question, continue stays unavailable until that question has an answer.

### B7 — Agent reads the finished answers 🟢

When the questionnaire is submitted, the agent’s status shows that it is finished and includes every question’s chosen option ids and any text. The agent can then stop waiting and continue its work. The askmeatsack.com tool and HTTP return the same result.

### B8 — The link expires 🟢

After the expiry time, the human cannot change or submit answers. The page explains that the link has expired. The agent’s status shows `expired`, not submitted, and still includes any answers that were saved. A new questionnaire is a new link.

### B9 — A bad answer is refused 🟢

A choice that is not one of that question’s options is refused. Several options on a single-choice question are refused. A question that allows several options accepts more than one of its own options. Text longer than the limit is refused. Saving a choice on a text question, or text on a choice question that does not allow a comment, is refused. Previous valid answers stay as they were.

### B10 — The two links have different powers 🟢

The human’s link can only load that questionnaire, save its answers, submit it, cancel it, mark it opened, and download its own answers after submit. It cannot start a new questionnaire, open the manage page, or use the agent’s status. The answering page never shows the agent’s secret. Someone without that questionnaire’s agent token cannot check status as the agent, cancel as the agent, wait as the agent, inspect the manage page, or edit the questions. Creating a questionnaire needs a lanyard token — see B35.

### B11 — After submit, the human can close the tab 🟢

Once submitted, the human sees a short confirmation that they are done and can close the tab. Opening the same link again still shows that it is finished, not the editable questions.

### B12 — A broken or unknown link does not leak another questionnaire 🟢

An unknown questionnaire, or a link whose token does not match, does not show questions and does not accept answers.

### B13 — Agent can wait a bounded time 🟢

The agent can wait, via the askmeatsack.com tool or over HTTP, for up to a stated number of seconds. If the questionnaire reaches `submitted`, `expired`, or `cancelled` within that time, the wait returns that result. If it is still open, the wait returns the current status and progress — it does not hang past the bound.

### B14 — The page tells the agent it is actually open 🟢

When the answering page is running in a browser, it tells the service it is open. That is not the same as fetching the URL (chat unfurls do that). The agent can see that it was opened, and when. Opened with no answers still stays `pending`.

### B15 — A recommended option is marked 🟢

A choice question may name one of its options as recommended. The human sees that option marked. It is a hint, not a default: nothing is selected until the human chooses. The recommended id must be one of that question’s options.

### B16 — Questions may be choices, text, or both 🟢

A question is a choice (two to eight options, optional several-at-once), free text, or a choice that also allows a short comment. The human answers in the matching control. The agent receives option ids, text, or both, keyed by question id. Structured rows and named fields are a separate kind (B32).

### B17 — Human or agent can cancel while it is open 🟢

While the questionnaire is `pending` or `in_progress`, the human (answer link) or the agent (status secret or create credential) can cancel it. Status becomes `cancelled`. Answers freeze as they were. The human sees that it was cancelled. Cancel when already cancelled still succeeds as `cancelled`. Cancel when already submitted or expired is refused; the existing terminal status is unchanged.

### B18 — Agent can be called back on a terminal status 🟢

When creating a questionnaire, the agent may leave a callback URL. When status becomes `submitted`, `expired`, or `cancelled`, the service tells that URL the session id, status, and answers. A failed callback does not undo the status; the agent can still read status. Callbacks are not sent for unfurls or for ordinary progress.

### B19 — Human can download the answers 🟢

After submit, the confirmation screen lets the human download the answers as Markdown or JSON (question ids, prompts, chosen labels and ids, any text). Download is not offered on an open, expired, or cancelled questionnaire, and never includes the agent’s secret. This service does not email a copy.

### B20 — Ask in the conversation 🟢

Create always returns the askmeatsack.com answer link immediately. A skill shipped with this product tells the agent to call the **askmeatsack.com** tool, put that link in the conversation, and wait (status, bounded wait, or callback). The person in that conversation opens it and answers. If the agent needs someone else, they post the same link themselves (Slack, email, and so on) — that post is the agent’s job, not this service. The same skill also covers an unattended job that is not sitting in a chat (B34).

### B22 — Agent can hint a theme 🟢

When creating a questionnaire, the agent may optionally name a theme: `ask` (the product), `paper`, `grove`, or `ember`. Each theme has a light and a dark side. If it sends nothing, the human sees `ask` in whatever light or dark their system is using. `mode` of `light` or `dark` forces that side. The human can still switch light and dark from a control on the page; that choice is kept in the browser. A six-digit hex `accent` is still accepted. An unusable theme is refused and no link is created.

### B23 — A machine can read the questions as markdown 🟢

The same public answer token also serves a markdown document at the answer path with `.md` appended. Fetching the ordinary answer link with `Accept: text/markdown` (or `text/plain`) returns that same document. The HTML page advertises it with an alternate markdown link. That document lists every question, its options, where to save answers, where to submit, and a JSON Schema for the answer body. It never includes the agent’s status secret. A token that does not match does not show the questions.

### B24 — A machine can answer with JSON 🟢

Using the public answer token, a caller can PUT all answers as JSON in one request, optionally submitting in that same request. The same validation as the browser applies. Required questions still block submit.

### B25 — Questions may accept files 🟢

A question may allow file attachments. The human can choose files, drop them on a compact attach control next to the answer (not on the evidence rail), or take a photo. A question accepts at most five files, 4 MB each. The list shows each name and size after upload. There is no delete. The public answer token can upload a file for that question (same unguessable-link model as the page). Uploaded files are stored in Cloudflare R2 and served from the questionnaire’s own origin. A question that does not allow files refuses uploads. If that store is not configured, upload fails and the page says so.

### B26 — A question may carry extra material 🟢

A question may include optional markdown `detail` — the situation, not the ask. It is a lump of markdown: prose, lists, tables, links or bare URLs, images, and mermaid code fences. Those are drawn as written. On a wide screen the human sees that material in a rail beside the question; on a narrow screen it sits under the prompt, before the choices. A short prompt is shown as the question heading. A long prompt is shown as readable body text, not a giant title. Prompts may also be markdown. Option labels stay plain text. Raw HTML from the creator is not rendered. This product does not score, mark, or branch on answers; the calling agent interprets them.

### B27 — Owner can inspect on a private manage link 🟢

Create also returns a private manage link, keyed by the agent token. Opening it in a browser shows a summary: title, status, expiry, context, every question (prompt, options, and flags), progress, and the public answer link to share. Fetching that same manage path as markdown (or with `.md`) returns the same summary for an agent. Status (tool or HTTP) includes the questions, the answer link, and the manage link. The manage page never uses the public answer token. A token that does not match does not show the questions.

### B28 — Owner can edit before anyone answers 🟢

While status is still `pending`, the owner can change title, context, questions, appearance, expiry, metadata, or callback URL — via the askmeatsack.com tool (`edit`) or HTTP PATCH with the agent token. The public answer link stays the same. Once an answer is saved, or the questionnaire is submitted, expired, or cancelled, an edit is refused and the questions stay as they were.

### B29 — Questions may be grouped into sections 🔵 future

The agent may group questions into named sections. The human sees which section they are in, and progress can say which step they are on inside that section as well as overall. Step numbers stay jumpable. A section may carry its own short title and optional markdown. Sections do not change how answers are saved or submitted.

### B30 — A questionnaire may open on a welcome 🔵 future

Before the first question, the human may see the title and the context as a welcome, then start. Context is markdown. It is not only a muted paragraph on the first question. Skip the welcome when there is no context and the title is enough to begin.

### B31 — A question may name sources 🔵 future

A question may name extra material for the rail: links, and files the agent attached when creating the questionnaire. Those are for the human to read, not answers. They are separate from files the human uploads as part of their answer.

### B32 — A question may ask for labelled rows or named fields 🟢

A question may be a list of rows to label (`items`) or a few named boxes (`fields`), instead of a choice or a single text box. The human answers each row or field in place. A required question of this kind needs every row or field filled. The agent receives those values keyed by id. A question cannot mix options, items, and fields. Optional comment and files still work on top.

A row or field may be money: `input: "money"` plus an ISO 4217 `currency` on the row or the question. A known figure belongs in `amount` (canonical decimal), not jammed into the label. The human sees a formatted amount and a currency-prefixed input. Stored answers are canonical decimals in that currency. The service does not convert. Mixed currencies are per-row.

### B33 — A question may ask for device capture 🔵 future

A question may ask for something the device can capture besides a file: the person’s location, a live camera shot that is not just “pick an image”, and similar. File questions already cover choose, drop, and take a photo (B25). This is for typed capture that is not “here is a file”.

### B34 — Unattended job can collect from many people 🟢

The skill tells an agent that is filling records or chasing missing facts — HR fields, identity documents, files, an ID — to create one questionnaire per person. Each ask is unique to what is still missing for that person. Opaque metadata holds the record key so answers can be matched when they come back; the human does not see it. The agent puts `answerUrl` wherever it already reaches them, then waits via callback, poll, or a later bounded wait — not only by pasting into the current chat. Two people never share one answer link. The product is the same as the live-chat path; the agent does not invent a second form because the run is automated.

### B35 — Starting a questionnaire needs an account 🔵 future

An agent must present a lanyard token to create a questionnaire. A call without one is refused
and told where to authorise, so an agent that can complete that journey recovers on its own.
The token identifies the account the questionnaire belongs to; it does not appear in the answer
link and the human answering never needs one.

### B36 — Trying it on the home page needs no account 🔵 future

Anyone can try a questionnaire from the home page without signing in. The trial uses
questionnaires this service already holds — a visitor cannot put their own words on an
askmeatsack.com link — so the worst a stranger can do is use capacity. Trial questionnaires are
short-lived and limited by calling address.

### B37 — A flood from one account is refused 🔵 future

Creating far more questionnaires than a person plausibly would, from one account, is refused
for a while. The refusal says to wait. Nothing already created is affected, and answering an
existing questionnaire is never rate limited.

### B38 — A callback only reaches the public internet 🟢

A `callbackUrl` must be an ordinary public HTTPS address. An address that resolves inside a
private network, or one that redirects to somewhere it was not, is refused at create — not
quietly dropped later, so the agent learns while it can still fix it.

### B39 — An attached file is checked before anyone can read it 🔵 future

A file attached to an answer is checked for malware before it can be downloaded. Until there is
an answer, the file cannot be read and whoever asks is told it is still being checked. A file
found to be infected is removed and never served.

## Rules (Invariants)

- A choice question has at least two and at most eight options. A text question has no options, items, or fields. An item question has two to sixteen rows. A field question has two to eight named boxes. A question cannot mix options, items, and fields. A comment is optional extra text, not a substitute for the choice, rows, or fields when the question is required. `allowComment` is only valid when the question already has options, items, or fields. Free text already is the comment; a photo-only question cannot add a comment without a shape.
- Money rows need an ISO 4217 currency on the row or the question. Known figures use `amount`. Stored money answers are canonical decimals. The service does not convert currencies.
- A question is required unless it is marked otherwise. Required defaults to yes. Several options on one question default to no.
- Saved answers freeze at submit, expiry, or cancel. They do not change afterwards.
- Default life is 24 hours from creation. The creator may ask for shorter or longer, never more than 7 days.
- After submit, expiry, or cancel, the agent can still read status and answers for one hour. After that the questionnaire is gone. The human cannot save or submit once it has expired or been cancelled.
- Prompts and optional question `detail` may be formatted as markdown, including mermaid diagrams and tables. The prompt is the ask; `detail` is the situation shown in the evidence rail. Option labels are plain text. Raw HTML from the creator is not rendered. The service does not score answers.
- The agent’s status secret never appears in the answering page, the JSON download, or anything the browser is given to run. It may appear in the manage URL, which is only for the owner.
- Questions can be replaced only while status is `pending`. The public answer token does not change when the owner edits.
- Opaque metadata the agent attaches (repo, branch, run id) is stored and returned to the agent; the human does not need it to answer.
- Sessions are ephemeral. This product does not keep a long-term archive of answers.
- Tool and HTTP are equivalent: same questions in, same questionnaire, same status and answers out. Refused questions use the same error body on both: the first rule in the message, and a list of issues with question id and rule.
- The agent tool is named **askmeatsack.com**. Answer links are on `https://askmeatsack.com`.
- A bounded wait never exceeds the time the agent asked for, and never more than 60 seconds per call.
- An opened signal comes only from the running answering page, never from a mere fetch of the link.
- Text answers are at most 2000 characters. Question `detail` is at most 8000 characters. A
  title is at most 200 characters, `context` at most 4000, and a prompt at most 1000. Metadata
  holds at most 20 keys, each key and value at most 200 characters.
- Creating needs a lanyard token. Answering never does — the human is not asked to sign in, and
  the answer link works for someone with no account.
- A questionnaire belongs to the account that created it. Deleting that account does not reach
  back into questionnaires already answered.
- Rate limits count against the account. The home-page trial has no account, so it counts
  against the calling address instead, and only ever creates questionnaires this service
  already holds.
- A `callbackUrl` is public HTTPS. Private, loopback, and link-local addresses are refused, and
  a redirect away from the address given is not followed.
- An attached file is not downloadable until it has been checked. Infected files are removed.
- A callback, when present, is invoked once per terminal status (`submitted`, `expired`, `cancelled`).
- User-facing copy calls the product **askmeatsack.com**.
- Appearance is optional. Missing appearance is the `ask` theme in the person’s system light or dark. Named themes are `ask`, `paper`, `grove`, and `ember`, each with both modes. `mode` may be `dark` or `light` to force one side. Accent, when present, is a `#` plus six hex digits.
- The `.md` document is the same questionnaire as the browser page, keyed by the same public token. It never contains the agent status secret.
- Files use the public answer token. A file is at most 4MB. A question accepts at most five files.

## Decision Tables

### Session status

| What happened                                                            | Status the agent sees                      |
| ------------------------------------------------------------------------ | ------------------------------------------ |
| Just created; no answer saved yet (page may or may not have been opened) | `pending`                                  |
| Page running, still no answer saved                                      | `pending`, with opened time set            |
| At least one answer saved, not submitted, not expired, not cancelled     | `in_progress`                              |
| Human submitted successfully                                             | `submitted`                                |
| Human or agent cancelled while open                                      | `cancelled` (answers so far still present) |
| Expiry time has passed, never submitted or cancelled                     | `expired` (answers so far still present)   |
| Submitted, expired, or cancelled, then the one-hour read window ended    | gone (agent can no longer read it)         |

### What each doorway may do

| Action                                                    | Human answer link                          | Agent status (askmeatsack.com tool or HTTP) | lanyard token              |
| --------------------------------------------------------- | ------------------------------------------ | ------------------------------------------- | -------------------------- |
| Start a questionnaire                                     | No                                         | No                                          | Yes (B35)                  |
| See questions and save answers                            | Yes, that questionnaire only               | No                                          | No                         |
| Mark opened                                               | Yes, that questionnaire only               | No                                          | No                         |
| Submit                                                    | Yes, that questionnaire only               | No                                          | No                         |
| Cancel while open                                         | Yes, that questionnaire only               | Yes, that questionnaire only                | Yes, that questionnaire    |
| See status, progress, opened time, questions, and answers | No                                         | Yes, that questionnaire only                | Yes, that questionnaire    |
| Open the manage summary                                   | No                                         | Yes, that questionnaire only                | Yes, that questionnaire    |
| Edit questions and details                                | No                                         | Yes, while `pending`                        | Yes, while `pending`       |
| Bounded wait                                              | No                                         | Yes, that questionnaire only                | Yes, that questionnaire    |
| Download answers (Markdown or JSON)                       | Yes, after submit, that questionnaire only | No                                          | No                         |
| See the agent status secret                               | No                                         | It _is_ the secret                          | Not via the answering page |

### Saving an answer

| Situation                                                                                          | Outcome                            |
| -------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Option ids all belong to the question; one option on a single-choice question                      | Answer saved; progress updates     |
| Several option ids on a single-choice question                                                     | Refused; previous answer unchanged |
| An option id that is not on the question                                                           | Refused; previous answer unchanged |
| Non-empty text on a text question, or a comment on a choice that allows it, within 2000 characters | Answer saved; progress updates     |
| Text on a choice that does not allow a comment, or options on a text question                      | Refused; previous answer unchanged |
| Text over 2000 characters                                                                          | Refused; previous answer unchanged |
| Questionnaire already submitted, expired, or cancelled                                             | Refused; answers unchanged         |
| Token does not match                                                                               | Refused; no questions shown        |

### Submit

| Situation                                                   | Outcome                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Every required question has a valid answer, from the review | Submitted; answers freeze; agent sees `submitted`; callback fires if set |
| A required choice has no option, or required text is empty  | Submit refused; human is told what is missing                            |
| Already submitted                                           | Still success; same answers; callback not sent again                     |
| Expired or cancelled                                        | Refused                                                                  |

### Cancel

| Situation                        | Outcome                                            |
| -------------------------------- | -------------------------------------------------- |
| `pending` or `in_progress`       | `cancelled`; answers freeze; callback fires if set |
| Already `cancelled`              | Still `cancelled`; same answers                    |
| Already `submitted` or `expired` | Refused; existing terminal status unchanged        |

### Bounded wait

| Situation within the bound                           | Outcome                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Becomes `submitted`, `expired`, or `cancelled`       | Wait returns that status and answers                           |
| Still `pending` or `in_progress` when the bound ends | Wait returns current status and progress; agent may wait again |
| Bound omitted or over the maximum                    | Refused; agent is told the allowed bound                       |

### Appearance

| Situation                                      | Outcome                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| No appearance sent                             | Human sees `ask` in their system light or dark                         |
| `theme` is `ask`, `paper`, `grove`, or `ember` | Answering page uses that palette, still following system light or dark |
| `mode` is `light` or `dark`                    | That side is forced; the theme palette stays                           |
| `accent` is a six-digit hex colour             | Buttons and selected answers use that colour on top of the theme       |
| `theme`, `mode`, or `accent` is unusable       | Create refused; no answer link                                         |

### Machine answers

| Situation                                                                 | Outcome                                                           |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| GET the answer path with `.md` and a matching public token                | Markdown of questions, options, save/submit URLs, and JSON Schema |
| GET the ordinary answer path with `Accept: text/markdown` or `text/plain` | The same markdown as `.md`                                        |
| GET `.md` with a bad token                                                | Refused; no questions                                             |
| PUT JSON answers with a matching token                                    | Answers saved; optional submit in the same request                |
| PUT JSON that fails the same rules as the browser                         | Refused; previous answers unchanged                               |
| POST a file on a question that allows files, matching token               | File stored and attached                                          |
| POST a file on a question that does not allow files                       | Refused                                                           |

### Manage and edit

| Situation                                                          | Outcome                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| GET the manage path with a matching agent token                    | Summary of title, status, questions, progress, and the public answer link |
| GET manage with `.md` or `Accept: text/markdown`                   | The same summary as markdown                                              |
| GET manage with the public answer token, or a bad token            | Refused; no questions                                                     |
| PATCH while `pending`, usable fields, matching agent token         | Questionnaire updated; answer link unchanged                              |
| PATCH with unusable questions                                      | Refused with the question id and the rule; questionnaire unchanged        |
| PATCH after an answer is saved, or after submit, expiry, or cancel | Refused; questions unchanged                                              |
| PATCH with nothing to change                                       | Refused                                                                   |

## User Flows

- **F1 — Human answers:** [contract](./answering.flow.yaml) · [diagram](./answering.flow.mmd) — covers B2–B6, B8–B12, B14–B17, B19, B26
- **F2 — Agent waits:** [contract](./answering.flow.yaml) · [diagram](./answering.flow.mmd) — covers B1, B4, B7, B8, B10, B13, B17, B18, B20, B34
- **F3 — Owner inspects:** [contract](./answering.flow.yaml) · [diagram](./answering.flow.mmd) — covers B27, B28

## Open Questions

- **Settled:** One question at a time, not a stacked scrollable page. Recorded as B2. (Earlier: one page; reversed.)
- **Settled:** After the last question they review, then submit. Step numbers jump back. Recorded as B2 and B5.
- **Settled:** After submit, answers freeze. There is no “edit until the agent acknowledges” window. Recorded as B5.
- **Settled:** Closing the tab is enough to keep a draft; autosave is the draft. No separate “save draft and close” action.
- **Settled:** Default life 24 hours, cap 7 days, one hour of agent readability after submit, expiry, or cancel. Recorded in the invariants.
- **Settled:** `in_progress` starts on the first saved answer, not on opening the page. Chat unfurls must not look like work under way. Opened time is a separate signal from the running page. Recorded as B4 and B14.
- **Settled:** After expiry the agent still reads any partial answers for one hour. Recorded as B8.
- **Settled:** Tool and HTTP are both in. Same questionnaire. Recorded as B1, B7, B13.
- **Settled:** Bounded wait, callback, cancel, free text, recommended option, opened signal, and JSON download are in. Recorded as B13–B19.
- **Settled:** Maximum wait bound is 60 seconds per call. The agent loops if it wants longer. Stops a hung tool without cutting the wait feature.
- **Settled:** The product is askmeatsack.com. The domain is live. The agent tool is named **askmeatsack.com**. Create always returns the link. Recorded as B1 and B20.
- **Withdrawn:** Email from this service (B21). Giving `answerUrl` is the calling agent’s job; this service does not send mail.
- **Settled:** The skill is also for unattended jobs (a Grok bot filling HR, a sweep that cannot find a file). One person, one questionnaire, personalised to what is missing, metadata to match answers, send and wait via callback or poll. Recorded as B34.
- **Reversed:** Create was public, with no shared bearer to hand out. It now needs a lanyard token. Open create had no benefit to us and let anyone put their own words on an askmeatsack.com link. Agent status still needs that questionnaire’s own agent token (the `pollUrl`) — a lanyard token does not replace it. Recorded as B10 and B35.
- **Settled:** The answering page uses a named theme (`ask`, `paper`, `grove`, `ember`). Default is `ask` in the person’s system light or dark. Each theme has both sides. `mode` forces one side. The human can still switch light and dark on the page. Recorded as B22.
- **Settled:** Agents can read `.md` and answer with JSON using the public token. Files are optional per question, same token. Recorded as B23–B25.
- **Settled:** A question may carry markdown `detail` (including mermaid) for the human. The product does not score quizzes. Recorded as B26.
- **Settled:** Create returns a private manage link for inspect. Edit is allowed only while `pending`, so a person mid-answer is not left on vanished questions. Recorded as B27 and B28.
- **Settled:** One question at a time stays. The fix for questions that do not render is the evidence rail and a short-ask / situation split, not a return to a stacked form. Recorded as B2 and B26.
- **Blocks B29:** Are sections first-class objects (id, title, optional intro markdown) that questions point at, or only a label string on each question?
- **Blocks B29:** Does a new section get an interstitial intro screen, or only chrome (section name in the progress line)?
- **Blocks B30:** Welcome screen, or keep title always visible and show context in the rail / on the first question?
- **Blocks B31:** Are sources first-class (`label` + `url`, optional agent-attached files), or is markdown in `detail` enough?
- **Settled:** “I will label them in the comment” is a weak answer type. Rows (`items`) and named boxes (`fields`) are in. Money uses `input`, ISO `currency`, and optional `amount`. No conversion. Recorded as B32.
- **Settled:** File questions use a compact attach control: choose, drop, or take a photo. Multiple files are allowed, up to five. The evidence rail is not the drop zone. Recorded as B25.
- **Blocks B33:** Which capture types are first-class (location, live camera, …), and is location a coordinate the agent can read, or a place the human confirms?

## Future Considerations

- Agent-attached source files on create, distinct from the human’s answer uploads.
- Branching or scoring — still out of scope. The calling agent interprets answers.
- Richer device capture on a question (location, live camera), distinct from attaching a file.

## Out of Scope

- Sending email.
- Identifying the human who answers. They never sign in and the service does not learn who
  they are.
- Running our own sign-in. Accounts live in lanyard; this service only verifies its tokens.
- Wiring into Cursor’s own product APIs or the native AskQuestion UI.
- Long-term storage or search of past questionnaires.
- Posting the answer link to Slack or any other chat. The calling agent does that with the URL this service already returns.
