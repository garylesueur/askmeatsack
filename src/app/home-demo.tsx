"use client";

import { useEffect, useState } from "react";
import { AnsweringForm } from "@/app/s/[sessionId]/answering-form";
import { AppearanceShell } from "@/components/appearance-shell";
import { Button } from "@/components/ui/button";
import { pickDemoQuestionnaire } from "@/lib/demo-questionnaires";
import type { Appearance, CreateSessionInput, Question } from "@/lib/schema";
import type { SessionProgress } from "@/lib/sessions";

type DemoSession = {
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

async function createDemoSession(): Promise<DemoSession> {
  const pack: CreateSessionInput = pickDemoQuestionnaire();
  const response = await fetch("/api/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pack),
  });
  if (!response.ok) {
    throw new Error("Could not start the demo");
  }
  const created = (await response.json()) as {
    sessionId: string;
    answerUrl: string;
    expiresAt: string;
  };
  const token = new URL(created.answerUrl).searchParams.get("t");
  if (!token) {
    throw new Error("Demo link was missing a token");
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

export function HomeDemo() {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const next = await createDemoSession();
      setSession(next);
    } catch {
      setSession(null);
      setError("Could not start the demo. Try again.");
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await createDemoSession();
        if (!cancelled) {
          setSession(next);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          setError("Could not start the demo. Try again.");
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
    return <p className="text-sm text-muted-foreground">Loading a questionnaire…</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3">
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
    );
  }

  if (!session) {
    return null;
  }

  return (
    <AppearanceShell
      appearance={session.appearance}
      className="min-h-0 rounded-xl border border-border/70 p-4 sm:p-5"
      showModeToggle={false}
    >
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
          requiredCount: session.questions.filter((question) => question.required !== false).length,
        }}
        expiresAt={session.expiresAt}
        layout="embed"
        onPlayAgain={() => {
          void start();
        }}
      />
    </AppearanceShell>
  );
}
