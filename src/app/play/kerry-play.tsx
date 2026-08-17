"use client";

import { useEffect, useState } from "react";
import { AnsweringForm } from "@/app/s/[sessionId]/answering-form";
import { AppearanceShell } from "@/components/appearance-shell";
import { Button } from "@/components/ui/button";
import { kerryPlayQuestionnaire } from "@/lib/play-questionnaires";
import type { Appearance, Question } from "@/lib/schema";
import type { SessionProgress } from "@/lib/sessions";

type PlaySession = {
  sessionId: string;
  publicToken: string;
  expiresAt: string;
  questions: Question[];
  title?: string;
  context?: string;
  appearance?: Appearance;
};

const emptyProgress: SessionProgress = {
  totalCount: 0,
  answeredCount: 0,
  requiredCount: 0,
  requiredAnsweredCount: 0,
  questionIdsAnswered: [],
};

async function createPlaySession(): Promise<PlaySession> {
  const pack = kerryPlayQuestionnaire;
  const response = await fetch("/api/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pack),
  });
  if (!response.ok) {
    throw new Error("Could not start the playground");
  }
  const created = (await response.json()) as {
    sessionId: string;
    answerUrl: string;
    expiresAt: string;
  };
  const token = new URL(created.answerUrl).searchParams.get("t");
  if (!token) {
    throw new Error("Playground link was missing a token");
  }
  return {
    sessionId: created.sessionId,
    publicToken: token,
    expiresAt: created.expiresAt,
    questions: pack.questions,
    title: pack.title,
    context: pack.context,
    appearance: pack.appearance,
  };
}

export function KerryPlay() {
  const [session, setSession] = useState<PlaySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const next = await createPlaySession();
      setSession(next);
    } catch {
      setSession(null);
      setError("Could not start the playground. Try again.");
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await createPlaySession();
        if (!cancelled) {
          setSession(next);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          setError("Could not start the playground. Try again.");
        }
      }
      if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <AppearanceShell className="px-4">
        <p className="mx-auto w-full max-w-xl py-10 text-sm text-muted-foreground">
          Starting a playground copy…
        </p>
      </AppearanceShell>
    );
  }

  if (error) {
    return (
      <AppearanceShell className="px-4">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 py-10">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void start();
            }}
          >
            Try again
          </Button>
        </div>
      </AppearanceShell>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <AnsweringForm
      key={session.sessionId}
      sessionId={session.sessionId}
      publicToken={session.publicToken}
      title={session.title}
      context={session.context}
      appearance={session.appearance}
      questions={session.questions}
      initialAnswers={{}}
      initialProgress={{
        ...emptyProgress,
        totalCount: session.questions.length,
        requiredCount: session.questions.filter(
          (question) => question.required !== false,
        ).length,
      }}
      expiresAt={session.expiresAt}
      onPlayAgain={() => {
        void start();
      }}
    />
  );
}
