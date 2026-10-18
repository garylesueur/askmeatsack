/** Portable admission contract shared with the account metadata authority. */
export const OWNED_CANONICAL_MAX_BYTES = 4 * 1024 * 1024;
export const OWNED_CANONICAL_PART_BYTES = 256 * 1024;
export const OWNED_FILE_NAME_MAX_CHARS = 255;
export const OWNED_FILE_TYPE_MAX_CHARS = 255;
export const OWNED_FILE_URL_MAX_CHARS = 2048;
export const OWNED_FILE_KEY_MAX_CHARS = 512;

type CapacityQuestion = {
  id: string;
  options?: { id: string }[];
  items?: { id: string }[];
  fields?: { id: string }[];
  allowMultiple?: boolean;
  allowFiles?: boolean;
};
type CapacitySession = {
  questions: CapacityQuestion[];
  answers: unknown;
  uploads?: unknown;
  storageRevision?: number;
  [field: string]: unknown;
};

export function canonicalSessionJson(session: CapacitySession): string {
  const { storageRevision: _revision, ...canonical } = session;
  return JSON.stringify(canonical);
}

export function canonicalSessionBytes(session: CapacitySession): number {
  return new TextEncoder().encode(canonicalSessionJson(session)).byteLength;
}

function escaped(length: number) {
  return "\u0000".repeat(length);
}
function jsonBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
/**
 * JSON escapes a UTF-16 code unit into at most six bytes. Reserve all permitted
 * normal answer shapes, even the optional comment on a text-only response.
 * Descriptor copies appear in both the upload registry and selected answers.
 * This is a byte ceiling, never an arbitrary question-count limit.
 */
export function ownedCompletionBytes(session: CapacitySession): number {
  const date = "2000-01-01T00:00:00.000Z";
  const actual = canonicalSessionBytes(session);
  let budget = canonicalSessionBytes({
    ...session,
    answers: {},
    uploads: {},
    status: "in_progress",
    openedAt: date,
    submittedAt: date,
    cancelledAt: date,
    callbackSent: false,
  });
  let answerCount = 0;
  let uploadCount = 0;
  for (const [questionIndex, question] of session.questions.entries()) {
    const options = question.options ?? [];
    const selectedOptionIds = question.allowMultiple
      ? options.map((option) => option.id)
      : options.length
        ? [
            options.toSorted(
              (a, b) =>
                new TextEncoder().encode(JSON.stringify(b.id)).byteLength -
                new TextEncoder().encode(JSON.stringify(a.id)).byteLength,
            )[0].id,
          ]
        : [];
    const entries = Object.fromEntries(
      (question.items ?? question.fields ?? []).map((entry) => [entry.id, escaped(203)]),
    );
    const files: unknown[] = [];
    if (question.allowFiles) {
      for (let index = 0; index < 5; index += 1) {
        // ASCII IDs include room for uniqueness without ever using caller IDs as keys.
        const id = `${questionIndex}-${index}`.padEnd(128, "f");
        const file = {
          id,
          questionId: question.id,
          filename: escaped(OWNED_FILE_NAME_MAX_CHARS),
          contentType: escaped(OWNED_FILE_TYPE_MAX_CHARS),
          size: 4194304,
          url: escaped(OWNED_FILE_URL_MAX_CHARS),
          key: escaped(OWNED_FILE_KEY_MAX_CHARS),
          uploadedAt: date,
          retainedUntil: date,
        };
        files.push(file);
        budget += jsonBytes({ [id]: file }) - 2 + (uploadCount++ ? 1 : 0);
      }
    }
    const answer = {
      selectedOptionIds,
      text: escaped(2000),
      entries,
      files,
      answeredAt: date,
    };
    budget += jsonBytes({ [question.id]: answer }) - 2 + (answerCount++ ? 1 : 0);
    // Admission only needs the first overflowing byte ceiling, avoiding an
    // unbounded synthetic answers allocation for a rejected large questionnaire.
    if (budget > OWNED_CANONICAL_MAX_BYTES) return Math.max(actual, budget);
  }
  return Math.max(actual, budget);
}

export function ownedSessionFits(session: CapacitySession): boolean {
  return ownedCompletionBytes(session) <= OWNED_CANONICAL_MAX_BYTES;
}
