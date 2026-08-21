---
id: questionnaire-questions-payments
area: Questionnaire / Questions
status: future
---

# Taking a payment as part of answering

A repairer asks for photographs of the damage and the excess at the same time. A firm
onboarding a client asks for details and a deposit. The payment is part of the same errand
as the questions, and sending somebody to a second link loses half of them.

It is also the single most dangerous thing this product could add, for reasons that have
little to do with money and everything to do with what it would make this service look like.
This spec is written so that the dangerous version cannot be built by accident.

It extends [answering a questionnaire](../sessions/answering.md).

## Behaviours

### B1 — A question can ask for a payment 🔵 future

A question can ask the person answering to pay an amount the agent set, in a stated currency,
for a stated reason. Paying happens on the payment provider's own pages, and they come back
to finish the questionnaire.

### B1a — The payment is raised on the account's own payment provider 🔵 future

The account connects its own payment account once (see
[connecting something you already use](../integrations/connections.md)), and from then on a
question can name an amount and a reason and this service raises the request on that
provider, in that account's name. Nothing about payments is configured per questionnaire, and
no agent ever handles a credential.

### B2 — This service never sees a card 🔵 future

Card details are entered directly into the payment provider's own fields and go straight to
them. They do not pass through this service, are not stored here, and are never visible to
the agent that asked. What comes back is that a payment succeeded, when, for how much, the
last few digits, and the provider's reference.

### B3 — The money goes to the account that asked, not to us 🔵 future

The account asking for the payment is the merchant. Funds go to them, they are responsible
for what was sold, and this service never holds anybody's money. Refunds, disputes and
chargebacks are between the payer, that account, and the payment provider.

### B4 — Only an identified account can ask for money 🔵 future

Asking for a payment requires an account that has been through the payment provider's own
checks. An anonymous questionnaire, a free account, and the home-page try-it can never ask
for money. There is no path where somebody nobody has identified can put a card field in
front of a stranger using our name.

### B5 — Payment and disguise cannot be combined 🔵 future

A questionnaire served from an account's own domain, with our name removed
([asking from your own domain](../domains/custom-domains.md)), cannot also ask for a payment
unless that account has been verified by a person here. Familiar domain, unfamiliar branding,
no mention of who is really running it, and a card field is a description of a phishing page.

### B6 — The person always knows who is being paid 🔵 future

Before paying, the person sees who they are paying, how much, in what currency, and what for
— in the merchant's real trading name, not a name an account typed for itself. That statement
is not something branding or a custom domain can change.

### B7 — Nothing is charged twice 🔵 future

A person who presses pay twice, loses signal, or reopens the link pays once. A payment that
succeeded is shown as already paid rather than offered again.

### B8 — A dead questionnaire cannot take money 🔵 future

Once a questionnaire is submitted, cancelled or expired, no payment can be started or
completed on it. A payment already taken is unaffected — it stays paid, and the agent still
sees it.

### B9 — Failing to pay does not destroy the rest 🔵 future

A refused card, an abandoned payment, or a person who changes their mind loses none of their
other answers. Whether an unpaid questionnaire can be submitted at all is the agent's choice,
stated to the person before they start.

### B10 — The agent learns the outcome, never the instrument 🔵 future

The agent receives paid or not, the amount, the currency, the time, the last few digits, and
the provider's reference — the same things it would see on a receipt. It never receives a
card number, an expiry date, a security code, or a token it could charge again.

### B11 — A refund is not asked for here 🔵 future

This service does not take refunds, does not reverse payments, and does not act as anybody's
support desk. It says who to contact — the merchant — and stays out of it.

### B12 — No question can become a card field by accident 🔵 future

A card number typed into an ordinary text answer is refused and not stored, and the person is
told to use the payment question instead. This holds whether or not payments are ever built,
because the way this product gets into trouble is somebody asking for card details in a text
box and this service dutifully keeping them.

## Rules (Invariants)

- Card details never reach this service, in any question, by any route. There is no
  configuration in which they do.
- Payments are raised on the account's own connected provider. This service holds no payment
  credential of its own, and no agent ever sees one.
- The account asking is the merchant. This service never holds funds and never becomes the
  seller.
- Asking for money requires an identified account. Anonymous, free, and try-it can never ask.
- Who is being paid, and how much, is always shown in the merchant's real trading name, and
  cannot be restyled or hidden by branding.
- Removing our name and asking for money cannot be combined without a person here having
  verified that account.
- Payment outcomes are receipts: amount, currency, time, last digits, reference. Never an
  instrument, never a reusable token.
- A submitted, cancelled or expired questionnaire cannot take a payment.
- One payment per request, however many times a person presses.
- The account asking decides what happens to the data it collects; this service holds it on
  their behalf and for no purpose of its own.
- Refunds and disputes are the merchant's, always.

## Decision Tables

### Who may ask for a payment

| Account | May ask |
| --- | --- |
| No account (try-it, anonymous) | Never |
| Free account | Never |
| Paying account, identified by the payment provider | Yes |
| Paying account, own domain, our name still shown | Yes |
| Paying account, own domain, our name removed | Only if verified by a person here (B5) |

### What comes back

| | Reaches this service | Reaches the agent |
| --- | --- | --- |
| Card number, expiry, security code | Never | Never |
| A token that could be charged again | Never | Never |
| Paid or not, amount, currency, time | Yes | Yes |
| Last few digits, provider reference | Yes | Yes |
| Who paid, beyond what they answered | No | No |

## Open Questions

- **Settled:** A payment is a link raised on the account's own connected payment provider,
  not a card field this service renders. The account connects its provider once, an agent
  names an amount, the person pays on the provider's pages, and this service learns only the
  outcome. It is a fraction of the work, it keeps the compliance surface with the provider
  where it belongs, and it removes the version of this feature that was worth being
  frightened of. Recorded as B1a and B2.
- **Blocks B4, B5:** Who verifies an account, on what evidence, and how quickly? Every rule
  here leans on identification. Without somebody actually doing it, B4 and B5 are decoration.
- **Blocks B3:** Being the platform in somebody else's payments is a business decision with
  contractual and regulatory weight, not a feature toggle. It needs an answer from whoever
  carries that liability before any of this is designed further.
- Does an unpaid questionnaire submit? Agent's choice today (B9), but a default is needed,
  and the kind default is that answers are never held hostage.
- Should the same refusal in B12 extend beyond card numbers — national insurance and social
  security numbers, passport numbers — given this product already asks people for documents
  and photographs?

## Future Considerations

- Accepting a payment link the merchant made by hand, for accounts that would rather not
  connect anything.
- Showing a receipt back to the person after they answer.
- Amounts the agent calculates from earlier answers, rather than fixed at create.
- Paying by means that are not cards, where the provider offers them.

## Out of Scope

- Holding, transmitting or storing card details. Not now, not behind a flag.
- Being the merchant, the seller, or anybody's payment institution.
- Refunds, disputes, chargebacks and support for a purchase.
- Subscriptions or anything recurring taken from somebody answering a questionnaire.
- Storing anything that could be used to charge somebody again.
- Deciding whether what an account is selling is legitimate. That is the payment provider's
  job and, before it, the job of whoever identified the account.
