import { describe, expect, it } from "vitest";
import { SHARED_BUCKET, clientIpFromRequest } from "./client-ip";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://askmeatsack.com/api/v1/sessions", { headers });
}

describe("B37 — a flood from one account is refused", () => {
  it("uses the address the platform observed", () => {
    expect(
      clientIpFromRequest(requestWith({ "x-vercel-forwarded-for": "203.0.113.7" })),
    ).toBe("203.0.113.7");
  });

  it("takes the left-most entry when the platform sends a list", () => {
    expect(
      clientIpFromRequest(
        requestWith({ "x-vercel-forwarded-for": "203.0.113.7, 198.51.100.1" }),
      ),
    ).toBe("203.0.113.7");
  });

  it("ignores a forged x-forwarded-for", () => {
    // Rotating this header used to buy a fresh bucket on every request.
    const forged = clientIpFromRequest(
      requestWith({ "x-forwarded-for": "1.2.3.4" }),
    );
    const alsoForged = clientIpFromRequest(
      requestWith({ "x-forwarded-for": "5.6.7.8" }),
    );
    expect(forged).toBe(SHARED_BUCKET);
    expect(alsoForged).toBe(SHARED_BUCKET);
    expect(forged).toBe(alsoForged);
  });

  it("ignores a forged x-real-ip", () => {
    expect(clientIpFromRequest(requestWith({ "x-real-ip": "1.2.3.4" }))).toBe(
      SHARED_BUCKET,
    );
  });

  it("does not let a forged header override the platform's", () => {
    expect(
      clientIpFromRequest(
        requestWith({
          "x-forwarded-for": "1.2.3.4",
          "x-real-ip": "5.6.7.8",
          "x-vercel-forwarded-for": "203.0.113.7",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("shares one bucket when nothing trustworthy is present", () => {
    expect(clientIpFromRequest(requestWith({}))).toBe(SHARED_BUCKET);
    expect(clientIpFromRequest(requestWith({ "x-vercel-forwarded-for": "  " }))).toBe(
      SHARED_BUCKET,
    );
  });
});
