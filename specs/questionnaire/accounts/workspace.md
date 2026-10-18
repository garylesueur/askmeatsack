---
id: questionnaire-accounts-workspace
area: Questionnaire / Accounts
status: implemented
---

# Your questionnaires and responses

After signing in through Lanyard, a person can find the questionnaires their agents
created, see what is happening, and read the responses. Creation stays in the person's
existing agent tools; this product does not introduce another AI or a browser form
builder. This extends
[answering a questionnaire](../sessions/answering.md) and the
[retained lifecycle](./lifecycle.md); the account area on Lanyard
continues to manage identity, tokens and agent approvals.

This workspace is the Ask area of the single Meatsack portal at https://meatsack.puregaz.com.
The shared product switcher opens Share or Show without another sign-in; this is not
a separate dashboard hosted on askmeatsack.com.
Signing in from askmeatsack.com opens this portal area using the same account and
browser session as Share and Show. The shared portal contract in lanyard governs
entry destinations, switching and account controls; this spec governs Ask's records.

## Confirmed personal-account policy

The starter allowance is 500 retained requests and 1 GB of retained file storage
per account in this product. Owned requests and text responses remain until owner
deletion within those limits. Respondent-uploaded files have a 90-day default;
explicitly keeping an eligible independent copy uses the owner's storage allowance.
Recent product activity is retained for 90 days independently of content lifetime
and public-link expiry. These decisions were submitted on 2026-10-07. The new-owned resource and portal slice
is verified against Convex Development, real R2 and the scanner; production release
remains separate. Activity is verified in Development on 2026-10-12.

## Behaviours

### B1 — Your requests are findable 🟢 implemented

The signed-in product area lists the account's questionnaires, with title, creation
time, expiry, status and response progress. It can be searched and filtered by status.
An empty account explains how to create its first questionnaire through an agent.

### B2 — A request shows its questions and responses 🟢 implemented

Opening a request shows its questions, saved answers, permitted attachments and the
current progress. Submitted responses can be downloaded using the existing export.
Waiting, opened, in-progress, submitted, cancelled and expired are distinguished.
Existing edit and cancellation rules still apply; signing in does not unlock edits
after someone has answered or change submitted answers.

### B3 — Requests created by your agents appear automatically 🟢 implemented

A questionnaire created with verified authority for the account appears without
copying a manage link into the dashboard. The account can inspect and manage its
questionnaires across devices. A public answer link never grants ownership.

**Implemented resource slice:** HTTP and MCP creation verify a supplied Lanyard
bearer for askmeatsack and attach its immutable account reference. Anonymous creation
remains available without an Authorization header; supplied refused or malformed
credentials fail closed. New verified-owned requests use the signed Convex-backed
store boundary; earlier memory/Redis records retain their existing lifecycle. The
resource supports bounded searchable summaries, complete safe detail, existing
pending edits/cancellation, deletion and owner-only submitted export. Original
attachments are scanned, have a 90-day deadline and may be copied independently into
Kept files. Every owner action checks verified account authority. Lists and detail
omit private management tokens and object keys; detail may offer the currently valid
public answer URL explicitly for sharing. Creation retries may supply a stable
Idempotency-Key (HTTP) or idempotencyKey (MCP), preserving the first request's tokens.

**Verified Development checkpoint — 2026-10-11:** Official Convex generation and
schema/function activation, genuine sign-in, agent-created records, actual respondent
progress/submission, clean scanned R2 uploads, owner exports beyond the terminal
read window and public expiry, pending edit/cancellation, second-account isolation,
independent Keep and scheduled deletion/account cleanup all pass. Kept bytes survived
physical source deletion, then selected disposal released their charge safely. The
portal UI completed its bounded Impeccable review and documentation comparison.
Production release remains separate. Historical private-proof claims are now verified
in Development; recent activity is verified at the C4 Development checkpoint.

**Evidence:** `src/lib/owned-session.test.ts` covers stable retries, owner isolation,
CAS conflicts, retained owner/export access vs public and private-agent deadlines,
terminal callback recovery and byte admission. `src/lib/owned-answer-files.test.ts`
covers actual scan sequencing, outage blocking, copy/delete races and frozen cleanup.
`src/app/api/v1/account/records/route.test.ts` preserves HTTP and concurrent MCP authority.

### B4 — Recent activity helps you see what needs attention 🟢 implemented

**Development checkpoint (2026-10-12):** C4's real create/open/answer/submit/remove
and sharing-receipt checks pass. Owner-scoped reads and safe destinations, exact
90-day expiry/purge, account closure and consumed-receipt replay after removal are
verified. Synthetic storage is disposed and temporary callbacks restored. Evidence:
Show's `.reports/portal-c4-verification.md`. Hosted release remains separate.

The account sees recorded creation, explicit link-sharing actions, the existing opened
signal, response progress, submission, cancellation and expiry, with times and links
to the relevant request. A copied link says it was copied; it does not claim that a
message was delivered. Link-preview crawlers do not count as someone opening it.

The shared [portal activity contract](/Users/gaz/dev/_garylesueur/lanyard/specs/identity/accounts/portal.md#recent-activity-retention-and-observation-contract) governs read boundaries, item targets, replay, late callbacks and account cleanup.

### B5 — Sharing an ask preserves one response per person 🟢 implemented

The owner can copy or share the current request's public answer link for its intended
respondent. Asking an additional person creates a separate questionnaire with its own
answer link and response record. A respondent's onward action is "Ask someone else":
it explains how to connect askmeatsack.com to their existing agent and create a fresh
request under their own account. It does not create another AI or a website questionnaire
composer, and copies no answers, attachments or private context from the original.
The agent creates an independent request with verified account authority; answering
the original does not require sign-in.

### B6 — Finding the product from a request is easy 🟢 implemented

The answering and completion pages provide a small route to askmeatsack.com so someone
who received an ask can discover how to create their own. This never prevents them
answering, submitting or downloading their responses.

The optional "Ask someone else" guidance stays below the current task. It explains
connecting the person's existing agent, signing in to their own account when asked,
and creating one new questionnaire per person. Product and installation links open
separately, preserving the current questionnaire. They carry no answer link, tokens,
answers, attachments or private context, including in the referring address.

### B7 — Older requests can be claimed with private proof 🟢 implemented

**Development checkpoint (2026-10-12):** Private-proof claims, account separation, original expiry/content retention and explicit portal review/confirmation are verified. Temporary callbacks and disposable test content are cleaned up. Hosted release remains separate.

A signed-in person can claim a surviving unowned questionnaire using its valid private
manage secret. It then appears in their account. A public answer link is insufficient;
already-owned requests cannot be taken from another account, and deleted data cannot
be recovered. Claiming does not silently extend the original request's expiry.

## Rules (Invariants)

- Every list, detail, attachment and management action checks account authority.
- The signed-in management UI lives in the shared portal and uses its existing
  Lanyard session, product switcher and account settings.
- Lanyard sign-in alone never grants access to another account's questionnaires.
- Answering remains available through the existing public link without sign-in.
- New questionnaires are composed and created through the person's existing agents.
  The website manages requests and responses, without adding an AI or form builder.
- One questionnaire collects one person's response; onward sharing cannot turn it
  into a multi-respondent form.
- Public sharing controls never distribute manage secrets or response exports.
- Historical records without verified ownership are not assigned by title, email
  text, a public answer link or supplied metadata.
- Activity describes observed events, not assumed message delivery or respondent identity.
- A dashboard does not extend retention silently; unavailable answers are labelled
  unavailable rather than presented as an empty response.
- Account-owned questionnaires and text responses are intended to remain until the
  owner deletes them, within stated account limits. Respondent-uploaded attachments
  have a separate time-limited default; request-link expiry is independent of both.

## Decision Tables

| Person and action | Outcome |
| --- | --- |
| Signed-in owner opens a request | Questions, progress, retained responses and permitted management |
| Another account opens its guessed private address | No request data |
| Respondent opens the public answer link | Existing answer flow, without sign-in |
| Owner asks an additional person | Separate request and answer link |
| Respondent chooses Ask someone else | Connect their existing agent to create a fresh ask; original private data stays private |
| Signed-in person presents valid private proof for an unowned surviving request | Claim it without changing its existing public expiry |
| Responses have passed their retention window | Unavailable state; no promise to recover deleted data |

## User Flows

- **F3 — Claim surviving anonymous work:** [contract](./workspace-claim.flow.yaml) · [diagram](./workspace-claim.flow.mmd) — covers B7.

- **F1 — Respondent discovers how to ask someone else:**
  [contract](./workspace.flow.yaml) · [diagram](./workspace.flow.mmd) — covers B5/B6.
- **F2 — Owner shares the current answer link:**
  [contract](./workspace.flow.yaml) · [diagram](./workspace.flow.mmd) — covers B4/B5.
- The [retained lifecycle](./lifecycle.md#user-flows) owns explicit Keep and request
  deletion contracts. Kept files remain separately findable in Ask after source
  request removal, with authenticated inspection, download and deletion.
- Claiming older work through sign-in needs its own scoped contract before
  implementation; creation continues through the existing agent route.

## Open Questions

- **Settled:** One portal hosts all three product workspaces with a persistent switcher.
- **Settled:** Creation remains agent-driven. The product plugs into the tools people
  already use; it does not add another AI or a browser questionnaire creator.
- **Settled:** Surviving older requests can be claimed using private management proof
  (B7), never a public answer link or an inferred identity.
- **Settled:** The account-retention direction is until owner deletion, within stated
  limits; files uploaded by other people instead receive a time-limited default.
- **Settled:** Starter limits are 500 retained requests and 1 GB of retained file
  storage per account; respondent-uploaded files have a 90-day default. Explicit
  eligible independent copies consume the owner's storage allowance.
- **Settled:** Recent activity is retained for 90 days independently of content.
- **Settled:** New owned requests have durable owner access under the
  [retained lifecycle](./lifecycle.md). Public and private agent-token windows remain
  separate; legacy and anonymous content retain the existing one-hour terminal policy.

## Future Considerations

- Reusable questionnaire templates and aggregate reports across distinct requests.
- One activity view across the three products, beyond each product's own history.

## Out of Scope

- A multi-respondent public form sharing one response record.
- A browser questionnaire creator or a separate Meatsack AI.
- Contact management, automated reminders or delivery tracking in outside messaging apps.
- Database migration or changes to R2 storage.
