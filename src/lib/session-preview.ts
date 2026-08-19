import type { Session } from "./session-store";

/**
 * Structural on purpose. Both Session and PublicSessionView satisfy it, and
 * neither can pass its answers through it — there is nowhere for them to go.
 * Keeping it structural also avoids importing back from sessions.ts.
 */
export type PreviewSource = {
  status: Session["status"];
  expiresAt: string;
  title?: string;
  context?: string;
  questions: readonly unknown[];
};

/**
 * Everything a link preview is allowed to know. The card is built from this and
 * nothing else, so an answer cannot reach it by being read from the wrong field
 * later — there is no field to read it into.
 */
export type SessionPreview = {
  title: string;
  context: string | null;
  questionCount: number;
  minutes: number;
  state: "open" | "submitted" | "cancelled" | "expired";
  expiresAt: string;
};

const DEFAULT_TITLE = "A few questions for you";
const CONTEXT_LIMIT = 150;
const TITLE_LIMIT = 90;
const SECONDS_PER_QUESTION = 30;

export function sessionPreview(source: PreviewSource, now: Date): SessionPreview {
  return {
    title: clamp(source.title?.trim() || DEFAULT_TITLE, TITLE_LIMIT),
    context: source.context?.trim() ? clamp(source.context.trim(), CONTEXT_LIMIT) : null,
    questionCount: source.questions.length,
    minutes: minutesFor(source.questions.length),
    state: stateOf(source, now),
    expiresAt: source.expiresAt,
  };
}

export function previewFromPublicView(view: PreviewSource, now: Date = new Date()): SessionPreview {
  return sessionPreview(view, now);
}

/**
 * A rough honest number, not a measurement: half a minute per question, never
 * less than a minute. It is there to tell someone whether this is a two-minute
 * favour or a long form.
 */
export function minutesFor(questionCount: number): number {
  return Math.max(1, Math.round((questionCount * SECONDS_PER_QUESTION) / 60));
}

export function previewSummary(preview: SessionPreview): string {
  if (preview.state === "submitted") {
    return "Already answered";
  }
  if (preview.state === "cancelled") {
    return "No longer needed";
  }
  if (preview.state === "expired") {
    return "This link has expired";
  }
  const questions = `${preview.questionCount} ${preview.questionCount === 1 ? "question" : "questions"}`;
  return `${questions} · about ${preview.minutes} ${preview.minutes === 1 ? "minute" : "minutes"}`;
}

export function expiryPhrase(preview: SessionPreview, now: Date): string | null {
  if (preview.state !== "open") {
    return null;
  }
  const msLeft = Date.parse(preview.expiresAt) - now.getTime();
  if (!Number.isFinite(msLeft) || msLeft <= 0) {
    return null;
  }
  const hours = Math.floor(msLeft / 3_600_000);
  if (hours < 1) {
    return "Expires within the hour";
  }
  if (hours < 24) {
    return `Expires in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const days = Math.round(hours / 24);
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}

function stateOf(source: PreviewSource, now: Date): SessionPreview["state"] {
  if (source.status === "submitted") {
    return "submitted";
  }
  if (source.status === "cancelled") {
    return "cancelled";
  }
  if (source.status === "expired") {
    return "expired";
  }
  if (Date.parse(source.expiresAt) <= now.getTime()) {
    return "expired";
  }
  return "open";
}

function clamp(value: string, limit: number): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= limit) {
    return collapsed;
  }
  const cut = collapsed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
