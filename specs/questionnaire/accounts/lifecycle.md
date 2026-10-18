---
id: questionnaire-accounts-lifecycle
area: Questionnaire / Accounts
status: partial
---

# Retained requests and attachments

A person's agent-created requests and text responses remain in their Ask account
until they delete them. Respondent attachments expire separately; choosing Keep
creates a separate retained copy in Ask, subject to the account's allowance.

**Verified Development checkpoint (2026-10-11):** The resource bridge, owner endpoints,
sealed R2 operations, real scanner/callback handling, independent kept copies and
signed frozen-key cleanup are verified against the activated Convex Development
backend and actual local portal. Focused automated tests cover concurrency, allowance
boundaries, ninety-day access and cleanup races; live acceptance covers real bytes,
expiry/terminal owner access, exports, isolation and scheduled cleanup through an outage.
Production release remains separate. B10 activity remains future.

## Behaviours

### B1 — Your requests survive the answer link ending 🟢 implemented

New requests created with verified account authority appear in the owner's Requests
view and remain readable after submission, cancellation, public-link expiry and the
one-hour agent read window. Questions, saved text/entries and progress are retained.
The original answer link still expires, including its submitted view and downloads; keeping a request does not reopen it or permit
editing frozen answers. Anonymous and earlier requests keep their existing lifecycle;
this does not migrate or claim them.

### B2 — The account allowance is enforced before work starts 🟢 implemented

An account can retain 500 requests. Each new request occupies one slot irrespective
of status; text and questions do not consume its file allowance. Repeating the same
identified creation attempt produces the same request without another slot. Reusing
that identifier for different questions is refused. The 500th request is accepted;
the 501st is refused with a clear recovery action to delete a retained request.

New retained requests have a 4 MiB UTF-8 structured-content ceiling. Creation and
pending edits reserve room for every permitted normal text/entry answer and up to
five bounded attachment descriptors per file question, including terminal metadata.
An oversized request is refused explicitly with `canonical_too_large` (HTTP 413)
before admission; accepted requests do not later lose valid answers merely because
they are completed. There is no added question-count limit and no silent truncation.
Owned multi-choice answers treat selected options as a set; repeated option IDs do
not enlarge retained content. Owned file names and content types are at most 255
characters; generated identifiers, paths and links have bounded descriptors.

Ask has a separate decimal 1 GB (1,000,000,000 byte) file allowance per account.
Accepted respondent attachment reservations and independent kept copies count their
declared exact size once each. Pending, scanning and removing files keep their charge
until their safe release. Retrying an upload/copy does not reserve the same file again.
A kept copy and its source each count while both still exist. Share's files and
allowance do not affect Ask, and requests without attachments consume no file bytes.

### B3 — Respondent attachments have their own ninety-day lifetime 🟢 implemented

A new attachment on an owned request is retained for 90 days from successful verified upload
commit. The question still permits at most five files, each at most 4 MiB,
including pending upload reservations. Uploading remains available only through the
valid public answer token while the request permits answers. Capacity is reserved
before storage is writable, and attachment registration rechecks the question and
request state. A conflicting submit, expiry, edit, deletion or account closure cannot
leave an attached unauthorized file. Failed uploads have recoverable, bounded cleanup.

The storage authority bounds active file reservations to five per file-enabled
question plus 128 obsolete reservations awaiting cleanup. This recovery headroom
does not reduce an admitted questionnaire's ordinary five-file completion envelope.

At the 90-day boundary the original file becomes unavailable without an owner action.
The response still identifies that attachment and explains its expired state; saved
text remains readable. Public request expiry never extends this file lifetime.

### B4 — Files remain blocked while they are checked 🟢 implemented

An owned attachment is readable or eligible to Keep only after its sealed contents
have passed the scanner. Uploading, sealing, scanning, scan failure and infected states
are distinct. A scanner outage keeps the file blocked and offers safe retry; it does
not substitute an unscanned file. Infected content is never downloaded or kept and is
queued for safe removal. A late verdict for an earlier attempt cannot authorize a
replacement or a removing file. The original anonymous file flow is unchanged by
this owned-file delivery.

### B5 — Keep creates an independent eligible copy 🟢 implemented

On an eligible owned-request attachment, Keep attachment creates a separate copy
owned by the same account inside Ask. The action checks ownership, current source
retention, request visibility, scan verdict and capacity before reserving and again
before committing the copy. A copied object is made available only after storage
confirms its size and the final eligibility check succeeds. Repeating the same Keep
for the same source returns its existing retained copy without another byte charge.

A successful copy survives the source's later expiry, deletion and original request
removal. The designated Kept files section lists these copies and provides independent
inspection, download and deletion. It has no upload or questionnaire-creation control. It keeps source provenance for inspection without depending on the source
bytes. Keeping does not change the original respondent file's deadline. If source
access ends before commit, no available copy is created; failed or abandoned copy
bytes remain reserved until retryable cleanup confirms safe removal. The owner sees
pending, complete, refused or failed state and can retry rather than being shown a
false success.

### B6 — Deleting a request removes its retained answers 🟢 implemented

Delete request asks for confirmation naming the request and the consequences: its
retained questions and responses will be removed and its public/agent links will stop
working. It also removes the original respondent attachments. Independently kept
copies remain until the owner deletes those copies separately. Cancel closes the
confirmation without changing anything.

Once deletion commits, the request and its original files are hidden immediately,
and new responses/copies/updates are refused. Its request slot remains reserved while
original-file cleanup is pending; a fileless request releases its slot immediately. Its text,
questions, public/agent tokens and account association are removed; an opaque
retirement marker prevents an earlier cache from reviving it. Original file bytes
remain reserved while cleanup is pending or storage is unavailable. The interface
reports removal and pending cleanup honestly; retry does not restore the request.

### B7 — Account closure cleans up without another login 🟢 implemented

Closing the account hides and retires its retained Ask requests and kept copies,
stops all new work and queues each owned storage object for removal. Cleanup continues
without the former owner returning. Storage outages retain reservations and retry.
Only after confirmed object absence and safe completion of outstanding writes may
bytes be released. Existing independently held objects belonging to another account
are not removed; this slice creates no cross-account file aliases.

### B8 — Public and agent powers stay separate from owner retention 🟢 implemented

The public answer token keeps the existing answer/edit/submit/download rules and
its link expiry. The private agent token keeps the existing one-hour terminal read
window. Neither token gains retained owner-only response or file access. Verified
owner authority can inspect retained content, export submitted responses, edit a
still-pending request and cancel an open request. Copy/Share returns only a currently
valid public answer URL, never private management or storage capabilities. Asking an
additional person still goes through the existing agent and creates a distinct request.

### B9 — Competing operations have one safe result 🟢 implemented

Competing creates cannot exceed 500 requests or the file allowance. Competing answer,
edit, submit, cancel and expiry changes cannot overwrite newer committed state;
a stale attempt is refused with retry information. Removal wins against subsequent
new references or copy commits. An already issued upload or an uncertain storage copy
cannot cause early capacity release: removal waits for the recorded operation
lifetime and confirms absence, and durable cleanup watches remove late writes.

### B10 — Activity records actual successful changes 🔵 future

The verified owner receives recorded creation, first opened signal from the running
page, answer changes, submission, edit, cancellation, expiry, Keep and deletion events
at the committed transitions. Retries do not duplicate them; failed operations do not
claim success. Events expire after 90 days independently of request/file lifetime.
The Activity view remains part of its separate delivery chunk. Crawlers, guessed
respondent identities and outside message-delivery claims are excluded.

## Rules (Invariants)

- Owner list, detail, export, file inspection and mutation check verified Ask account
  authority; neither supplied account fields nor public tokens convey ownership.
- Durable retained owner content is authoritative. A failed durable read reports
  unavailable and never falls back to a stale owner payload.
- New durable metadata does not import historical Redis requests or change anonymous
  request/attachment behaviour. Retirement markers cannot be bypassed by fallback.
- One request has one respondent record. There is no website composer or extra AI.
- Public-link expiry, private-token read windows, owned text lifetime, original file
  retention, independent kept lifetime and activity lifetime are separate decisions.
- The file allowance counts originals and kept copies once each, including operations
  awaiting recovery. Request count is released when deletion and original-file cleanup are complete;
  byte release requires confirmed safe object deletion, not merely hiding metadata.
- New source references and successful copy commits are forbidden after removal starts.
- Uploaded contents are sealed before scanning; client upload powers never target the
  sealed or kept object. Scanning cannot bless a later overwrite of the same input key.
- Cleanup waits for outstanding upload/seal/copy deadlines, confirms absence and remains
  retryable. Minimal durable watches cover uncertain late writes after release.
- Kept copies use Ask's own storage authority and allowance; no Share credentials,
  library rows or quota are reused.
- Raw file content is downloaded safely; active HTML/SVG is not executed on the portal
  origin. Detail and JSON exports do not expose storage keys or private access tokens.

## Decision Tables

| Situation | Outcome |
| --- | --- |
| Account has 499 requests; two competing new creates | One accepted; one capacity refusal |
| Same creation identity and same payload retry | Existing request; no extra slot |
| Same creation identity with changed payload | Conflict; original unchanged |
| File fits the remaining exact allowance | Reserved once; new upload may proceed |
| File is one byte beyond allowance | Refused before writable storage access |
| Source clean, retained and visible at Keep commit | Independent retained copy becomes available |
| Source expires/deletes or account closes before Keep commit | Copy remains unavailable and is cleaned safely |
| Source ends after Keep commit | Original ends; independent copy remains |
| Ninety-day original-file deadline reached | Original unavailable; text and eligible kept copy remain |
| Request is submitted; owner attempts edit | Refused; frozen response unchanged |
| Request deletion commits | Payload/link powers gone; slot and original bytes held until cleanup is safe |
| Storage cleanup fails | Reservation retained; recovery scheduled without owner login |
| Another account guesses request/file/copy identifier | No content or management powers |

## User Flows

- **F1 — Keep an attachment:** [contract](./lifecycle.flow.yaml) · [diagram](./lifecycle.flow.mmd) — covers B2–B5, B9.
- **F2 — Delete a retained request:** [contract](./lifecycle.flow.yaml) · [diagram](./lifecycle.flow.mmd) — covers B6–B9.

The Mermaid sibling is generated from the authoritative YAML through the existing
Calm Craft flow generator; it is never edited by hand.

## Open Questions

- **Settled:** 500 retained requests; a separate decimal 1 GB Ask file allowance;
  respondent attachments expire at 90 days; independent eligible Keep is explicit.
- **Settled:** Request-slot release follows deletion and original-file cleanup;
  fileless deletion releases immediately. Storage-byte release waits for confirmed safe
  cleanup. Independent kept copies outlive request removal and do not hold its slot.
- **Settled:** Existing public and private-token windows remain unchanged. Verified
  owners receive separate durable access to new retained work.
- **Implementation prerequisite:** Review Ask-specific signed metadata, storage cleanup
  and scanner configuration before activating the development backend. The current
  scanner has one shared scanner service credential/callback secret by its own
  protocol; the Ask environment references those directly from the scanner service.
  Ask R2 authority and signed metadata authority remain separate from Share. No source
  contract alone authorizes credential changes or backend activation.

## Future Considerations

- Claiming surviving older requests with private management proof.
- Full Activity UI, templates and aggregate reporting across distinct requests.

## Out of Scope

- Historical Redis migration, automatic attachment keeping or another product's quota.
- A browser questionnaire builder, shared multi-respondent form or new AI.
- Teams, billing, source-file attachments from the creator and production cutover.

## Local evidence

- `src/lib/owned-session.test.ts`: retry identity, immutable ownership, CAS conflicts,
  tombstone routing, separate public/agent/owner windows, canonical completion budget,
  safe exports and terminal callback recovery.
- `src/lib/owned-answer-files.test.ts`: staging/seal verification, actual scan-result
  sequencing, outage/infected handling, Keep retries/races, private key stripping,
  deadline/frozen-key cleanup and S3 embedded copy error handling.
- `src/app/api/v1/account/kept-files/route.test.ts`: independent kept-file HTTP access,
  verified owner scope, forged body authority rejection, safe timestamps and cleanup state.
- `src/app/api/v1/account/records/route.test.ts`: verified HTTP and concurrent MCP
  account boundaries; `src/lib/account-records.test.ts` preserves earlier owner APIs.

No credentials, storage buckets or deployed schema are altered by these source tests.


## Development acceptance evidence

The shared portal implementation report at
`/Users/gaz/.codex/worktrees/549c/showmeatsack/.reports/portal-b3-verification.md`
records official generation/activation and passing source gates (Lanyard 367 tests;
Ask 240 tests), genuine two-account authority, real upload/scan/submission/export,
owner access after actual expiry and terminal read window, independent once-charged
Keep, selected deletion and deleted-account cleanup without sign-in. A real callback
outage retained reservations; scheduled retries confirmed physical R2 absence before
releasing counts/bytes. Minimal cleanup watches preserve late-write protection.
The protected first and boundary accounts/Share files were preserved. Temporary
callback settings and infrastructure are restored/removed after acceptance.

The ninety-day and exact allowance/concurrency boundaries use controlled-clock/backend
tests; no ninety-day real-time wait, production activation or historical migration is
claimed. User-flow topology is unchanged, so the generated Mermaid sibling is unchanged.
