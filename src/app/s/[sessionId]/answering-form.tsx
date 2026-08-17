"use client";

import { useEffect, useRef, useState } from "react";
import {
  ENTRY_ANSWER_MAX_CHARS,
  TEXT_ANSWER_MAX_CHARS,
  type Appearance,
  type Question,
} from "@/lib/schema";
import type { PublicSessionView, SessionProgress } from "@/lib/sessions";
import type { SessionAnswer, SessionFile } from "@/lib/session-store";
import { MarkdownBody } from "@/components/markdown-body";
import { MoneyInput } from "@/components/money-input";
import {
  formatEntryValue,
  formatKnownAmount,
  resolveEntryCurrency,
} from "@/lib/money";
import {
  entriesAreComplete,
  isShortPrompt,
  questionEntries,
  questionHasEvidence,
  questionKind,
} from "@/lib/question-presentation";
import { Input } from "@/components/ui/input";
import { AppearanceShell } from "@/components/appearance-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ThankYouScreen,
  ExpiredLinkScreen,
  CancelledScreen,
} from "./status-screens";

type AnsweringFormProps = {
  sessionId: string;
  publicToken: string;
  title?: string;
  context?: string;
  appearance?: Appearance;
  questions: Question[];
  initialAnswers: PublicSessionView["answers"];
  initialProgress: SessionProgress;
  expiresAt: string;
  machineHref?: string;
  layout?: "page" | "embed";
  onPlayAgain?: () => void;
};

function hasUsableAnswer(
  question: Question,
  answer: SessionAnswer | undefined,
): boolean {
  const kind = questionKind(question);
  if (kind === "items" || kind === "fields") {
    return entriesAreComplete(question, answer?.entries);
  }
  if (kind === "text") {
    const text = answer?.text ?? "";
    const files = answer?.files ?? [];
    return text.trim().length > 0 || files.length > 0;
  }
  return (answer?.selectedOptionIds ?? []).length > 0;
}

function missingRequiredIds(
  questions: Question[],
  answers: Record<string, SessionAnswer | undefined>,
): string[] {
  const missing: string[] = [];
  for (const question of questions) {
    if (!question.required) {
      continue;
    }
    if (!hasUsableAnswer(question, answers[question.id])) {
      missing.push(question.id);
    }
  }
  return missing;
}

function firstOpenIndex(
  questions: Question[],
  answers: Record<string, SessionAnswer | undefined>,
): number {
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question) {
      continue;
    }
    if (!hasUsableAnswer(question, answers[question.id])) {
      return index;
    }
  }
  return Math.max(0, questions.length - 1);
}

function nextSelectedIds(
  question: Question,
  current: string[],
  optionId: string,
): string[] {
  if (!question.allowMultiple) {
    return [optionId];
  }
  if (current.includes(optionId)) {
    const remaining: string[] = [];
    for (const id of current) {
      if (id !== optionId) {
        remaining.push(id);
      }
    }
    return remaining;
  }
  return [...current, optionId];
}

function shouldAdvanceOnChoice(question: Question): boolean {
  return (
    questionKind(question) === "choice" &&
    !question.allowMultiple &&
    !question.allowComment &&
    !question.allowFiles
  );
}

function answerSummary(
  question: Question,
  answer: SessionAnswer | undefined,
): string {
  const labels: string[] = [];
  for (const optionId of answer?.selectedOptionIds ?? []) {
    for (const option of question.options) {
      if (option.id === optionId) {
        labels.push(option.label);
        break;
      }
    }
  }
  const parts: string[] = [];
  if (labels.length > 0) {
    parts.push(labels.join(", "));
  }
  if (answer?.text) {
    parts.push(answer.text);
  }
  if (answer?.entries) {
    const labelled: string[] = [];
    for (const row of questionEntries(question)) {
      const value = answer.entries[row.id];
      if (value) {
        labelled.push(`${row.label}: ${formatEntryValue(row, question, value)}`);
      }
    }
    if (labelled.length > 0) {
      parts.push(labelled.join("; "));
    }
  }
  const files = answer?.files ?? [];
  if (files.length > 0) {
    const names: string[] = [];
    for (const file of files) {
      names.push(file.filename);
    }
    parts.push(names.join(", "));
  }
  if (parts.length === 0) {
    return "No answer";
  }
  return parts.join(" — ");
}

function startsOnReview(
  questions: Question[],
  answers: Record<string, SessionAnswer | undefined>,
): boolean {
  if (missingRequiredIds(questions, answers).length > 0) {
    return false;
  }
  for (const question of questions) {
    if (hasUsableAnswer(question, answers[question.id])) {
      return true;
    }
  }
  return false;
}

export function AnsweringForm({
  sessionId,
  publicToken,
  title,
  context,
  appearance,
  questions,
  initialAnswers,
  initialProgress,
  expiresAt,
  machineHref,
  layout = "page",
  onPlayAgain,
}: AnsweringFormProps) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [progress, setProgress] = useState(initialProgress);
  const [stepIndex, setStepIndex] = useState(() =>
    firstOpenIndex(questions, initialAnswers),
  );
  const [reviewing, setReviewing] = useState(() =>
    startsOnReview(questions, initialAnswers),
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expired, setExpired] = useState(
    () => Date.parse(expiresAt) <= Date.now(),
  );
  const [cancelled, setCancelled] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const textTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    void fetch(
      `/api/v1/sessions/${sessionId}/opened?t=${encodeURIComponent(publicToken)}`,
      { method: "POST" },
    );
  }, [sessionId, publicToken]);

  useEffect(() => {
    const remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setExpired(true);
    }, remaining);
    return () => {
      window.clearTimeout(timer);
    };
  }, [expiresAt]);

  useEffect(() => {
    const timers = textTimers.current;
    return () => {
      for (const questionId of Object.keys(timers)) {
        window.clearTimeout(timers[questionId]);
      }
    };
  }, []);

  const question = questions[stepIndex] ?? questions[0];
  const isLast = stepIndex >= questions.length - 1;
  const missing = missingRequiredIds(questions, answers);
  const canLeaveCurrent =
    question !== undefined &&
    (!question.required || hasUsableAnswer(question, answers[question.id]));
  const canSubmit = missing.length === 0;
  const downloadHref = `/api/v1/sessions/${sessionId}/download?t=${encodeURIComponent(publicToken)}`;

  function goToStep(index: number) {
    setReviewing(false);
    setStepIndex(index);
  }

  function goForward() {
    if (isLast) {
      setReviewing(true);
      return;
    }
    setStepIndex((current) => Math.min(current + 1, questions.length - 1));
  }

  async function chooseOption(currentQuestion: Question, optionId: string) {
    const previous = answers[currentQuestion.id];
    const selectedOptionIds = nextSelectedIds(
      currentQuestion,
      previous?.selectedOptionIds ?? [],
      optionId,
    );
    if (selectedOptionIds.length === 0) {
      return;
    }

    const nextAnswer: SessionAnswer = {
      selectedOptionIds,
      answeredAt: new Date().toISOString(),
    };
    if (previous?.text) {
      nextAnswer.text = previous.text;
    }
    if (previous?.files && previous.files.length > 0) {
      nextAnswer.files = previous.files;
    }
    if (previous?.entries) {
      nextAnswer.entries = previous.entries;
    }
    const nextAnswers = { ...answers, [currentQuestion.id]: nextAnswer };
    const previousIndex = stepIndex;
    setAnswers(nextAnswers);
    setSaveState("saving");
    setSubmitError(null);

    const autoAdvance = shouldAdvanceOnChoice(currentQuestion);
    if (autoAdvance && isLast) {
      setReviewing(true);
    } else if (autoAdvance) {
      setStepIndex(previousIndex + 1);
    }

    const response = await fetch(
      `/api/v1/sessions/${sessionId}/answers/${currentQuestion.id}?t=${encodeURIComponent(publicToken)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedOptionIds }),
      },
    );

    if (!response.ok) {
      const body = (await response.json()) as { error?: { code?: string } };
      if (body.error?.code === "expired") {
        setExpired(true);
        return;
      }
      setAnswers((current) => {
        const restored = { ...current };
        if (previous) {
          restored[currentQuestion.id] = previous;
        } else {
          delete restored[currentQuestion.id];
        }
        return restored;
      });
      setStepIndex(previousIndex);
      setSaveState("error");
      return;
    }

    const body = (await response.json()) as { progress: SessionProgress };
    setProgress(body.progress);
    setSaveState("saved");
  }

  async function saveText(
    currentQuestion: Question,
    text: string,
    previous: SessionAnswer | undefined,
  ) {
    const response = await fetch(
      `/api/v1/sessions/${sessionId}/answers/${currentQuestion.id}?t=${encodeURIComponent(publicToken)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
    if (!response.ok) {
      const body = (await response.json()) as { error?: { code?: string } };
      if (body.error?.code === "expired") {
        setExpired(true);
        return;
      }
      setAnswers((current) => {
        const restored = { ...current };
        if (previous) {
          restored[currentQuestion.id] = previous;
        } else {
          delete restored[currentQuestion.id];
        }
        return restored;
      });
      setSaveState("error");
      return;
    }
    const body = (await response.json()) as { progress: SessionProgress };
    setProgress(body.progress);
    setSaveState("saved");
  }

  async function uploadFile(currentQuestion: Question, file: File) {
    setSaveState("saving");
    setSubmitError(null);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(
      `/api/v1/sessions/${sessionId}/files?t=${encodeURIComponent(publicToken)}&questionId=${encodeURIComponent(currentQuestion.id)}`,
      { method: "POST", body: form },
    );
    if (!response.ok) {
      const errorBody = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (errorBody.error?.code === "expired") {
        setExpired(true);
        return;
      }
      setSaveState("error");
      setSubmitError(errorBody.error?.message ?? "File upload was refused.");
      return;
    }
    const body = (await response.json()) as {
      file: SessionFile;
      progress: SessionProgress;
    };
    setAnswers((current) => {
      const previous = current[currentQuestion.id];
      const nextAnswer: SessionAnswer = {
        selectedOptionIds: previous?.selectedOptionIds ?? [],
        answeredAt: new Date().toISOString(),
        files: [...(previous?.files ?? []), body.file],
      };
      if (previous?.text) {
        nextAnswer.text = previous.text;
      }
      if (previous?.entries) {
        nextAnswer.entries = previous.entries;
      }
      return { ...current, [currentQuestion.id]: nextAnswer };
    });
    setProgress(body.progress);
    setSaveState("saved");
  }

  async function saveEntries(
    currentQuestion: Question,
    entries: Record<string, string>,
    previous: SessionAnswer | undefined,
  ) {
    const response = await fetch(
      `/api/v1/sessions/${sessionId}/answers/${currentQuestion.id}?t=${encodeURIComponent(publicToken)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      },
    );
    if (!response.ok) {
      const body = (await response.json()) as { error?: { code?: string } };
      if (body.error?.code === "expired") {
        setExpired(true);
        return;
      }
      setAnswers((current) => {
        const restored = { ...current };
        if (previous) {
          restored[currentQuestion.id] = previous;
        } else {
          delete restored[currentQuestion.id];
        }
        return restored;
      });
      setSaveState("error");
      return;
    }
    const body = (await response.json()) as { progress: SessionProgress };
    setProgress(body.progress);
    setSaveState("saved");
  }

  function onTextChange(currentQuestion: Question, text: string) {
    const previous = answers[currentQuestion.id];
    const nextAnswer: SessionAnswer = {
      selectedOptionIds: previous?.selectedOptionIds ?? [],
      answeredAt: new Date().toISOString(),
    };
    if (text.length > 0) {
      nextAnswer.text = text;
    }
    if (previous?.files && previous.files.length > 0) {
      nextAnswer.files = previous.files;
    }
    if (previous?.entries) {
      nextAnswer.entries = previous.entries;
    }
    setAnswers((current) => ({ ...current, [currentQuestion.id]: nextAnswer }));
    setSaveState("saving");
    setSubmitError(null);
    const existingTimer = textTimers.current[currentQuestion.id];
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }
    textTimers.current[currentQuestion.id] = window.setTimeout(() => {
      void saveText(currentQuestion, text, previous);
    }, 400);
  }

  function onEntryChange(
    currentQuestion: Question,
    entryId: string,
    value: string,
  ) {
    const previous = answers[currentQuestion.id];
    const entries = { ...(previous?.entries ?? {}), [entryId]: value };
    const nextAnswer: SessionAnswer = {
      selectedOptionIds: previous?.selectedOptionIds ?? [],
      answeredAt: new Date().toISOString(),
      entries,
    };
    if (previous?.text) {
      nextAnswer.text = previous.text;
    }
    if (previous?.files && previous.files.length > 0) {
      nextAnswer.files = previous.files;
    }
    setAnswers((current) => ({ ...current, [currentQuestion.id]: nextAnswer }));
    setSaveState("saving");
    setSubmitError(null);
    const existingTimer = textTimers.current[`entry:${currentQuestion.id}`];
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }
    textTimers.current[`entry:${currentQuestion.id}`] = window.setTimeout(() => {
      void saveEntries(currentQuestion, entries, previous);
    }, 400);
  }

  function flushText(currentQuestion: Question) {
    const existingTimer = textTimers.current[currentQuestion.id];
    if (existingTimer === undefined) {
      return;
    }
    window.clearTimeout(existingTimer);
    delete textTimers.current[currentQuestion.id];
    void saveText(
      currentQuestion,
      answers[currentQuestion.id]?.text ?? "",
      answers[currentQuestion.id],
    );
  }

  function flushEntries(currentQuestion: Question) {
    const timerKey = `entry:${currentQuestion.id}`;
    const existingTimer = textTimers.current[timerKey];
    if (existingTimer === undefined) {
      return;
    }
    window.clearTimeout(existingTimer);
    delete textTimers.current[timerKey];
    void saveEntries(
      currentQuestion,
      answers[currentQuestion.id]?.entries ?? {},
      answers[currentQuestion.id],
    );
  }

  async function submitAnswers(
    snapshot: Record<string, SessionAnswer | undefined> = answers,
  ) {
    if (missingRequiredIds(questions, snapshot).length > 0 || submitting) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const response = await fetch(
      `/api/v1/sessions/${sessionId}/submit?t=${encodeURIComponent(publicToken)}`,
      { method: "POST" },
    );
    if (!response.ok) {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body.error?.code === "expired") {
        setExpired(true);
        setSubmitting(false);
        return;
      }
      setSubmitError(body.error?.message ?? "Submit was refused.");
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
  }

  async function cancelQuestionnaire() {
    if (cancelling || expired || submitted) {
      return;
    }
    setCancelling(true);
    setSubmitError(null);
    const response = await fetch(
      `/api/v1/sessions/${sessionId}/cancel?t=${encodeURIComponent(publicToken)}`,
      { method: "POST" },
    );
    if (!response.ok) {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body.error?.code === "expired") {
        setExpired(true);
        setCancelling(false);
        return;
      }
      setSubmitError(body.error?.message ?? "Cancel was refused.");
      setCancelling(false);
      return;
    }
    setCancelled(true);
  }

  if (expired) {
    return <ExpiredLinkScreen appearance={appearance} />;
  }

  if (cancelled) {
    return <CancelledScreen appearance={appearance} />;
  }

  if (submitted && layout === "page") {
    return <ThankYouScreen downloadHref={downloadHref} appearance={appearance} />;
  }

  if (submitted && layout === "embed") {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>What the agent would see</CardTitle>
          <CardDescription>Same payload the wait call returns.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {questions.map((item) => (
              <li key={item.id} className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">{item.prompt}</p>
                <p className="text-sm text-foreground">
                  {answerSummary(item, answers[item.id])}
                </p>
              </li>
            ))}
          </ul>
          {onPlayAgain ? (
            <Button type="button" onClick={onPlayAgain}>
              Another one
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (!question) {
    return null;
  }

  const selected = answers[question.id]?.selectedOptionIds ?? [];
  const showContinue = isLast
    ? !shouldAdvanceOnChoice(question) ||
      hasUsableAnswer(question, answers[question.id])
    : !shouldAdvanceOnChoice(question) || !question.required;
  const continueLabel = isLast
    ? "Review answers"
    : !question.required && !hasUsableAnswer(question, answers[question.id])
      ? "Skip"
      : "Continue";
  const percent = reviewing
    ? 100
    : Math.round(((stepIndex + 1) / questions.length) * 100);

  const hasEvidence = !reviewing && questionHasEvidence(question);
  const form = (
    <main
      className={
        layout === "embed"
          ? "w-full"
          : hasEvidence
            ? "mx-auto w-full max-w-5xl py-6"
            : "mx-auto w-full max-w-xl py-6"
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-sm text-muted-foreground">
          {title ?? (layout === "page" ? "askmeatsack.com" : "Questions")}
        </h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {reviewing ? "Review" : `${stepIndex + 1} of ${questions.length}`}
          {saveState === "saved" ? " · Saved" : null}
          {saveState === "saving" ? " · Saving" : null}
          {saveState === "error" ? " · Could not save" : null}
        </p>
      </div>

      <div
        className="mt-4 h-px w-full overflow-hidden bg-border/70"
        aria-hidden="true"
        title={`${progress.answeredCount} answered`}
      >
        <div
          className="h-full bg-foreground/40 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      {questions.length > 1 ? (
        <nav aria-label="Questions" className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {questions.map((item, index) => {
            const current = !reviewing && index === stepIndex;
            const done = hasUsableAnswer(item, answers[item.id]);
            return (
              <button
                key={item.id}
                type="button"
                aria-current={current ? "step" : undefined}
                aria-label={`Question ${index + 1}`}
                disabled={submitting || cancelling}
                onClick={() => {
                  goToStep(index);
                }}
                className={`text-sm ${
                  current
                    ? "text-foreground underline decoration-foreground/50 underline-offset-4"
                    : done
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </nav>
      ) : null}

      {stepIndex === 0 && !reviewing && context ? (
        <MarkdownBody source={context} className="mt-4" />
      ) : null}

      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (reviewing) {
            void submitAnswers();
            return;
          }
          if (question) {
            flushText(question);
            flushEntries(question);
          }
          goForward();
        }}
      >
        {reviewing ? (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-xl font-medium tracking-tight text-foreground">
                Review answers
              </h2>
              <p className="text-sm text-muted-foreground">
                Jump back to change anything, then submit.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {questions.map((item, index) => (
                <li key={item.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="text-left text-sm text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => {
                      goToStep(index);
                    }}
                  >
                    {index + 1}. {item.prompt}
                  </button>
                  <p className="text-sm text-foreground">
                    {answerSummary(item, answers[item.id])}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div
              className={
                hasEvidence
                  ? "grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,28rem)_minmax(16rem,1fr)] lg:items-start lg:gap-10"
                  : "flex flex-col gap-3"
              }
            >
              <div className="flex flex-wrap items-start gap-2">
                <MarkdownBody
                  source={question.prompt}
                  tone="prompt"
                  compact={isShortPrompt(question.prompt)}
                />
                {question.required ? (
                  <span className="sr-only"> (required)</span>
                ) : (
                  <Badge variant="secondary">Optional</Badge>
                )}
              </div>
              {hasEvidence && question.detail ? (
                <aside className="lg:col-start-2 lg:row-span-2 lg:sticky lg:top-6 lg:border-l lg:border-border/60 lg:pl-8">
                  <p className="mb-2 text-sm text-muted-foreground">Situation</p>
                  <MarkdownBody source={question.detail} />
                </aside>
              ) : null}
              <div className="flex flex-col gap-4 lg:col-start-1">
                {questionKind(question) === "text" ? (
                  <Textarea
                    value={answers[question.id]?.text ?? ""}
                    maxLength={TEXT_ANSWER_MAX_CHARS}
                    onChange={(event) => {
                      onTextChange(question, event.target.value);
                    }}
                    className="min-h-28"
                  />
                ) : questionKind(question) === "items" ||
                  questionKind(question) === "fields" ? (
                  <div className="flex flex-col gap-3">
                    {questionEntries(question).map((row) => {
                      const currency = resolveEntryCurrency(row, question);
                      const shownAmount = formatKnownAmount(row, question);
                      return (
                        <label key={row.id} className="flex flex-col gap-1.5">
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {row.label}
                            </span>
                            {shownAmount ? (
                              <span className="font-mono text-sm tabular-nums text-foreground">
                                {shownAmount}
                              </span>
                            ) : null}
                          </span>
                          {row.hint ? (
                            <span className="text-xs text-muted-foreground">
                              {row.hint}
                            </span>
                          ) : null}
                          {row.input === "money" && currency ? (
                            <MoneyInput
                              currency={currency}
                              disabled={submitting}
                              value={
                                answers[question.id]?.entries?.[row.id] ?? ""
                              }
                              onChange={(canonical) => {
                                onEntryChange(question, row.id, canonical);
                              }}
                            />
                          ) : (
                            <Input
                              disabled={submitting}
                              value={
                                answers[question.id]?.entries?.[row.id] ?? ""
                              }
                              maxLength={ENTRY_ANSWER_MAX_CHARS}
                              onChange={(event) => {
                                onEntryChange(
                                  question,
                                  row.id,
                                  event.target.value,
                                );
                              }}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {question.options.map((option) => {
                      const isSelected = selected.includes(option.id);
                      const isRecommended =
                        question.recommendedOptionId === option.id;
                      return (
                        <Button
                          key={option.id}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          aria-pressed={isSelected}
                          disabled={submitting}
                          onClick={() => {
                            void chooseOption(question, option.id);
                          }}
                          className="h-auto min-h-11 w-full justify-start whitespace-normal px-3 py-2.5 text-left"
                        >
                          <span>{option.label}</span>
                          {isRecommended ? (
                            <Badge
                              variant={isSelected ? "secondary" : "outline"}
                              className="ml-2"
                            >
                              Recommended
                            </Badge>
                          ) : null}
                        </Button>
                      );
                    })}
                  </div>
                )}
                {question.allowComment ? (
                  <Textarea
                    value={answers[question.id]?.text ?? ""}
                    maxLength={TEXT_ANSWER_MAX_CHARS}
                    placeholder="Optional comment"
                    onChange={(event) => {
                      onTextChange(question, event.target.value);
                    }}
                    className="min-h-20"
                  />
                ) : null}
                {question.allowFiles ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      type="file"
                      multiple
                      onChange={(event) => {
                        const list = event.target.files;
                        if (!list) {
                          return;
                        }
                        for (const file of list) {
                          void uploadFile(question, file);
                        }
                        event.target.value = "";
                      }}
                    />
                    {(answers[question.id]?.files ?? []).map((file) => (
                      <p key={file.id} className="text-sm text-muted-foreground">
                        {file.filename}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}

        {submitError ? (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {reviewing || stepIndex > 0 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={submitting || cancelling}
              onClick={() => {
                if (reviewing) {
                  goToStep(questions.length - 1);
                  return;
                }
                setStepIndex((current) => Math.max(0, current - 1));
              }}
            >
              Back
            </Button>
          ) : null}
          {reviewing ? (
            <Button type="submit" disabled={submitting || cancelling || !canSubmit}>
              Submit answers
            </Button>
          ) : showContinue ? (
            <Button
              type="submit"
              disabled={
                submitting ||
                cancelling ||
                (isLast ? !canSubmit : !canLeaveCurrent)
              }
            >
              {continueLabel}
            </Button>
          ) : null}
        </div>
        {layout === "page" ? (
          <Button
            type="button"
            variant="ghost"
            className="self-start px-0 text-muted-foreground"
            disabled={cancelling || submitting}
            onClick={() => {
              void cancelQuestionnaire();
            }}
          >
            Cancel questionnaire
          </Button>
        ) : null}
      </form>
      {layout === "page" && machineHref ? (
        <p className="mt-8 text-xs text-muted-foreground">
          Machine-readable questionnaire:{" "}
          <a href={machineHref} className="underline underline-offset-2">
            {machineHref}
          </a>
        </p>
      ) : null}
    </main>
  );

  if (layout === "embed") {
    return form;
  }

  return (
    <AppearanceShell appearance={appearance} className="px-4">
      {form}
    </AppearanceShell>
  );
}
