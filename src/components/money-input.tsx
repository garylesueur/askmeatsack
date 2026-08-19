"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { currencySymbol, formatMoneyInput, parseMoney } from "@/lib/money";

export function MoneyInput({
  currency,
  value,
  onChange,
  disabled,
}: {
  currency: string;
  value: string;
  onChange: (canonical: string) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = parseMoney(value, currency);

  const shown = focused
    ? (draft ?? value)
    : parsed
      ? formatMoneyInput(parsed.canonical, currency)
      : value;

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-8 text-sm tabular-nums text-muted-foreground">
        {currencySymbol(currency)}
      </span>
      <Input
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={shown}
        aria-label={`Amount in ${currency}`}
        className="text-right font-mono tabular-nums"
        onFocus={() => {
          setFocused(true);
          setDraft(value);
        }}
        onBlur={() => {
          const current = draft ?? value;
          setFocused(false);
          setDraft(null);
          const money = parseMoney(current, currency);
          if (!money) {
            if (current.trim().length === 0) {
              onChange("");
            }
            return;
          }
          onChange(money.canonical);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const money = parseMoney(next, currency);
          if (money) {
            onChange(money.canonical);
          } else if (next.trim().length === 0) {
            onChange("");
          }
        }}
      />
      <span className="text-xs text-muted-foreground">{currency}</span>
    </div>
  );
}
