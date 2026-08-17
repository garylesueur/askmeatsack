"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AnswersCopyForm({
  sessionId,
  publicToken,
}: {
  sessionId: string;
  publicToken: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (status === "sending") {
          return;
        }
        setStatus("sending");
        setMessage(null);
        void (async () => {
          const response = await fetch(
            `/api/v1/sessions/${sessionId}/download/email?t=${encodeURIComponent(publicToken)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            },
          );
          if (!response.ok) {
            setStatus("error");
            setMessage("Could not send. Download the JSON instead.");
            return;
          }
          setStatus("sent");
          setMessage("Sent. Check that inbox.");
        })();
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">
          Or email a copy (optional)
        </span>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          disabled={status === "sending" || status === "sent"}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </label>
      <Button
        type="submit"
        variant="outline"
        disabled={status === "sending" || status === "sent" || email.trim().length === 0}
      >
        {status === "sending" ? "Sending…" : status === "sent" ? "Sent" : "Send"}
      </Button>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </form>
  );
}
