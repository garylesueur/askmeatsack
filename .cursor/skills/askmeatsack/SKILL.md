# askmeatsack.com

Create a questionnaire, put the answer link where the human will see it, then wait. Do not invent another form or a Slack bot.

The product is **askmeatsack.com**. The tool is named `askmeatsack.com`. HTTP and the tool are the same questionnaire. Answer links look like `https://askmeatsack.com/s/…`.

There is no API key and no account. Create is open. After create, keep `pollUrl` (or its `token`) and `manageUrl` for status, wait, cancel, inspect, and edit.

Use this in a live chat, or from an unattended job that still needs facts, files, or an ID from a person.

## In this conversation

1. Call `askmeatsack.com` with action `create` (or `POST /api/v1/sessions`). Send title, optional context, the questions, and optional expiry, metadata, callback URL, or `appearance` (`theme`: `ask`, `paper`, `grove`, or `ember`). Omit `appearance` to follow the person’s system light or dark. Each theme has both modes. Set `mode` to `light` or `dark` only if you must force one. Set `allowFiles` on a question if they should attach files (they can choose, drop, or take a photo; at most five, 4 MB each). The human sees one question at a time, can jump back via the step numbers, and reviews before submit. This service does not score answers — you interpret them.
2. You always get `answerUrl`, `machineUrl`, `pollUrl`, and `manageUrl` immediately. Paste **`answerUrl` into this conversation** so the person answering can open it. Keep `manageUrl` for yourself: open it, or fetch it as markdown, to see the questions and status. The manage page is a stacked owner summary — it is not what the human sees. While nobody has answered, action `edit` (or `PATCH` the session) can change title, context, questions, appearance, or expiry. The answer link stays the same. If the respondent is an agent, they can fetch `answerUrl` with `Accept: text/markdown`, or `machineUrl`, then PUT answers as JSON. Do not wait for them to ask for the link.
3. Wait with action `wait` (pass `sessionId` and `agentToken` from `pollUrl`; at most 60 seconds per call; loop if you need longer), poll `status` the same way, or use `callbackUrl` if you set one. On a terminal status the service POSTs `{ sessionId, status, answers }` to that URL once. A failed POST does not undo the status.
4. When status is `submitted`, continue with the answers. `expired` and `cancelled` are finished too — do not keep asking.

## When you are running a job

You do not need a human in this chat. If you were given work to fill records, chase missing facts, or collect files and you cannot find them, ask. A Grok bot populating HR, a nightly sweep, or any unattended run is the same product.

One person, one questionnaire. Each ask is unique to what you still need from that person — their ID, a passport scan, leftover invoices, a missing field. Do not reuse one `answerUrl` across a list. Two people on one link overwrite each other.

Put their record key (employee id, ticket, email) in `metadata` so you can match the answers when they come back. The human never sees that metadata.

Put `answerUrl` wherever you already reach them — chat, mail, or anything else you can already send. This service does not send mail. Set `callbackUrl` if you will not sit waiting in a conversation; you can still poll `status` or `wait` later. On a terminal status the service POSTs `{ sessionId, status, answers }` once. Then continue the job with those answers.

## What a question can carry

The prompt is the ask — one short sentence the human can read as a heading. Put the situation in `detail` as a lump of markdown: prose, lists, tables, links or bare URLs, images, and mermaid code fences (language mermaid). Do not jam a brief, a table of figures, and the ask into `prompt`.

Prompts and `detail` are markdown. On a wide screen the human sees `detail` in a rail beside the question; on a narrow screen it sits under the prompt. Option labels stay plain text. Raw HTML is not rendered.

Use that when you need more than a tap: leftover invoices, a sketch of a situation, a policy link, a diagram. Keep tap-only questions short when you want speed — a single choice with no comment or files advances as soon as they pick.

Do not use “I will answer in the comment” when the human should fill in known rows or named amounts. Use `items` (two to sixteen rows, each with `id`, `label`, optional `hint`) or `fields` (two to eight named boxes). The human types beside each row. Answers come back as `entries` keyed by those ids. A question cannot mix options, items, and fields.

`allowComment` is only valid on a choice, items, or fields question. Do not set it on free text or on a photo-only question (no options, items, or fields). Free text already is the comment; `allowFiles` does not make a comment legal. Photo plus comment works when the question also has options, items, or fields.

For money, set `input: "money"` and an ISO 4217 `currency` on the row or the question (`GBP`, `USD`, `EUR`). Put a known figure in `amount` as a canonical decimal (`2476.80`), not in the label. The human sees a formatted amount, and a currency-prefixed box when they type money. Answers stay canonical decimals in that currency. Do not convert. Mixed currencies are per-row. If a choice option is an amount, put the symbol in the label (`£6,500`).

If you were sent an askmeatsack.com `/s/…` link and you already have the answers, fetch it as markdown and PUT. If you do not, give the HTML link to the human. Do not invent answers.

## Someone who is not in this conversation

Giving `answerUrl` to them (in chat, mail, Slack, or anywhere you can already post) is **your** job. This service does not send mail and does not post to other chats. Then wait the same way as above.

## Do not

- Name extra tools. There is one tool, `askmeatsack.com`, with actions `create`, `status`, `wait`, `cancel`, and `edit`.
- Put the agent status secret or `manageUrl` on the answering page or anywhere the respondent should not see it.
- Treat Slack (or any other chat) posting as a feature of this product.
- Share one answer link across a list of people, or invent a second form because the ask is automated.
