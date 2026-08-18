---
id: site-home
area: Site / Home
status: future
---

# The home page

What a person sees when they arrive at askmeatsack.com without knowing what it is. Its job is
to explain the product, prove it, and get an agent connected. `site/discoverability.md` covers
what machines read; this covers what people read.

## Behaviours

### B1 — The page says what this is before anything else 🔵 future

The first thing on the page is a plain sentence explaining what the product does, in words
someone who has never used an MCP tool can follow. Install instructions come after the
explanation, not instead of it.

### B2 — A person can see the handoff, not just read about it 🔵 future

The page shows the two halves of the product side by side — what the agent sends, and what the
person answering sees. Someone who reads nothing else can tell what the product does from the
picture.

### B3 — Connecting an agent takes one click where the client allows it 🔵 future

A person can add the MCP server to their client without copying anything, wherever that client
supports it. Where it does not, the MCP URL is one click to copy, with the plain instruction
that goes with it.

### B4 — The page shows what people actually use it for 🔵 future

Real situations, not a feature list: stopping before a deploy, a decision the spec did not
cover, choosing between drafts, approving a spend, collecting from many people at once, asking
for a file. Someone should recognise their own problem.

### B5 — Anyone can try it without signing in 🔵 future

The page offers a real questionnaire that a visitor can answer and submit, and then shows what
the agent would have received. It needs no account — see the trial behaviour in
`questionnaire/sessions/answering.md`.

### B6 — The page links to its sibling, its source, and its author 🔵 future

showmeatsack.com, the GitHub repository, and gaz.dev are each reachable from the page. Someone
who arrives at one product can find the other.

### B7 — Signing in is reachable, and obviously not required to look 🔵 future

A person can get to their account from the page. Nothing about the page suggests they need an
account to read it or to try it.

### B8 — The two products look like siblings 🔵 future

askmeatsack.com and showmeatsack.com share a layout, a type treatment, and a structure. They
are told apart by one accent colour and their words, not by looking like different companies.

### B9 — It works on a phone 🔵 future

Every part of the page is usable on a narrow screen, including the side-by-side picture in B2,
which stacks rather than shrinking to nothing.

### B10 — Movement is decoration and never required 🔵 future

Any animation on the page can be turned off by a person's own accessibility setting, and the
page loses nothing they needed. Nothing important is only visible mid-animation.

## Rules (Invariants)

- Both products' home pages are the same structure. Only the accent colour and the words
  differ; a change to the shape of one is a change to both.
- The page never promises that no account is needed. Creating a questionnaire needs one. What
  it promises is that there is nothing to install and nothing to configure, and that the person
  answering never signs in.
- The account area lives on lanyard. The home page links to it and never reproduces it.
- Trying it uses the product's own trial path and creates a real questionnaire. It is never a
  mock-up or a video.
- Copy calls the product **askmeatsack.com**.
- Every animation respects a reduced-motion preference.
- The page is readable and usable in both light and dark, following the person's own setting.

## Decision Tables

| Visitor                   | What the page must let them do                          |
| ------------------------- | ------------------------------------------------------- |
| Has never heard of MCP    | Understand what it does, from the words and the picture |
| Wants to see it work      | Answer a real questionnaire, without signing in         |
| Ready to connect an agent | Get the MCP URL, or one-click install                   |
| Prefers the raw API       | Copy a working `curl`                                   |
| Wants the code            | Reach the repository                                    |
| Wants the other product   | Reach showmeatsack.com                                  |
| Already has an account    | Reach their account area on lanyard                     |

| Client                     | Connecting                             |
| -------------------------- | -------------------------------------- |
| Supports one-click install | A button that does it                  |
| Does not                   | Copy the MCP URL, with the instruction |
| Cannot do either           | Copy the `curl`                        |

## User Flows

_None._ The home page is read and scanned, not navigated. Trying it is a single action that
hands over to the answering journey, which has its own contract.

## Open Questions

- Does the "try it" demo stay in a dialog, or become part of the page itself? In a dialog it is
  hidden behind a click; inline it competes with the explanation above it.
- Should the use cases link anywhere, or only describe? Describing is honest while there is
  nothing to link to.

## Future Considerations

- A gallery of real questionnaires people have published, if anyone ever wants theirs shown.
- Showing the same page in more than one language.
- A short recording of the handoff, for people who will not click the demo.

## Out of Scope

- Pricing. There is one plan and it is free.
- A blog, changelog, or documentation site. Agent-facing documents are covered by
  `site/discoverability.md`.
- Sign-up or sign-in screens. Those belong to lanyard.
- Anything that collects a visitor's details.
