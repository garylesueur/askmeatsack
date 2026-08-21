---
id: questionnaire-domains-custom-domains
area: Questionnaire / Domains
status: future
---

# Asking from your own domain

A person asked to answer questions looks at the link before they click it, and looks at the
page before they type into it. An account can point a domain it owns at
**askmeatsack.com** so the questions arrive from a name the person already recognises,
with that account's own mark on the page.

This spec extends [answering a questionnaire](../sessions/answering.md). Creating,
answering, autosave, submit, expiry, the manage link, waiting and callbacks are unchanged
and are not restated here.

## Behaviours

### B1 — An account asks from a domain it owns 🔵 future

An account can add a domain it controls. Once it is working, that account's new
questionnaires get links on that domain, and answering works exactly as it does today. Only
the host in the link, and the mark on the page, are different.

### B2 — A domain is proved before anything is served from it 🔵 future

Adding a domain serves nothing. The account is given something to put in that domain's
DNS, and until we can see it, no questionnaire is served there. No account can attach a
domain it does not control, and no account can take a domain another account has proved.

### B3 — A questionnaire host is kept away from anything that signs people in 🔵 future

A page that collects answers, and sometimes files and photographs, should not sit where a
browser treats it as part of a domain that also carries an application or a session. The
domain is checked before it is accepted, the account is warned in plain words, and a host
under a domain we can see carries a live application is refused. A dedicated domain, or a
subdomain used for nothing else, is what is accepted.

### B4 — The certificate is our problem, not theirs 🔵 future

The account does not manage certificates or renewals, and a link already sent to somebody
keeps working. If a renewal cannot be completed, the account is told before anything
stops, and the questionnaire stays reachable on the default host (B7).

### B5 — The page carries their mark 🔵 future

On a questionnaire served from an account's own domain, the page shows that account's name
and a link they choose, in place of ours. The questions, the evidence beside them, and the
answering itself look and behave exactly as they do today.

### B6 — Our mark can be removed, by an account that pays 🔵 future

An account on a paying plan can have the page say nothing about askmeatsack.com. A free
account keeps our mark. On this product that is not only a preference: our name is part of
how a stranger works out what they are being asked to fill in, so removing it is tied to an
account we can identify and hold responsible (B12).

### B7 — Losing the domain does not lose the answers 🔵 future

A questionnaire is always reachable on the default host as well as on the account's domain.
If the domain stops resolving, the certificate lapses, the domain is removed, or the plan
ends, a link already sent to a person still opens, and answers already given are still
there. Nobody loses a half-finished answer because of a billing failure.

### B8 — Giving a domain up does not leave a door open 🔵 future

Removing a domain, or closing an account, stops that host being served at once, and no
other account can take it over without proving control themselves. A domain still pointing
at us but no longer claimed serves nothing — it never serves the next account's questions
from the last account's name.

### B9 — Custom domains are for accounts that pay 🔵 future

Adding a domain needs an account and a plan that includes it. Asking without a domain stays
as it is, including for free accounts and for the home-page try-it (B36 of
[answering](../sessions/answering.md)), which never runs on anybody's domain.

### B10 — A link preview from their domain names them 🔵 future

A questionnaire link pasted into Slack or email previews with that account's name rather
than ours, on their host. What the preview says is still about that questionnaire, and
never reveals the questions or anybody's answers.

### B11 — Where answers go does not change 🔵 future

The host a person answered on changes nothing about where the answers went: the same
account, the same manage link, the same callback, the same expiry. A custom domain is a
front door, not a different building.

### B12 — A domain is not a costume 🔵 future

A page on a familiar-looking domain, carrying a chosen name, asking for documents and
photographs, is precisely what somebody running a scam would want to build. So what an
account may claim in its mark is checked, a domain or a mark passing itself off as somebody
else is refused, reports reach a person, and a domain can be stopped without deleting the
account. This matters more here than on a page somebody only reads.

### B13 — The person answering can still find out what this is 🔵 future

However a questionnaire is branded, a person answering can always reach a plain explanation
of what this service is, who is asking, and what happens to what they type. Removing our
mark (B6) removes our name from the page; it never removes that.

## Rules (Invariants)

- No host is served before control of it is proved, and no two accounts hold the same host.
- A questionnaire is always reachable on the default host. A custom domain is an addition,
  never a replacement.
- Nothing about domains or branding changes the questions, the answers, who can read them,
  the manage link, expiry, or the callback.
- A questionnaire host is never placed where a browser would treat it as part of a domain
  carrying a sign-in, an application, or session cookies.
- Certificates, renewal and the default-host fallback are ours to run. An account hears
  before a link breaks, not after.
- Removing a domain stops it being served immediately, and releases it to nobody.
- Custom domains and mark removal need a paying plan. A person's part-finished answers never
  depend on somebody else's billing.
- What an account may claim in its mark is checked, on a product where a stranger is being
  asked to hand something over.
- A person answering can always find out what this service is and who is asking, on any
  host and under any branding.
- The home-page try-it never runs on an account's domain.

## Decision Tables

### Adding a domain

| Situation | Outcome |
| --- | --- |
| Domain proved, used for nothing else | Accepted and served |
| Proof not yet visible in DNS | Nothing served; the account is told what is missing |
| Domain already proved by another account | Refused |
| Host sits under a domain we can see carries a live application | Refused, with the reason |
| Account has no plan that includes domains | Refused |
| Mark claims to be somebody else | Refused |

### Which host serves a questionnaire

| State | Custom host | Default host |
| --- | --- | --- |
| Domain proved, plan live | Serves it | Also serves it |
| Domain removed, or plan ended | Serves nothing | Serves it, answers intact |
| Domain never proved | Serves nothing | Serves it |
| Cancelled, submitted or expired | As today, on either | As today |

## Open Questions

- **Settled 21 Aug 2026 — each product carries its own plans, keyed by the account
  reference lanyard hands out.** lanyard's two decisions stand untouched: one free plan and
  no plan concept, and verification returns an account reference and nothing else. The cost
  is a plan table and a billing integration in each product that needs one; the thing bought
  is that the tightest contract in the estate does not have to be reopened, and that nobody
  ever expects verification to hand out more than it does. Answered together with the
  connection-scope question in [connecting something you already use](../integrations/connections.md),
  as that spec asks.
- **Blocks B12:** Who checks a mark, and how quickly? This product carries more risk than
  its sibling: an unbranded page asking for a passport photograph is suspicious, and a
  branded one on a familiar domain is not. Whatever the answer is, it needs a person in it.
- **Blocks B3:** How much can we actually see about what else a domain is used for? A
  refusal we cannot enforce is a warning, and it should be written down as what it is.
- Does the mark travel to the JSON an agent reads back, or is it only ever on the page?
- Does an account get several domains, and can a questionnaire pick one at create time — a
  consultancy asking on behalf of two different clients would want that.

## Future Considerations

- More of the page under their control: a logo, a colour, a typeface.
- The same domain serving both askmeatsack.com and showmeatsack.com surfaces, so one client
  sees one name across a page they were shown and a form they were asked to fill in.
- Custom wording of the standing explanation in B13, in their voice rather than ours.
- Bringing a certificate they already hold.
- A sender name on the delivery an agent sends, matching the domain.

## Out of Scope

- Selling or registering domains. An account brings one it already owns.
- Running DNS, or editing an account's records for them.
- Changing how a questionnaire behaves based on its host.
- Removing the standing explanation of what this service is (B13). Branding replaces our
  name on the page, never the person's ability to find out what they are answering.
- Per-questionnaire branding chosen by the calling agent. Branding belongs to the account.
