import { describe, expect, it } from "vitest";
import { createResendMailer } from "./mailer";

describe("resend mailer", () => {
  it("sends an answers copy with a JSON attachment", async () => {
    const bodies: unknown[] = [];
    const mailer = createResendMailer({
      apiKey: "re_test",
      domain: "askmeatsack.com",
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response("{}", { status: 200 });
      },
    });
    const result = await mailer({
      to: "kerry@example.com",
      title: "Leftovers",
      answersText: "Your answers from askmeatsack.com",
      answersHtml: "<p>Your answers from askmeatsack.com</p>",
      answersJson: "{\"ok\":true}",
    });
    expect(result).toEqual({ ok: true });
    expect(bodies[0]).toMatchObject({
      to: ["kerry@example.com"],
      subject: "Your answers — Leftovers — askmeatsack.com",
    });
    const payload = bodies[0] as { attachments?: Array<{ filename: string }> };
    expect(payload.attachments?.[0]?.filename).toBe("answers.json");
  });
});
