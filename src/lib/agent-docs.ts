import { MARKETPLACE_HREF, pluginInstallMarkdown } from "./plugin-install";
import { ASKMEATSACK_SKILL_MARKDOWN } from "./askmeatsack-skill";
import { CURSOR_PLUGIN_HREF, cursorInstallPageHref } from "./cursor-install";
import { publicOrigin } from "./public-origin";

export const SITE_TITLE = "ask.imeatsack.com";
export const SITE_TAGLINE = "An agent asks. A human answers.";
export const SITE_DESCRIPTION =
  "Create a questionnaire, paste the link, wait. No install, no setup, no dashboard to learn.";

export type McpGetKind = "html" | "markdown" | "protocol";

export function mcpGetDocumentKind(request: Request): McpGetKind {
  if (request.headers.get("mcp-protocol-version")) {
    return "protocol";
  }
  const accept = request.headers.get("accept") ?? "";
  if (/\btext\/event-stream\b/i.test(accept)) {
    return "protocol";
  }
  if (/\bapplication\/json\b/i.test(accept) && !/\btext\/html\b/i.test(accept)) {
    return "protocol";
  }
  if (/\btext\/markdown\b/i.test(accept) || /\btext\/plain\b/i.test(accept)) {
    return "markdown";
  }
  if (/\btext\/html\b/i.test(accept)) {
    return "html";
  }
  return "markdown";
}

export function skillMarkdown(): string {
  return ASKMEATSACK_SKILL_MARKDOWN;
}

export function llmsTxt(origin = publicOrigin()): string {
  return `# ask.imeatsack.com

> ${SITE_TAGLINE} ${SITE_DESCRIPTION}

ask.imeatsack.com is how an agent asks a human a set of questions. Create returns an answer link and a private manage link. The human answers in the browser. The agent can inspect or edit while nobody has answered, then wait, poll, or be called back. MCP and HTTP are the same questionnaire.

## I, Meatsack family

- [I, Meatsack](https://imeatsack.com): Ask, Share and Show.
- [Ask](https://ask.imeatsack.com/llms.txt): Questionnaires for human input.
- [Share](https://share.imeatsack.com/llms.txt): Send and request files.
- [Show](https://show.imeatsack.com/llms.txt): Publish pages and workbooks.

## Docs

- [Homepage in Markdown](${origin}/index.md): Product overview and family navigation.
- [Complete documentation](${origin}/llms-full.txt): Overview, installation, skill and API guide.
- [Install plugin](${origin}/install): Marketplace setup for Codex, Claude Code, and Cursor
- [Skill](${origin}/skill.md): How to use the ask.imeatsack.com tool
- [MCP and HTTP](${origin}/mcp.md): Connect, actions, curl, machine answering
- [Plugin marketplace](${MARKETPLACE_HREF}): Install in Codex, Claude Code, or Cursor
- [Plugin source](${CURSOR_PLUGIN_HREF}): MCP plus the skill
- [Home](${origin}/): Human landing page

## Optional

- [llms.txt](${origin}/llms.txt)

## Answer a questionnaire for your user

If your user gives you an answer link, fetch that same URL with \`Accept: text/markdown\` or append \`.md\` to the path before its query string, keeping the \`t\` token. The document includes every question, saved answers, status, expiry, and JSON Schema.

Send all answers in one \`PUT /api/v1/sessions/{sessionId}/answers?t=…\` with \`Content-Type: application/json\` and \`{"answers": {"questionId": {"text": "Your answer"}}, "submit": true}\`. Use the exact URL, question ids, option ids, and answer shapes from the document. Confirm \`submitted.status\` is \`submitted\`. No account, API key, MCP installation, or browser clicks are needed to answer. Ask your user for missing information rather than inventing answers. The answer link is private; do not publish it in an index.
`;
}

export function mcpGuideMarkdown(origin = publicOrigin()): string {
  const mcpUrl = `${origin}/mcp`;
  const createUrl = `${origin}/api/v1/sessions`;
  const cursorHref = cursorInstallPageHref(mcpUrl);
  return `# ask.imeatsack.com

${SITE_TAGLINE} ${SITE_DESCRIPTION}

This URL is the MCP server. Browsers get a short page. Agents should fetch \`${origin}/mcp.md\` or send \`Accept: text/markdown\`. The Cursor skill is \`${origin}/skill.md\`.

## Connect

- MCP (Streamable HTTP): \`${mcpUrl}\`
- Skill: [${origin}/skill.md](${origin}/skill.md)
- This guide: [${origin}/mcp.md](${origin}/mcp.md)
- HTTP create: \`POST ${createUrl}\`
- Cursor install: ${cursorHref}
- Cursor plugin: [${CURSOR_PLUGIN_HREF}](${CURSOR_PLUGIN_HREF}) — MCP plus the skill
- Grok: [grok.com/connectors](https://grok.com/connectors) — Custom, paste the MCP URL. There is no one-click badge yet.

There is no API key. Create is open today. Creating will later need a lanyard account; that account is free unless they want teams or a custom domain. The person answering never signs in.

${pluginInstallMarkdown(origin)}
## Tool

One tool, named \`ask.imeatsack.com\`. Actions: \`create\`, \`status\`, \`wait\`, \`cancel\`, \`edit\`.

POST JSON-RPC to \`${mcpUrl}\`. Do not invent extra tools, a Slack bot, or a mailer of your own.

## Skill

${skillMarkdown().trim()}

## HTTP

Same questionnaire as the tool.

\`\`\`
POST ${createUrl}
Content-Type: application/json

{
  "title": "Quick check",
  "questions": [{
    "id": "Q1",
    "prompt": "Ship it?",
    "options": [
      {"id": "yes", "label": "Yes"},
      {"id": "no", "label": "Not yet"}
    ]
  }]
}
\`\`\`

Create returns \`answerUrl\`, \`machineUrl\`, \`pollUrl\`, and \`manageUrl\`. Keep the token on \`pollUrl\` and \`manageUrl\` for status, wait, cancel, inspect, and edit. Paste \`answerUrl\` where the human will see it.

- Status: \`GET /api/v1/sessions/{sessionId}?token=\`
- Edit while pending: \`PATCH /api/v1/sessions/{sessionId}?token=\`
- Manage summary: \`GET /s/{sessionId}/manage?token=\` (markdown at \`.md\`)
- Wait: \`POST /api/v1/sessions/{sessionId}/wait\` (at most 60 seconds per call)
- Cancel: \`POST /api/v1/sessions/{sessionId}/cancel\`

## Machine answering

If your user hands you an answer link, you can answer on their behalf. Fetch it with \`Accept: text/markdown\`, or use \`machineUrl\` (append \`.md\` to the path before the query string, preserving the token). The HTML and Link headers advertise this document, and \`/llms.txt\` explains this path.

The document includes every question, option ids, saved answers, current status, expiry, the exact save and submit URLs, and JSON Schema. Read it before preparing answers. Ask your user for any missing information; do not invent answers or select recommended options automatically.

Send one \`PUT\` to the document's answers URL with \`Content-Type: application/json\`, \`answers\` keyed by question id, and \`submit: true\`. This saves and submits together. Confirm \`submitted.status: "submitted"\` in the response. All required questions still need usable answers. To save a draft, omit \`submit\`; to finish a saved draft, POST the submit URL. If an error occurs, valid answers may already be saved: reread the document and correct the problem while it is open. Closed questionnaires cannot be edited.

The public answer token is enough: no account, API key, MCP connection, or browser clicks are required. File questions use the upload endpoint documented in the questionnaire, then returned file ids in the answer body. Humans can still use the browser form, one question at a time.

## Do not

- Index or share questionnaire pages (\`/s/…\`). Those are private links.
- Put the agent status secret or manageUrl on the answering page or anywhere the respondent should not see it.
- Treat Slack (or any other chat) posting as a feature of this product.
`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function mcpGuideHtml(origin = publicOrigin()): string {
  const mcpUrl = `${origin}/mcp`;
  const title = escapeHtml(SITE_TITLE);
  const tagline = escapeHtml(SITE_TAGLINE);
  const description = escapeHtml(SITE_DESCRIPTION);
  const mcpEscaped = escapeHtml(mcpUrl);
  const originEscaped = escapeHtml(origin);
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} MCP</title>
  <meta name="description" content="${tagline} ${description}">
  <link rel="canonical" href="${mcpEscaped}">
  <link rel="alternate" type="text/markdown" href="${originEscaped}/mcp.md">
  <link rel="alternate" type="text/plain" href="${originEscaped}/llms.txt">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${tagline} ${description}">
  <meta property="og:url" content="${mcpEscaped}">
  <meta property="og:site_name" content="${title}">
  <meta property="og:locale" content="en_GB">
  <meta property="og:type" content="website">
  <meta property="og:image" content="${originEscaped}/opengraph-image">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${tagline} ${description}">
  <meta name="twitter:image" content="${originEscaped}/opengraph-image">
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #141820;
      color: #f4f1ea;
      line-height: 1.6;
    }
    main { max-width: 36rem; margin: 0 auto; padding: 4rem 1.5rem; }
    p.brand { color: #9aa3b2; font-size: 0.875rem; }
    h1 { font-size: 1.75rem; font-weight: 500; letter-spacing: -0.02em; }
    a { color: #f4f1ea; }
    code, pre {
      font-family: ui-monospace, monospace;
      font-size: 0.875rem;
    }
    code {
      background: #222836;
      padding: 0.15rem 0.4rem;
      border-radius: 0.4rem;
    }
    ul { padding-left: 1.2rem; }
    .muted { color: #9aa3b2; }
  </style>
</head>
<body>
  <main>
    <p class="brand">${title}</p>
    <h1>${tagline}</h1>
    <p>${description}</p>
    <p>MCP: <code>${mcpEscaped}</code></p>
    <p>POST here for the protocol. For a guide, fetch markdown.</p>
    <ul>
      <li><a href="${originEscaped}/mcp.md">API guide (markdown)</a></li>
      <li><a href="${originEscaped}/skill.md">Skill</a></li>
      <li><a href="${CURSOR_PLUGIN_HREF}">Cursor plugin</a></li>
      <li><a href="${originEscaped}/install">Install plugin</a></li>
      <li><a href="${MARKETPLACE_HREF}">Meatsack plugin marketplace</a></li>
      <li><a href="${originEscaped}/llms.txt">llms.txt</a></li>
      <li><a href="${originEscaped}/">${title}</a></li>
    </ul>
    <p class="muted">One tool, named ask.imeatsack.com. Create, inspect or edit on the private manage link, paste the answer link, wait.</p>
  </main>
</body>
</html>
`;
}

export function markdownResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export function htmlDocumentResponse(body: string, origin = publicOrigin()): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      Link: `<${origin}/mcp.md>; rel="alternate"; type="text/markdown"`,
    },
  });
}

export function plainTextResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}

export function homepageMarkdown(origin = publicOrigin()): string {
  return `# ${SITE_TITLE}

> ${SITE_TAGLINE} ${SITE_DESCRIPTION}

Part of [I, Meatsack](https://imeatsack.com). The shared navigation offers
[Ask](https://ask.imeatsack.com), [Share](https://share.imeatsack.com) and
[Show](https://show.imeatsack.com), with this product selected.

## Connect your agent

- [Install plugin](${origin}/install): Codex, Claude Code and Cursor setup.
- [MCP and HTTP guide](${origin}/mcp.md): Actions, payloads and examples.
- [Workflow skill](${origin}/skill.md): How an agent uses this product.
- [MCP endpoint](${origin}/mcp)
- [Documentation index](${origin}/llms.txt)
- [Complete documentation](${origin}/llms-full.txt)

The agent delivers the human link. Each product has its own MCP server;
I, Meatsack is the shared home, with no combined MCP endpoint.

Built by [Gary Le Sueur](https://gaz.dev).
[Source](${CURSOR_PLUGIN_HREF}) · [Marketplace](${MARKETPLACE_HREF})
Canonical home: ${origin}/
`;
}

export function llmsFullTxt(origin = publicOrigin()): string {
  return `${homepageMarkdown(origin)}\n---\n\n${mcpGuideMarkdown(origin)}`;
}

export function discoveryTextResponse(body: string, contentType: string): Response {
  const origin = publicOrigin();
  return new Response(body, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Cache-Control": "public, max-age=0, s-maxage=3600",
      "X-Robots-Tag": "noindex, follow",
      Link: `<${origin}/>; rel="canonical", <${origin}/llms.txt>; rel="describedby"; type="text/plain"`,
    },
  });
}

export function siteJsonLd(origin = publicOrigin()) {
  const author = { "@type": "Person", name: "Gary Le Sueur", url: "https://gaz.dev" };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: SITE_TITLE,
        url: origin,
        description: SITE_DESCRIPTION,
        inLanguage: "en-GB",
        publisher: author,
        isPartOf: {
          "@type": "WebSite",
          "@id": "https://imeatsack.com/#website",
          name: "I, Meatsack",
          url: "https://imeatsack.com",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#application`,
        name: SITE_TITLE,
        url: origin,
        applicationSuite: "I, Meatsack",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        description: `${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
        author,
        sameAs: [CURSOR_PLUGIN_HREF],
        offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
      },
    ],
  };
}
