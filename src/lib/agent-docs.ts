import { ASKMEATSACK_SKILL_MARKDOWN } from "./askmeatsack-skill";
import { CURSOR_PLUGIN_HREF, cursorInstallPageHref } from "./cursor-install";
import { publicOrigin } from "./public-origin";

export const SITE_TITLE = "askmeatsack.com";
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
  return `# askmeatsack.com

> ${SITE_TAGLINE} ${SITE_DESCRIPTION}

askmeatsack.com is how an agent asks a human a set of questions. Create returns an answer link and a private manage link. The human answers in the browser. The agent can inspect or edit while nobody has answered, then wait, poll, or be called back. MCP and HTTP are the same questionnaire.

## Docs

- [Skill](${origin}/skill.md): How to use the askmeatsack.com tool
- [MCP and HTTP](${origin}/mcp.md): Connect, actions, curl, machine answering
- [Cursor plugin](${CURSOR_PLUGIN_HREF}): MCP plus the skill
- [Home](${origin}/): Human landing page

## Optional

- [llms.txt](${origin}/llms.txt)
`;
}

export function mcpGuideMarkdown(origin = publicOrigin()): string {
  const mcpUrl = `${origin}/mcp`;
  const createUrl = `${origin}/api/v1/sessions`;
  const cursorHref = cursorInstallPageHref(mcpUrl);
  return `# askmeatsack.com

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

There is no API key and no account. Create is open.

## Tool

One tool, named \`askmeatsack.com\`. Actions: \`create\`, \`status\`, \`wait\`, \`cancel\`, \`edit\`.

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

If the respondent is an agent, fetch the answer link with \`Accept: text/markdown\`, or \`machineUrl\` (the same path with \`.md\`). That markdown has the questions, options, submit URL, and JSON Schema. PUT answers as JSON if you already have them. Humans use the HTML answer link in a browser, one question at a time.

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
      <li><a href="${originEscaped}/llms.txt">llms.txt</a></li>
      <li><a href="${originEscaped}/">${title}</a></li>
    </ul>
    <p class="muted">One tool, named askmeatsack.com. Create, inspect or edit on the private manage link, paste the answer link, wait.</p>
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

export function siteJsonLd(origin = publicOrigin()) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_TITLE,
        url: origin,
        description: SITE_DESCRIPTION,
        inLanguage: "en-GB",
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_TITLE,
        url: origin,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        description: `${SITE_TAGLINE} ${SITE_DESCRIPTION}`,
        sameAs: [CURSOR_PLUGIN_HREF],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "GBP",
        },
      },
    ],
  };
}
