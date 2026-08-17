const ISO_CURRENCY = /^[A-Z]{3}$/;

export function isIsoCurrency(code: string): boolean {
  if (!ISO_CURRENCY.test(code)) {
    return false;
  }
  try {
    new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(
      1,
    );
    return true;
  } catch {
    return false;
  }
}

export function currencyFractionDigits(currency: string): number {
  const digits = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  return digits ?? 2;
}

export function currencySymbol(currency: string): string {
  const parts = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).formatToParts(0);
  for (const part of parts) {
    if (part.type === "currency") {
      return part.value;
    }
  }
  return currency;
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

export function canonicalMoney(amount: number, currency: string): string {
  const digits = currencyFractionDigits(currency);
  const factor = 10 ** digits;
  const minor = Math.round(amount * factor);
  return (minor / factor).toFixed(digits);
}

export function parseMoney(
  raw: string,
  currency: string,
): { amount: number; canonical: string } | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let text = trimmed.replaceAll(currency, "");
  text = text.replaceAll(currencySymbol(currency), "");
  text = text.replace(/[£$€¥]/g, "");
  text = text.replace(/\s/g, "");
  if (text === "" || text === "-" || text === "." || text === ",") {
    return null;
  }

  let normalised = text;
  const hasDot = text.includes(".");
  const hasComma = text.includes(",");
  if (hasDot && hasComma) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      normalised = text.replaceAll(".", "").replace(",", ".");
    } else {
      normalised = text.replaceAll(",", "");
    }
  } else if (hasComma && !hasDot) {
    const after = text.split(",")[1] ?? "";
    if (after.length === 3 && text.split(",").length > 2) {
      normalised = text.replaceAll(",", "");
    } else if (after.length === 3 && /^[+-]?\d{1,3},\d{3}$/.test(text)) {
      normalised = text.replace(",", "");
    } else {
      normalised = text.replace(",", ".");
    }
  }

  if (!/^[+-]?\d+(\.\d+)?$/.test(normalised)) {
    return null;
  }
  const amount = Number(normalised);
  if (!Number.isFinite(amount)) {
    return null;
  }
  return { amount, canonical: canonicalMoney(amount, currency) };
}

export function formatMoneyInput(canonical: string, currency: string): string {
  const parsed = parseMoney(canonical, currency);
  if (!parsed) {
    return canonical;
  }
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: currencyFractionDigits(currency),
    maximumFractionDigits: currencyFractionDigits(currency),
  }).format(parsed.amount);
}

export function resolveEntryCurrency(
  row: { currency?: string },
  question: { currency?: string },
): string | undefined {
  const code = row.currency ?? question.currency;
  if (!code || !isIsoCurrency(code)) {
    return undefined;
  }
  return code;
}

export function formatKnownAmount(
  row: { amount?: string; currency?: string },
  question: { currency?: string },
): string | undefined {
  const currency = resolveEntryCurrency(row, question);
  if (!row.amount || !currency) {
    return undefined;
  }
  const parsed = parseMoney(row.amount, currency);
  if (!parsed) {
    return undefined;
  }
  return formatMoney(parsed.amount, currency);
}

export function formatEntryValue(
  row: { input?: string; currency?: string },
  question: { currency?: string },
  raw: string,
): string {
  if (!raw) {
    return raw;
  }
  const currency = resolveEntryCurrency(row, question);
  if (row.input === "money" && currency) {
    const parsed = parseMoney(raw, currency);
    if (parsed) {
      return formatMoney(parsed.amount, currency);
    }
  }
  return raw;
}

export function entryRowCaption(
  row: {
    label: string;
    hint?: string;
    input?: string;
    currency?: string;
    amount?: string;
  },
  question: { currency?: string },
): string {
  const bits = [row.label];
  const amount = formatKnownAmount(row, question);
  if (amount) {
    bits.push(amount);
  }
  if (row.input === "money") {
    const currency = resolveEntryCurrency(row, question);
    if (currency) {
      bits.push(`money ${currency}`);
    }
  }
  if (row.hint) {
    bits.push(row.hint);
  }
  return bits.join(" — ");
}
