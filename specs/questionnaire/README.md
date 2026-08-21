# Questionnaire

**askmeatsack.com** — an agent asks a human questions. The tool is named askmeatsack.com. Create returns a link for the conversation or for an unattended job; the calling agent delivers it.

| Spec | Covers | Status |
| --- | --- | --- |
| [Answering a questionnaire](./sessions/answering.md) | Create, inline link, unattended one-per-person send, skill wait, one question at a time, evidence rail, review, autosave, text, choice, items, fields, files (choose, drop, or take a photo), recommended, opened, submit, cancel, expiry, JSON download, wait, callback, both doorways. Sections, welcome, named sources, and richer device capture are specified as future. | partial |
| [Asking from your own domain](./domains/custom-domains.md) | Proving a domain, keeping a questionnaire host away from a sign-in, certificates, their mark instead of ours, removing ours on a paid plan, always reachable on the default host, no takeover on release, impersonation refused | future |
| [Questions you answer by moving things](./questions/arranging.md) | Ordering, sorting into groups, changing a flow, structure in and structure out, the changes as well as the end state, accepting unchanged, phones get a list not a canvas, opening a diagram bigger | future |
| [Asking somebody for photographs](./questions/photos.md) | A named set of shots, an example while framing, the camera opening on the shot, photographs returned labelled, mechanical checks with no trap, location stripped, identity never verified | future |
| [Taking a payment as part of answering](./questions/payments.md) | Card details never reaching this service, the asking account as merchant, identified accounts only, no disguise plus a card field, receipts not instruments, card numbers refused in text answers | future |
| [Connecting something you already use](./integrations/connections.md) | Account-level connections, only a person connects and only an agent uses, credentials never reaching an agent, immediate disconnect, sending answers out treated as an export, every use recorded | future |

Read [answering](./sessions/answering.md) before changing how sessions are created, delivered, answered, waited on, or cancelled.
