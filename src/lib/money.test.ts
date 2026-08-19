import { describe, expect, it } from "vitest";
import {
  canonicalMoney,
  entryRowCaption,
  formatEntryValue,
  formatKnownAmount,
  formatMoney,
  isIsoCurrency,
  parseMoney,
} from "./money";

describe("money", () => {
  it("accepts ISO currencies and rejects junk", () => {
    expect(isIsoCurrency("GBP")).toBe(true);
    expect(isIsoCurrency("USD")).toBe(true);
    expect(isIsoCurrency("JPY")).toBe(true);
    expect(isIsoCurrency("gbp")).toBe(false);
    expect(isIsoCurrency("GB")).toBe(false);
    expect(isIsoCurrency("XXX")).toBe(true);
  });

  it("formats sterling and yen with the right fractions", () => {
    expect(formatMoney(2476.8, "GBP")).toBe("£2,476.80");
    expect(formatMoney(6500, "JPY")).toMatch(/6,500/);
    expect(formatMoney(6500, "JPY")).not.toMatch(/6,500\./);
    expect(canonicalMoney(2476.8, "GBP")).toBe("2476.80");
    expect(canonicalMoney(6500.4, "JPY")).toBe("6500");
  });

  it("parses grouped, continental, and symbol-prefixed amounts", () => {
    expect(parseMoney("£2,476.80", "GBP")?.canonical).toBe("2476.80");
    expect(parseMoney("2476.8", "GBP")?.canonical).toBe("2476.80");
    expect(parseMoney("2.476,80", "EUR")?.canonical).toBe("2476.80");
    expect(parseMoney("GBP 840", "GBP")?.canonical).toBe("840.00");
    expect(parseMoney("1,000", "GBP")?.canonical).toBe("1000.00");
    expect(parseMoney("not money", "GBP")).toBe(null);
  });

  it("formats known amounts and money answers without converting", () => {
    const gbpQuestion = { currency: "GBP" };
    expect(formatKnownAmount({ amount: "2476.80" }, gbpQuestion)).toBe("£2,476.80");
    expect(formatKnownAmount({ amount: "1499", currency: "USD" }, gbpQuestion)).toBe("US$1,499.00");
    expect(formatEntryValue({ input: "money" }, gbpQuestion, "6500")).toBe("£6,500.00");
    expect(formatEntryValue({ input: "text" }, gbpQuestion, "rent")).toBe("rent");
    expect(
      entryRowCaption(
        {
          label: "Feb / Mar 2025",
          amount: "2476.80",
          hint: "Direct debit",
        },
        gbpQuestion,
      ),
    ).toBe("Feb / Mar 2025 — £2,476.80 — Direct debit");
    expect(
      entryRowCaption({ label: "PAYE", input: "money", hint: "After the letter" }, gbpQuestion),
    ).toBe("PAYE — money GBP — After the letter");
  });
});
