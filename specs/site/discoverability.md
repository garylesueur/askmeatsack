---
id: site-discoverability
area: Site / Discoverability
status: implemented
---

# Site discoverability

Public pages tell search engines, answer engines, and agents what askmeatsack.com is. Questionnaire links stay private.

## Behaviours

### B1 — Home carries ordinary share metadata 🟢

The home page has a title, description, canonical URL, Open Graph tags, a large share image, and structured data naming askmeatsack.com. Sharing the home URL in chat or on social media shows that card.

### B2 — Crawlers get a sitemap and robots file 🟢

Crawlers can fetch a sitemap of the public documents (home, MCP page, markdown guide, skill, llms.txt). Robots allow those, and do not ask crawlers to index API routes, questionnaire pages, or the playground.

### B3 — Answer engines get a plain-text index 🟢

`/llms.txt` describes the product in short and lists the skill, the MCP/HTTP guide, and the Cursor plugin. Agents that look for that file can find the rest from it.

### B4 — Pasting the MCP URL yields a guide 🟢

Opening `https://askmeatsack.com/mcp` in a browser shows a short HTML page with the MCP URL and links to the markdown guide, skill, and Cursor plugin. Fetching that same URL as markdown (or with no HTML Accept), or fetching `/mcp.md`, returns a markdown API guide: what the product does, how to connect, the tool actions, curl, machine answering, and the skill.

### B5 — The skill is on the site 🟢

`/skill.md` is the askmeatsack.com skill: create, inspect or edit on the private manage link, paste the answer link, wait, or send a unique questionnaire from an unattended job. It matches the skill shipped for Cursor.

### B6 — Questionnaire pages are not for search 🟢

An answering URL tells crawlers not to index it. The sitemap does not list questionnaires.

### B7 — The repository is an Agent Plugin 🟢

The repository root is an Agent Plugin: a client that understands [Agent Plugins](https://agent-plugins.org/) can install it and get the hosted askmeatsack.com MCP server plus the skill. The plugin skill instructions match `/skill.md`.

### B8 — An answer link previews the ask, never the answers 🟢

Pasting an answer link into Slack or another app that fetches a link preview shows a card describing the ask: the questionnaire title, its context, how many questions there are, roughly how long it takes, and when the link expires. Once a link is submitted, cancelled, or expired the card says so instead of describing the ask.

The card never shows an answer, a question prompt, or an uploaded file, whether or not anyone has started answering.

The card is drawn from the questionnaire's own fields. It is never a screenshot of the answering page, because that page shows whatever has been typed so far.

A crawler arrives with no public token, so the card's URL carries a preview token derived from the session's public token. Someone holding only a session id cannot fetch the card, someone holding the card URL cannot turn it back into the public token, and the public token is not accepted in the preview token's place. A card fetched without a usable preview token names nobody's questionnaire.


## Rules (Invariants)

- Public copy always calls the product **askmeatsack.com**. The tool is named `askmeatsack.com`.
- Questionnaire URLs (`/s/…`) are not in the sitemap and are not offered for indexing.
- A link preview is built only from a questionnaire's title, context, question count, state, and expiry. Answers, prompts, and uploads never reach it.
- The public token never appears in an `og:image` URL, which crawlers, image proxies, and CDNs retain.
- POST to `/mcp` remains the MCP protocol. A documentation GET must not replace a request that is clearly the protocol (MCP version header, JSON, or event-stream Accept).
- The Agent Plugin skill body matches the published `/skill.md` skill.

## Decision Tables

| GET `/mcp` looks like | Response |
| --- | --- |
| Browser HTML Accept | Short HTML guide |
| `text/markdown`, `text/plain`, missing Accept, or `*/*` only | Markdown API guide |
| `mcp-protocol-version`, `application/json` without HTML, or `text/event-stream` | MCP protocol |

## User Flows

_None._

## Open Questions

_None._

## Future Considerations

- Official Cursor Marketplace listing after the public GitHub repo exists.

## Out of Scope

- Indexing or listing live questionnaires.
- A marketing blog or docs site beyond these public files.
- Changing how create, wait, or answering work.
