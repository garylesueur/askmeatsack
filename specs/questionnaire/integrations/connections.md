---
id: questionnaire-integrations-connections
area: Questionnaire / Integrations
status: future
---

# Connecting something you already use

An account already has a Stripe account, a place it keeps files, somewhere its team gets
told things. A **connection** is that account saying *use mine* once, so that afterwards an
agent can name what it wants — take £50, put the answers here, tell that channel — without
ever holding a credential.

Payments are the first one ([taking a payment as part of answering](../questions/payments.md)),
but the rules below are about connections in general, because the dangerous parts are the
same whatever is connected.

## Behaviours

### B1 — An account connects something it already has 🔵 future

A person signed in to an account can connect a service that account uses, following that
service's own sign-in, and see afterwards what is connected. Connecting happens once, in the
account, not in a questionnaire and not in a payload.

### B2 — Only a person connects; an agent only uses 🔵 future

An agent with a token can use what is already connected. It cannot add a connection, change
one, or remove one. An agent that has been talked into something cannot connect an attacker's
payment account and reroute money.

### B3 — An agent never sees a credential 🔵 future

An agent asks for an outcome — raise a payment of this much, put this file there — and this
service does the rest. Keys, tokens and secrets belonging to a connected service are never
returned to an agent, never included in a questionnaire, and never visible on any page.

### B4 — The account is told what it is agreeing to 🔵 future

Before connecting, the account sees in plain words what this service will be able to do with
that connection, and what it will never do. The narrowest access that makes the feature work
is what is asked for.

### B5 — A connection can be removed at any time, and stops mattering at once 🔵 future

Disconnecting takes effect immediately. Nothing new can be done with it from that moment.
What already happened is untouched: payments already taken stay taken, answers already given
stay given, and files already delivered stay delivered.

### B6 — A questionnaire that depends on a missing connection says so 🔵 future

If a connection is removed, expires or fails while a questionnaire is live, the affected
question says plainly that it cannot be completed right now, and the rest of the
questionnaire still works. Nothing is queued in the hope it comes back, and nobody is left
pressing a button that silently does nothing.

### B7 — Connecting never changes what the person answering sees 🔵 future

A connection is between the account and the service it connected. It adds nothing to the
answering page except what a question explicitly asks for. Nobody answering is tracked,
profiled, or handed to a third party because an account connected something.

### B8 — Sending answers somewhere is an export, and is treated as one 🔵 future

A connection that pushes answers, files or photographs out of this service is moving personal
information somewhere else. It is set up deliberately, states exactly what will be sent, and
is recorded every time it runs. It is never the quiet side effect of connecting something for
another purpose.

### B9 — Connections belong to one account, and do not travel 🔵 future

A connection belongs to the account that made it. It is not shared with another account, not
inherited by anybody, and not usable by the sibling product unless that account connects it
there too and says so.

### B10 — Everything a connection does is recorded 🔵 future

Connecting, disconnecting, and every use of a connection appears in that account's record,
with what was done and when. A connection is the most powerful thing an account can hand this
service, so it is the thing whose use is most worth being able to review.

### B11 — Failure is honest and does not lose the answer 🔵 future

When a connected service is down, refuses, or times out, the person answering is told plainly,
their other answers are untouched, and the agent can see that it failed and why. Nothing is
half-done and reported as done.

## Rules (Invariants)

- A person connects. An agent uses. No token, of any kind, can create or alter a connection.
- Credentials for a connected service never leave this service — not to an agent, not into a
  questionnaire, not onto a page, not into a callback.
- The access requested is the narrowest that makes the feature work, and is stated before
  it is granted.
- Disconnecting is immediate, and never reaches backwards into what already happened.
- A connection changes nothing for the person answering except what a question asks of them.
- Anything that sends answers, files or photographs outward is an export: explicit, described,
  and recorded on every run.
- A connection belongs to exactly one account in exactly one product.
- Connect, disconnect and every use are recorded and cannot be edited away.
- A failing connection degrades the question that needs it and nothing else.
- This service never becomes the merchant, the controller of somebody else's data, or the
  party responsible for what a connected service does with it.

## Decision Tables

### Who may do what

| Action | Person signed in to the account | Agent with a token | Person answering |
| --- | --- | --- | --- |
| Connect a service | Yes | Never | Never |
| See what is connected | Yes | Names only, no secrets | Never |
| Use a connection in a question | Yes | Yes | Not applicable |
| See a credential | Never — it is held, not shown | Never | Never |
| Disconnect | Yes | Never | Never |

### When a connection is not available

| Situation | The question that needs it | Everything else |
| --- | --- | --- |
| Never connected | Cannot be created; the agent is told at create | Unaffected |
| Disconnected while live | Says it cannot be completed now | Unaffected |
| Connected service down or refusing | Says so, and can be retried | Unaffected |
| Access expired or revoked at the other end | Treated as disconnected, and the account is told | Unaffected |

## Open Questions

- **Settled 21 Aug 2026 — a connection belongs to one account at one product.** Somebody
  who wants Stripe at both products connects it twice. This follows the plan decision taken
  at the same time: each product keys its own records by the account reference lanyard hands
  out, and nothing crosses the estate. Connecting twice is the visible cost, and it is
  preferable to an estate-wide store that would need lanyard to hold something about a person
  beyond their existence.
- **Blocks B2:** If a team account ever exists, who in it may connect and disconnect? A
  connection is the most dangerous thing to hand somebody, and *anyone on the team* is the
  wrong default.
- Is there a general shape for connections, or is each one built as its own thing? A general
  shape is tempting and usually turns into a plugin system nobody asked for. Two or three
  built plainly first is the safer bet.
- What is the second connection? Payments is decided. Delivering answers into storage the
  account already runs, and telling a channel when somebody has answered, are the obvious
  candidates — and the second is close to something the calling agent already does perfectly
  well by itself.

## Future Considerations

- Delivering answers and files into storage the account already runs.
- Telling a channel or an inbox when a questionnaire is answered, for accounts without an
  agent watching.
- Putting an answer into a tracker or a CRM the account already uses.
- Booking a slot as part of answering, against a calendar the account already keeps.
- The same connection working across showmeatsack.com and askmeatsack.com, if connections
  ever live with the account rather than the product.

## Out of Scope

- Holding credentials for a person rather than an account.
- Letting an agent connect anything, under any circumstance.
- A general plugin system, an app directory, or third parties writing their own integrations.
- Becoming responsible for what a connected service does with what it receives.
- Connections that read from a service on their own schedule. A connection does something
  because a question or an account asked it to, not because time passed.
