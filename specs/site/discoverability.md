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

Crawlers can fetch a sitemap of the public documents (home, MCP page, markdown guide, skill, llms.txt). Robots allow those, and do not ask crawlers to index API routes or questionnaire pages.

### B3 — Answer engines get a plain-text index 🟢

`/llms.txt` describes the product in short and lists the skill and the MCP/HTTP guide. Agents that look for that file can find the rest from it.

### B4 — Pasting the MCP URL yields a guide 🟢

Opening `https://askmeatsack.com/mcp` in a browser shows a short HTML page with the MCP URL and links to the markdown guide and skill. Fetching that same URL as markdown (or with no HTML Accept), or fetching `/mcp.md`, returns a markdown API guide: what the product does, how to connect, the tool actions, curl, machine answering, and the skill.

### B5 — The skill is on the site 🟢

`/skill.md` is the askmeatsack.com skill: create, inspect or edit on the private manage link, paste the answer link, wait, email and wait, or send a unique questionnaire from an unattended job. It matches the skill shipped for Cursor.

### B6 — Questionnaire pages are not for search 🟢

An answering URL tells crawlers not to index it. The sitemap does not list questionnaires.

### B7 — The repository is an Agent Plugin 🟢

The repository root is an Agent Plugin: a client that understands [Agent Plugins](https://agent-plugins.org/) can install it and get the hosted askmeatsack.com MCP server plus the skill. The plugin skill instructions match `/skill.md`.

## Rules (Invariants)

- Public copy always calls the product **askmeatsack.com**. The tool is named `askmeatsack.com`.
- Questionnaire URLs (`/s/…`) are not in the sitemap and are not offered for indexing.
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

- Per-questionnaire Open Graph cards (title only, no answers) if sharing an answer link in Slack becomes common.
- Official Cursor Marketplace listing after the public GitHub repo exists.

## Out of Scope

- Indexing or listing live questionnaires.
- A marketing blog or docs site beyond these public files.
- Changing how create, wait, or answering work.
