export type SendEmailInput = {
  to: string;
  title?: string;
  answerUrl?: string;
  answersText?: string;
  answersHtml?: string;
  answersJson?: string;
};

export type SendEmailResult = { ok: true } | { ok: false; message: string };

export type Mailer = (input: SendEmailInput) => Promise<SendEmailResult>;

export function createResendMailer(deps: {
  apiKey?: string;
  domain?: string;
  fetchImpl?: typeof fetch;
}): Mailer {
  return async (input) => {
    if (!deps.apiKey || !deps.domain) {
      return { ok: false, message: "Mail is not configured" };
    }

    const domain = deps.domain.replace(/^@/, "");
    const fromAddress = domain.includes("@")
      ? domain
      : `noreply@${domain}`;
    const from = `askmeatsack.com <${fromAddress}>`;
    const title = input.title?.trim() || "a questionnaire";
    const isAnswersCopy = Boolean(input.answersText && input.answersJson);
    const subject = isAnswersCopy
      ? `Your answers — ${title} — askmeatsack.com`
      : `${title} — askmeatsack.com`;
    const text = isAnswersCopy
      ? (input.answersText ?? "")
      : `Please answer this questionnaire on askmeatsack.com:\n${input.answerUrl ?? ""}\n`;
    const html = isAnswersCopy
      ? (input.answersHtml ?? `<pre>${input.answersText ?? ""}</pre>`)
      : `<p>Please answer this questionnaire on askmeatsack.com:</p><p><a href="${input.answerUrl}">${input.answerUrl}</a></p>`;

    const body: Record<string, unknown> = {
      from,
      to: [input.to],
      subject,
      text,
      html,
    };
    if (isAnswersCopy && input.answersJson) {
      body.attachments = [
        {
          filename: "answers.json",
          content: Buffer.from(input.answersJson, "utf8").toString("base64"),
        },
      ];
    }

    try {
      const fetchImpl = deps.fetchImpl ?? fetch;
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${deps.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        return {
          ok: false,
          message: `Mail provider refused the send (${response.status})`,
        };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Mail provider failed" };
    }
  };
}
