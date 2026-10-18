import { ownValue } from "./dictionary";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { ZodError } from "zod";
import { defaultOwnedAnswerFiles } from "./owned-answer-files";
import {
  SESSION_DEFAULT_TTL_SECONDS,
  SESSION_READ_WINDOW_SECONDS,
  WAIT_MAX_SECONDS,
  createSessionSchema,
  editSessionSchema,
  saveAnswerSchema,
  bulkAnswersSchema,
  waitSchema,
  FILE_MAX_COUNT,
  invalidQuestionsMessage,
  questionIssuesFromZod,
  type CreateSessionInput,
  type QuestionIssue,
} from "./schema";
import { answersDownloadMarkdown } from "./answers-download";
import { previewTokenMatches } from "./preview-token";
import { sessionPreview, type SessionPreview } from "./session-preview";
import { callbackHostResolvesPublicly } from "./callback-dns";
import { callbackUrlIsUsable } from "./callback-url";
import { manageMarkdown } from "./manage-markdown";
import { questionnaireMarkdown } from "./questionnaire-markdown";
import { parseMoney, resolveEntryCurrency } from "./money";
import { entriesAreComplete, questionEntries, questionKind } from "./question-presentation";
import { ownedSessionFits } from "./owned-session-capacity";
import {
  OwnedSessionError,
  defaultAskMetadata,
  askUsage,
  type AskMetadata,
  type AskAllowance,
  type AskFileAccess,
} from "./owned-session-metadata";
import type { Session, SessionAnswer, SessionFile, SessionStore } from "./session-store";

export type SessionServiceError = {
  code: string;
  message: string;
  status: number;
  issues?: QuestionIssue[];
};

export type SessionServiceDeps = {
  store: SessionStore;
  now: () => Date;
  createId: () => string;
  createToken: () => string;
  publicBaseUrl: string;
  sleep: (ms: number) => Promise<void>;
  postCallback: (url: string, body: unknown) => Promise<void>;
  waitPollMs?: number;
  metadata?: AskMetadata | null;
};

export type CreateSessionResult = {
  sessionId: string;
  answerUrl: string;
  machineUrl: string;
  pollUrl: string;
  manageUrl: string;
  expiresAt: string;
  status: "pending";
};

export type SessionProgress = {
  totalCount: number;
  answeredCount: number;
  requiredCount: number;
  requiredAnsweredCount: number;
  questionIdsAnswered: string[];
};

export type SaveAnswerResult = {
  questionId: string;
  progress: SessionProgress;
};

export type BulkSaveResult = {
  progress: SessionProgress;
  submitted?: SubmitResult;
};

export type AttachFileResult = {
  file: SessionFile;
  progress: SessionProgress;
};

export type SubmitResult = {
  status: "submitted";
  submittedAt: string;
  answers: Session["answers"];
};

export type CancelResult = {
  status: "cancelled";
  answers: Session["answers"];
};

export type OpenedResult = {
  openedAt: string;
  status: Session["status"];
};

export type AgentSessionView = {
  sessionId: string;
  status: Session["status"];
  expiresAt: string;
  submittedAt: string | null;
  openedAt: string | null;
  title?: string;
  context?: string;
  metadata?: Record<string, string>;
  progress: SessionProgress;
  answers: Session["answers"];
  questions: Session["questions"];
  answerUrl: string;
  manageUrl: string;
};

export type AccountSessionSummary = {
  id: string;
  title?: string;
  createdAt: string;
  expiresAt: string;
  status: Session["status"];
  submittedAt: string | null;
  openedAt: string | null;
  progress: SessionProgress;
};

function accountSummary(session: Session): AccountSessionSummary {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    status: session.status,
    submittedAt: session.submittedAt ?? null,
    openedAt: session.openedAt ?? null,
    progress: progressFor(session),
  };
}

function accountAnswers(session: Session) {
  return Object.fromEntries(
    Object.entries(session.answers).map(([answerQuestionId, answer]) => [
      answerQuestionId,
      {
        ...answer,
        files: answer.files?.map(({ id, questionId, filename, contentType, size }) => ({
          id,
          questionId,
          filename,
          contentType,
          size,
        })),
      },
    ]),
  );
}

export type PublicSessionView = {
  sessionId: string;
  status: Session["status"];
  expiresAt: string;
  title?: string;
  context?: string;
  appearance?: Session["appearance"];
  questions: Session["questions"];
  answers: Session["answers"];
  progress: SessionProgress;
};

export type DownloadAnswers = {
  sessionId: string;
  title?: string;
  status: "submitted";
  answers: Array<{
    questionId: string;
    prompt: string;
    selectedOptionIds: string[];
    selectedLabels: string[];
    text?: string;
    entries?: Record<string, string>;
    files?: SessionFile[];
  }>;
};

export type HumanScreen =
  | "answering"
  | "submitted_view"
  | "expired_view"
  | "cancelled_view"
  | "unknown_link";

function isServiceError(value: unknown): value is SessionServiceError {
  return typeof value === "object" && value !== null && "code" in value && "status" in value;
}

export function createToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokensMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function progressFor(session: Session): SessionProgress {
  const questionIdsAnswered: string[] = [];
  let requiredCount = 0;
  let requiredAnsweredCount = 0;
  for (const question of session.questions) {
    const answered = questionIsAnswered(question, ownValue(session.answers, question.id));
    if (answered) {
      questionIdsAnswered.push(question.id);
    }
    if (!question.required) {
      continue;
    }
    requiredCount += 1;
    if (answered) {
      requiredAnsweredCount += 1;
    }
  }
  return {
    totalCount: session.questions.length,
    answeredCount: questionIdsAnswered.length,
    requiredCount,
    requiredAnsweredCount,
    questionIdsAnswered,
  };
}

function isTerminalStatus(status: Session["status"]): boolean {
  return status === "submitted" || status === "expired" || status === "cancelled";
}

const WAIT_POLL_MS = 50;

function isTextQuestion(question: Session["questions"][number]): boolean {
  return questionKind(question) === "text";
}

function isEntryQuestion(question: Session["questions"][number]): boolean {
  const kind = questionKind(question);
  return kind === "items" || kind === "fields";
}

function questionIsAnswered(
  question: Session["questions"][number],
  answer: Session["answers"][string] | undefined,
): boolean {
  if (!answer) {
    return false;
  }
  if (isEntryQuestion(question)) {
    return entriesAreComplete(question, answer.entries);
  }
  if (isTextQuestion(question)) {
    const hasText = Boolean(answer.text && answer.text.trim().length > 0);
    const hasFiles = Boolean(question.allowFiles && (answer.files?.length ?? 0) > 0);
    return hasText || hasFiles;
  }
  return answer.selectedOptionIds.length > 0;
}

function outwardAnswers(session: Session): Session["answers"] {
  if (session.storageRevision === undefined) return session.answers;
  return Object.fromEntries(
    Object.entries(session.answers).map(([id, answer]) => [
      id,
      {
        ...answer,
        files: answer.files?.map(({ key: _key, ...file }) => file),
      },
    ]),
  );
}

function agentView(
  session: Session,
  urls: { answerUrl: string; manageUrl: string },
): AgentSessionView {
  return {
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expiresAt,
    submittedAt: session.submittedAt ?? null,
    openedAt: session.openedAt ?? null,
    title: session.title,
    context: session.context,
    metadata: session.metadata,
    progress: progressFor(session),
    answers: outwardAnswers(session),
    questions: session.questions,
    answerUrl: urls.answerUrl,
    manageUrl: urls.manageUrl,
  };
}

function publicView(session: Session): PublicSessionView {
  return {
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expiresAt,
    title: session.title,
    context: session.context,
    appearance: session.appearance,
    questions: session.questions,
    answers: outwardAnswers(session),
    progress: progressFor(session),
  };
}

export function humanScreenFor(view: PublicSessionView | SessionServiceError): HumanScreen {
  if (isServiceError(view)) {
    return "unknown_link";
  }
  if (view.status === "submitted") {
    return "submitted_view";
  }
  if (view.status === "expired") {
    return "expired_view";
  }
  if (view.status === "cancelled") {
    return "cancelled_view";
  }
  return "answering";
}

function unknownSessionError(): SessionServiceError {
  return {
    code: "not_found",
    message: "Questionnaire not found",
    status: 404,
  };
}

function frozenError(): SessionServiceError {
  return {
    code: "frozen",
    message: "Answers cannot be changed",
    status: 409,
  };
}

function notEditableError(): SessionServiceError {
  return {
    code: "not_editable",
    message: "Questions can only be changed before anyone answers",
    status: 409,
  };
}

function expiredError(): SessionServiceError {
  return {
    code: "expired",
    message: "This link has expired",
    status: 409,
  };
}

function downloadAnswersFrom(session: Session): DownloadAnswers {
  const answers: DownloadAnswers["answers"] = [];
  for (const question of session.questions) {
    const answer = ownValue(session.answers, question.id);
    const selectedOptionIds = answer?.selectedOptionIds ?? [];
    const selectedLabels: string[] = [];
    for (const optionId of selectedOptionIds) {
      for (const option of question.options) {
        if (option.id === optionId) {
          selectedLabels.push(option.label);
          break;
        }
      }
    }
    const row: DownloadAnswers["answers"][number] = {
      questionId: question.id,
      prompt: question.prompt,
      selectedOptionIds,
      selectedLabels,
    };
    if (answer?.text) {
      row.text = answer.text;
    }
    if (answer?.entries && Object.keys(answer.entries).length > 0) {
      row.entries = answer.entries;
    }
    if (answer?.files && answer.files.length > 0) {
      row.files =
        session.storageRevision === undefined
          ? answer.files
          : answer.files.map(({ key: _key, ...file }) => file);
    }
    answers.push(row);
  }
  return {
    sessionId: session.id,
    title: session.title,
    status: "submitted",
    answers,
  };
}

function sessionIsFrozen(session: Session): boolean {
  return (
    session.status === "submitted" || session.status === "expired" || session.status === "cancelled"
  );
}

// Shared by canAcceptFile and attachFile so the pre-upload check and the
// post-upload check can never drift apart. Returns the refusal, or null.
function fileGuard(session: Session, questionId: string): SessionServiceError | null {
  if (session.status === "expired") {
    return expiredError();
  }
  if (sessionIsFrozen(session)) {
    return frozenError();
  }
  const question = session.questions.find((candidate) => candidate.id === questionId);
  if (!question || !question.allowFiles) {
    return {
      code: "invalid_answer",
      message: "This question does not allow files",
      status: 400,
    };
  }
  const existing = ownValue(session.answers, questionId)?.files ?? [];
  if (existing.length >= FILE_MAX_COUNT) {
    return {
      code: "invalid_answer",
      message: "Too many files on this question",
      status: 400,
    };
  }
  return null;
}

function readWindowEndsAtMs(session: Session, status: Session["status"]): number | null {
  if (status === "submitted" && session.submittedAt) {
    return Date.parse(session.submittedAt) + SESSION_READ_WINDOW_SECONDS * 1000;
  }
  if (status === "expired") {
    return Date.parse(session.expiresAt) + SESSION_READ_WINDOW_SECONDS * 1000;
  }
  if (status === "cancelled" && session.cancelledAt) {
    return Date.parse(session.cancelledAt) + SESSION_READ_WINDOW_SECONDS * 1000;
  }
  return null;
}

function optionIdsOnQuestion(question: Session["questions"][number]): Set<string> {
  const ids = new Set<string>();
  for (const option of question.options) {
    ids.add(option.id);
  }
  return ids;
}

export function createSessionService(deps: SessionServiceDeps) {
  const baseUrl = deps.publicBaseUrl.replace(/\/$/, "");

  function urlsFor(session: Session): {
    answerUrl: string;
    machineUrl: string;
    pollUrl: string;
    manageUrl: string;
    answersUrl: string;
    submitUrl: string;
    filesUrl: string;
  } {
    const token = session.publicToken;
    return {
      answerUrl: `${baseUrl}/s/${session.id}?t=${token}`,
      machineUrl: `${baseUrl}/s/${session.id}.md?t=${token}`,
      pollUrl: `${baseUrl}/api/v1/sessions/${session.id}?token=${session.agentToken}`,
      manageUrl: `${baseUrl}/s/${session.id}/manage?token=${session.agentToken}`,
      answersUrl: `${baseUrl}/api/v1/sessions/${session.id}/answers?t=${token}`,
      submitUrl: `${baseUrl}/api/v1/sessions/${session.id}/submit?t=${token}`,
      filesUrl: `${baseUrl}/api/v1/sessions/${session.id}/files?t=${token}`,
    };
  }

  function fileUrlFor(session: Session, fileId: string): string {
    return `${baseUrl}/api/v1/sessions/${session.id}/files/${encodeURIComponent(fileId)}?t=${encodeURIComponent(session.publicToken)}`;
  }

  async function hydrate(
    session: Session,
    retainOwned = false,
  ): Promise<Session | SessionServiceError> {
    const nowMs = deps.now().getTime();
    let status = session.status;
    if (status === "pending" || status === "in_progress") {
      if (nowMs >= Date.parse(session.expiresAt)) {
        status = "expired";
      }
    }

    const readUntil = readWindowEndsAtMs(session, status);
    if (
      readUntil !== null &&
      nowMs >= readUntil &&
      !(retainOwned && session.storageRevision !== undefined)
    ) {
      if (session.storageRevision === undefined) await deps.store.delete(session.id);
      return unknownSessionError();
    }

    if (status !== session.status) {
      const next = { ...session, status };
      await deps.store.save(next);
      if (isTerminalStatus(status)) {
        await notifyTerminal(next);
      }
      return next;
    }
    if (isTerminalStatus(session.status)) await notifyTerminal(session);
    return session;
  }

  async function loadById(sessionId: string): Promise<Session | SessionServiceError> {
    const session = await deps.store.getById(sessionId);
    if (!session) {
      return unknownSessionError();
    }
    return hydrate(session);
  }

  async function loadForOwner(
    account: string,
    sessionId: string,
  ): Promise<Session | SessionServiceError> {
    // Check ownership before hydration so another account cannot cause lifecycle writes.
    const session = await deps.store.getById(sessionId);
    if (!session || session.ownerAccountId !== account) return unknownSessionError();
    return hydrate(session, true);
  }

  async function loadForPublic(
    sessionId: string,
    publicToken: string | undefined,
  ): Promise<Session | SessionServiceError> {
    const stored = await deps.store.getById(sessionId);
    if (!stored || !publicToken || !tokensMatch(publicToken, stored.publicToken))
      return unknownSessionError();
    if (
      stored.storageRevision !== undefined &&
      stored.status === "submitted" &&
      deps.now().getTime() >= Date.parse(stored.expiresAt)
    )
      return unknownSessionError();
    const session = await hydrate(stored, stored.status === "submitted");
    if (isServiceError(session)) return session;
    if (!publicToken || !tokensMatch(publicToken, session.publicToken)) {
      return unknownSessionError();
    }
    return session;
  }

  async function loadSubmittedForPublic(input: {
    sessionId: string;
    publicToken?: string;
  }): Promise<Session | SessionServiceError> {
    const session = await loadForPublic(input.sessionId, input.publicToken);
    if (isServiceError(session)) {
      return session;
    }
    if (session.status !== "submitted") {
      return {
        code: "not_available",
        message: "Download is only available after submit",
        status: 409,
      };
    }
    return session;
  }

  async function loadForAgent(input: {
    sessionId: string;
    agentToken?: string;
    hasCreateCredential: boolean;
  }): Promise<Session | SessionServiceError> {
    const session = await loadById(input.sessionId);
    if (isServiceError(session)) {
      return session;
    }
    if (input.hasCreateCredential) {
      return session;
    }
    if (!input.agentToken || !tokensMatch(input.agentToken, session.agentToken)) {
      return unknownSessionError();
    }
    return session;
  }

  function invalidQuestionsError(error: ZodError, body: unknown): SessionServiceError {
    const issues = questionIssuesFromZod(error, body);
    return {
      code: "invalid_questions",
      message: invalidQuestionsMessage(issues),
      status: 400,
      ...(issues.length > 0 ? { issues } : {}),
    };
  }

  async function notifyTerminal(session: Session): Promise<void> {
    if (!session.callbackUrl || session.callbackSent) {
      return;
    }
    const claimed = { ...session, callbackSent: true };
    await deps.store.save(claimed);
    session.callbackSent = true;
    session.storageRevision = claimed.storageRevision;
    try {
      await deps.postCallback(session.callbackUrl, {
        sessionId: session.id,
        status: session.status,
        answers: outwardAnswers(session),
      });
    } catch {
      return;
    }
  }

  function metadata(): AskMetadata {
    if (!deps.metadata) throw new OwnedSessionError("storage_unavailable");
    return deps.metadata;
  }
  function safeFile(file: SessionFile, access: AskFileAccess | null) {
    const permission = access?.files[file.id];
    const live =
      access?.fileIds.includes(file.id) &&
      permission?.state === "sealed" &&
      permission.scanStatus === "clean" &&
      (!permission.retainedUntil || deps.now().getTime() < Date.parse(permission.retainedUntil));
    return {
      id: file.id,
      questionId: file.questionId,
      name: file.filename,
      size: file.size,
      type: file.contentType,
      scanStatus: permission?.scanStatus ?? "unknown",
      canRead: Boolean(live),
      canRetryScan: Boolean(
        access?.fileIds.includes(file.id) &&
        permission?.state === "sealed" &&
        ["failed", "scanning", "pending"].includes(permission.scanStatus) &&
        (!permission.retainedUntil || deps.now().getTime() < Date.parse(permission.retainedUntil)),
      ),
      canKeep: Boolean(live) && !access?.keptFiles[file.id],
      uploadedAt: permission?.uploadedAt ?? file.uploadedAt ?? null,
      retainedUntil: permission?.retainedUntil ?? file.retainedUntil ?? null,
      ...(access?.keptFiles[file.id] ? { keptFileId: access.keptFiles[file.id] } : {}),
    };
  }
  async function requireReadableFile(
    session: Session,
    fileId: string,
  ): Promise<SessionFile | SessionServiceError> {
    const file = ownValue(session.uploads, fileId);
    if (!file) return { code: "not_found", message: "File was not found", status: 404 };
    if (session.storageRevision !== undefined) {
      const access = await metadata().call<AskFileAccess>("fileAccess", { id: session.id });
      if (!safeFile(file, access).canRead)
        return {
          code: "file_unavailable",
          message: "This file is unavailable or has not passed its scan",
          status: 409,
        };
    }
    return file;
  }

  const service = {
    async create(
      body: unknown,
      authority?: { account: string; idempotencyKey?: string },
    ): Promise<CreateSessionResult | SessionServiceError> {
      const parsed = createSessionSchema.safeParse(body);
      if (!parsed.success) {
        const appearanceIssue = parsed.error.issues.some((issue) => issue.path[0] === "appearance");
        if (appearanceIssue) {
          return {
            code: "invalid_appearance",
            message: "Appearance is not usable",
            status: 400,
          };
        }
        return invalidQuestionsError(parsed.error, body);
      }

      const input: CreateSessionInput = parsed.data;
      const createdAt = deps.now();
      const ttlSeconds = input.expiresInSeconds ?? SESSION_DEFAULT_TTL_SECONDS;
      const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);
      const idempotencyKey = authority?.idempotencyKey;
      if (idempotencyKey !== undefined && (!idempotencyKey.length || idempotencyKey.length > 200))
        return {
          code: "invalid_idempotency_key",
          message: "Idempotency-Key must contain 1 to 200 characters",
          status: 400,
        };
      const digest =
        authority && idempotencyKey
          ? createHash("sha256")
              .update(JSON.stringify([authority.account, idempotencyKey]))
              .digest("hex")
          : null;
      let session: Session = {
        id: digest
          ? `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`
          : deps.createId(),
        ...(authority ? { ownerAccountId: authority.account } : {}),
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: "pending",
        title: input.title,
        context: input.context,
        appearance: input.appearance,
        questions: input.questions,
        answers: {},
        publicToken: deps.createToken(),
        agentToken: deps.createToken(),
        metadata: input.metadata,
        callbackUrl: input.callbackUrl,
      };
      if (authority && !ownedSessionFits(session))
        return {
          code: "canonical_too_large",
          message:
            "This questionnaire and its permitted answers exceed 4 MiB. Reduce its content before creating it.",
          status: 413,
        };
      if (deps.store.create)
        session = await deps.store.create(
          session,
          createHash("sha256").update(JSON.stringify(input)).digest("hex"),
        );
      else await deps.store.save(session);
      const urls = urlsFor(session);
      const created: CreateSessionResult = {
        sessionId: session.id,
        answerUrl: urls.answerUrl,
        machineUrl: urls.machineUrl,
        pollUrl: urls.pollUrl,
        manageUrl: urls.manageUrl,
        expiresAt: session.expiresAt,
        status: "pending",
      };
      return created;
    },

    async listForOwner(input: {
      account: string;
      cursor?: string;
      limit?: number;
      search?: string;
      status?: string;
    }) {
      if (deps.store.listOwnedSummaries && !input.cursor?.startsWith("legacy:")) {
        const { account: _account, ...options } = input;
        const page = await deps.store.listOwnedSummaries(input.account, options);
        const old =
          page.nextCursor === null
            ? await deps.store.listByOwner(input.account, { limit: 1 })
            : null;
        return {
          ...page,
          nextCursor:
            page.nextCursor ?? (old?.sessions.length || old?.nextCursor ? "legacy:0" : null),
          usage: askUsage(
            await metadata().call<AskAllowance>("allowance", { accountId: input.account }),
          ),
        };
      }
      if (input.cursor?.startsWith("legacy:")) input = { ...input, cursor: input.cursor.slice(7) };
      const page = await deps.store.listByOwner(input.account, input);
      const hydrated = await Promise.all(
        page.sessions.map((row) => loadForOwner(input.account, row.id)),
      );
      const records: AccountSessionSummary[] = [];
      let purged = 0;
      for (const session of hydrated) {
        if (!isServiceError(session)) records.push(accountSummary(session));
        else purged += 1;
      }
      return {
        records: records.filter(
          (row) =>
            (!input.search || row.title?.toLowerCase().includes(input.search.toLowerCase())) &&
            (!input.status ||
              row.status === input.status ||
              (input.status === "opened" && row.openedAt !== null)),
        ),
        usage: askUsage(
          deps.metadata
            ? await deps.metadata.call<AskAllowance>("allowance", { accountId: input.account })
            : { requests: 0, requestLimit: 500, bytes: 0, byteLimit: 1000000000 },
        ),
        nextCursor:
          page.nextCursor === null
            ? null
            : `${deps.store.listOwnedSummaries ? "legacy:" : ""}${Math.max(0, Number(page.nextCursor) - purged)}`,
      };
    },

    async getForOwner(input: { account: string; sessionId: string }) {
      const session = await loadForOwner(input.account, input.sessionId);
      if (isServiceError(session)) return session;
      const access =
        session.storageRevision !== undefined
          ? await metadata().call<AskFileAccess>("fileAccess", { id: session.id })
          : null;
      return {
        ...accountSummary(session),
        context: session.context,
        questions: session.questions,
        answers: accountAnswers(session),
        canCancel: session.status === "pending" || session.status === "in_progress",
        files: Object.values(session.uploads ?? {}).map((file) => safeFile(file, access)),
        actions: {
          edit: session.status === "pending",
          cancel: session.status === "pending" || session.status === "in_progress",
          delete: session.storageRevision !== undefined,
          export: session.status === "submitted",
          share:
            (session.status === "pending" ||
              session.status === "in_progress" ||
              session.status === "submitted") &&
            deps.now().getTime() < Date.parse(session.expiresAt),
        },
        answerUrl:
          session.storageRevision !== undefined &&
          ["pending", "in_progress", "submitted"].includes(session.status) &&
          deps.now().getTime() < Date.parse(session.expiresAt)
            ? urlsFor(session).answerUrl
            : undefined,
      };
    },

    async recordSharingForOwner(input: {
      account: string;
      sessionId: string;
      attemptId: string;
      answerUrl: string;
      kind: "copied" | "shared";
    }) {
      let publicToken: string | null = null;
      try {
        const url = new URL(input.answerUrl);
        publicToken = url.searchParams.get("t");
        if (
          !publicToken ||
          publicToken.length > 256 ||
          input.answerUrl !== `${baseUrl}/s/${input.sessionId}?t=${publicToken}`
        )
          publicToken = null;
      } catch {
        /* Only the canonical public answer URL is accepted. */
      }
      if (!publicToken)
        return {
          status: 409,
          code: "conflict",
          message: "This answer link changed or closed. Refresh before sharing again.",
        };
      // Native authority validates a first observation against the live owned request.
      // A consumed server receipt can acknowledge a retry after the source has closed.
      const result = await metadata().call<{ recorded: true } | null>("recordShare", {
        id: input.sessionId,
        accountId: input.account,
        publicToken,
        attemptId: input.attemptId,
        kind: input.kind,
      });
      return result ?? { status: 404, code: "not_found", message: "Request was not found" };
    },

    async cancelForOwner(input: { account: string; sessionId: string }) {
      const session = await loadForOwner(input.account, input.sessionId);
      if (isServiceError(session)) return session;
      const result = await service.cancel({
        sessionId: session.id,
        agentToken: session.agentToken,
        hasCreateCredential: false,
      });
      return isServiceError(result) ? result : service.getForOwner(input);
    },

    async updateForOwner(input: { account: string; sessionId: string; body: unknown }) {
      const session = await loadForOwner(input.account, input.sessionId);
      if (isServiceError(session)) return session;
      const result = await service.update({
        sessionId: session.id,
        agentToken: session.agentToken,
        hasCreateCredential: false,
        body: input.body,
      });
      return isServiceError(result) ? result : service.getForOwner(input);
    },
    async removeForOwner(input: { account: string; sessionId: string }) {
      const session = await loadForOwner(input.account, input.sessionId);
      if (isServiceError(session)) return session;
      if (session.storageRevision === undefined)
        return {
          code: "legacy_request",
          message: "This earlier request is still managed by its existing link",
          status: 409,
        };
      const result = await metadata().call<{ removed: true; cleanupPending: boolean } | null>(
        "delete",
        { id: session.id, accountId: input.account },
      );
      return result
        ? { removed: true, pendingCleanup: result.cleanupPending }
        : unknownSessionError();
    },
    async readFileForOwner(input: { account: string; sessionId: string; fileId: string }) {
      const session = await loadForOwner(input.account, input.sessionId);
      return isServiceError(session) ? session : requireReadableFile(session, input.fileId);
    },
    async retryFileScanForOwner(input: { account: string; sessionId: string; fileId: string }) {
      const session = await loadForOwner(input.account, input.sessionId);
      if (isServiceError(session)) return session;
      if (session.storageRevision === undefined)
        return {
          code: "legacy_request",
          message: "This earlier attachment uses its existing link",
          status: 409,
        };
      const file = ownValue(session.uploads, input.fileId);
      const access = await metadata().call<AskFileAccess>("fileAccess", { id: session.id });
      if (!file || !access.fileIds.includes(file.id))
        return { code: "file_unavailable", message: "File is no longer available", status: 409 };
      const files = defaultOwnedAnswerFiles();
      if (!files) throw new OwnedSessionError("storage_unavailable");
      const accepted = await files.scan(file.id, file.size);
      return accepted
        ? { accepted: true }
        : {
            code: "scan_pending",
            message: "A scan is already in progress. Try again shortly.",
            status: 409,
          };
    },

    async downloadForOwner(input: {
      account: string;
      sessionId: string;
      format: "json" | "markdown";
    }) {
      const session = await loadForOwner(input.account, input.sessionId);
      if (isServiceError(session)) return session;
      if (session.status !== "submitted")
        return {
          code: "not_available",
          message: "Export is available after submission",
          status: 409,
        };
      const download = downloadAnswersFrom(session);
      download.answers = download.answers.map((answer) => ({
        ...answer,
        files: answer.files?.map(({ key: _key, url: _url, ...file }) => ({
          ...file,
          url: `${(process.env.LANYARD_URL ?? "https://meatsack.puregaz.com").replace(/\/$/, "")}/api/portal/askmeatsack/records/${session.id}/files/${encodeURIComponent(file.id)}`,
        })),
      }));
      return input.format === "markdown"
        ? answersDownloadMarkdown(download, session.questions)
        : download;
    },

    async getForAgent(input: {
      sessionId: string;
      agentToken?: string;
      hasCreateCredential: boolean;
    }): Promise<AgentSessionView | SessionServiceError> {
      const session = await loadForAgent(input);
      if (isServiceError(session)) {
        return session;
      }
      return agentView(session, urlsFor(session));
    },

    async markdownForManage(input: {
      sessionId: string;
      agentToken?: string;
      hasCreateCredential: boolean;
    }): Promise<string | SessionServiceError> {
      const session = await loadForAgent(input);
      if (isServiceError(session)) {
        return session;
      }
      const urls = urlsFor(session);
      return manageMarkdown({
        title: session.title,
        context: session.context,
        status: session.status,
        expiresAt: session.expiresAt,
        openedAt: session.openedAt ?? null,
        questions: session.questions,
        answers: outwardAnswers(session),
        progress: progressFor(session),
        answerUrl: urls.answerUrl,
        machineUrl: urls.machineUrl,
        manageUrl: urls.manageUrl,
        canEdit: session.status === "pending",
      });
    },

    async update(input: {
      sessionId: string;
      agentToken?: string;
      hasCreateCredential: boolean;
      body: unknown;
    }): Promise<AgentSessionView | SessionServiceError> {
      const session = await loadForAgent(input);
      if (isServiceError(session)) {
        return session;
      }
      if (session.status !== "pending") {
        return notEditableError();
      }
      const parsed = editSessionSchema.safeParse(input.body);
      if (!parsed.success) {
        const appearanceIssue = parsed.error.issues.some((issue) => issue.path[0] === "appearance");
        if (appearanceIssue) {
          return {
            code: "invalid_appearance",
            message: "Appearance is not usable",
            status: 400,
          };
        }
        if (parsed.error.issues.some((issue) => issue.message === "Nothing to update")) {
          return {
            code: "invalid_action",
            message: "Nothing to update",
            status: 400,
          };
        }
        return invalidQuestionsError(parsed.error, input.body);
      }

      const patch = parsed.data;
      let next: Session = { ...session };
      if (patch.title !== undefined) {
        next = { ...next, title: patch.title };
      }
      if (patch.context !== undefined) {
        next = { ...next, context: patch.context };
      }
      if (patch.questions !== undefined) {
        next = { ...next, questions: patch.questions };
      }
      if (patch.appearance !== undefined) {
        next = { ...next, appearance: patch.appearance };
      }
      if (patch.metadata !== undefined) {
        next = { ...next, metadata: patch.metadata };
      }
      if (patch.callbackUrl !== undefined) {
        next = { ...next, callbackUrl: patch.callbackUrl };
      }
      if (patch.expiresInSeconds !== undefined) {
        next = {
          ...next,
          expiresAt: new Date(deps.now().getTime() + patch.expiresInSeconds * 1000).toISOString(),
        };
      }
      if (next.storageRevision !== undefined && !ownedSessionFits(next))
        return {
          code: "canonical_too_large",
          message:
            "This questionnaire and its permitted answers exceed 4 MiB. Reduce its content before saving it.",
          status: 413,
        };
      await deps.store.save(next);
      return agentView(next, urlsFor(next));
    },

    async getForPublic(input: {
      sessionId: string;
      publicToken?: string;
    }): Promise<PublicSessionView | SessionServiceError> {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) {
        return session;
      }
      return publicView(session);
    },

    /**
     * For a link-preview crawler, which has no public token. The preview token
     * proves the caller was handed the answer link without carrying the token
     * that opens it, and SessionPreview cannot express an answer.
     */
    async getForPreview(input: {
      sessionId: string;
      previewToken?: string;
    }): Promise<SessionPreview | SessionServiceError> {
      const session = await loadById(input.sessionId);
      if (isServiceError(session)) {
        return session;
      }
      const matches = previewTokenMatches(
        { sessionId: session.id, publicToken: session.publicToken },
        input.previewToken,
      );
      if (!matches) {
        return unknownSessionError();
      }
      return sessionPreview(session, deps.now());
    },

    async markdownForPublic(input: {
      sessionId: string;
      publicToken?: string;
    }): Promise<string | SessionServiceError> {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) {
        return session;
      }
      const urls = urlsFor(session);
      return questionnaireMarkdown({
        title: session.title,
        context: session.context,
        questions: session.questions,
        answerUrl: urls.answerUrl,
        machineUrl: urls.machineUrl,
        answersUrl: urls.answersUrl,
        submitUrl: urls.submitUrl,
        filesUrl: urls.filesUrl,
        status: session.status,
        expiresAt: session.expiresAt,
        answers: outwardAnswers(session),
      });
    },

    async markOpened(input: {
      sessionId: string;
      publicToken?: string;
    }): Promise<OpenedResult | SessionServiceError> {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) {
        return session;
      }
      if (sessionIsFrozen(session)) {
        if (session.openedAt) {
          return { openedAt: session.openedAt, status: session.status };
        }
        return session.status === "expired" ? expiredError() : frozenError();
      }
      if (session.openedAt) {
        return { openedAt: session.openedAt, status: session.status };
      }
      const openedAt = deps.now().toISOString();
      await deps.store.save({ ...session, openedAt });
      return { openedAt, status: session.status };
    },

    async saveAnswer(input: {
      sessionId: string;
      questionId: string;
      publicToken?: string;
      body: unknown;
    }): Promise<SaveAnswerResult | SessionServiceError> {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) {
        return session;
      }
      if (session.status === "expired") {
        return expiredError();
      }
      if (sessionIsFrozen(session)) {
        return frozenError();
      }

      const parsed = saveAnswerSchema.safeParse(input.body);
      if (!parsed.success) {
        return {
          code: "invalid_answer",
          message: "Answer is not usable",
          status: 400,
        };
      }

      let question: Session["questions"][number] | undefined;
      for (const candidate of session.questions) {
        if (candidate.id === input.questionId) {
          question = candidate;
          break;
        }
      }
      if (!question) {
        return {
          code: "invalid_answer",
          message: "Question is not on this questionnaire",
          status: 400,
        };
      }

      if (parsed.data.fileIds !== undefined && !question.allowFiles) {
        return {
          code: "invalid_answer",
          message: "This question does not allow files",
          status: 400,
        };
      }

      const previous = ownValue(session.answers, input.questionId);
      const selected = parsed.data.selectedOptionIds ?? previous?.selectedOptionIds ?? [];
      const text = parsed.data.text !== undefined ? parsed.data.text : previous?.text;
      let entries = parsed.data.entries !== undefined ? parsed.data.entries : previous?.entries;

      let files = previous?.files;
      if (parsed.data.fileIds !== undefined) {
        const resolved: SessionFile[] = [];
        const access =
          session.storageRevision !== undefined
            ? await metadata().call<AskFileAccess>("fileAccess", { id: session.id })
            : null;
        for (const fileId of session.storageRevision !== undefined
          ? [...new Set(parsed.data.fileIds)]
          : parsed.data.fileIds) {
          const uploaded = ownValue(session.uploads, fileId);
          if (
            !uploaded ||
            uploaded.questionId !== input.questionId ||
            (access && !access.fileIds.includes(fileId))
          ) {
            return {
              code: "invalid_answer",
              message: "File is not on this question",
              status: 400,
            };
          }
          resolved.push(uploaded);
        }
        files = resolved;
      }

      if (isEntryQuestion(question)) {
        if (parsed.data.selectedOptionIds !== undefined) {
          return {
            code: "invalid_answer",
            message: "This question does not take options",
            status: 400,
          };
        }
        if (parsed.data.text !== undefined && !question.allowComment) {
          return {
            code: "invalid_answer",
            message: "This question does not allow a comment",
            status: 400,
          };
        }
        if (parsed.data.entries !== undefined) {
          const allowed = new Set<string>();
          for (const row of questionEntries(question)) {
            allowed.add(row.id);
          }
          const normalised: Record<string, string> = Object.create(null);
          for (const entryId of Object.keys(parsed.data.entries)) {
            if (!allowed.has(entryId)) {
              return {
                code: "invalid_answer",
                message: "Entry is not on this question",
                status: 400,
              };
            }
            const raw = parsed.data.entries[entryId] ?? "";
            let row: ReturnType<typeof questionEntries>[number] | undefined;
            for (const candidate of questionEntries(question)) {
              if (candidate.id === entryId) {
                row = candidate;
                break;
              }
            }
            if (row?.input === "money") {
              if (raw.trim().length === 0) {
                continue;
              }
              const currency = resolveEntryCurrency(row, question);
              const money = currency ? parseMoney(raw, currency) : null;
              if (!money) {
                return {
                  code: "invalid_answer",
                  message: "Money value is not usable",
                  status: 400,
                };
              }
              normalised[entryId] = money.canonical;
              continue;
            }
            normalised[entryId] = raw;
          }
          entries = normalised;
        }
      } else if (isTextQuestion(question)) {
        if (parsed.data.selectedOptionIds !== undefined) {
          return {
            code: "invalid_answer",
            message: "Text questions do not take options",
            status: 400,
          };
        }
        if (parsed.data.entries !== undefined) {
          return {
            code: "invalid_answer",
            message: "Text questions do not take entries",
            status: 400,
          };
        }
        const hasText = Boolean(text && text.trim().length > 0);
        const hasFiles = Boolean(files && files.length > 0);
        if (!hasText && !hasFiles) {
          return {
            code: "invalid_answer",
            message: "Text is required for this question",
            status: 400,
          };
        }
      } else {
        if (parsed.data.text !== undefined && !question.allowComment) {
          return {
            code: "invalid_answer",
            message: "This question does not allow a comment",
            status: 400,
          };
        }
        if (parsed.data.entries !== undefined) {
          return {
            code: "invalid_answer",
            message: "Choice questions do not take entries",
            status: 400,
          };
        }
        if (parsed.data.selectedOptionIds !== undefined) {
          if (!question.allowMultiple && parsed.data.selectedOptionIds.length !== 1) {
            return {
              code: "invalid_answer",
              message: "This question allows one option",
              status: 400,
            };
          }
          const allowed = optionIdsOnQuestion(question);
          for (const optionId of parsed.data.selectedOptionIds) {
            if (!allowed.has(optionId)) {
              return {
                code: "invalid_answer",
                message: "Option is not on this question",
                status: 400,
              };
            }
          }
        }
      }

      const nextAnswer: SessionAnswer = {
        selectedOptionIds:
          isTextQuestion(question) || isEntryQuestion(question)
            ? []
            : session.storageRevision !== undefined
              ? [...new Set(selected)]
              : selected,
        answeredAt: deps.now().toISOString(),
      };
      if (text !== undefined && text.length > 0) {
        nextAnswer.text = text;
      }
      if (entries && Object.keys(entries).length > 0) {
        nextAnswer.entries = entries;
      }
      if (files && files.length > 0) {
        nextAnswer.files = files;
      }

      const next: Session = {
        ...session,
        status: session.status === "pending" ? "in_progress" : session.status,
        answers: {
          ...session.answers,
          [input.questionId]: nextAnswer,
        },
      };
      await deps.store.save(next);
      return {
        questionId: input.questionId,
        progress: progressFor(next),
      };
    },

    async saveAnswers(input: {
      sessionId: string;
      publicToken?: string;
      body: unknown;
    }): Promise<BulkSaveResult | SessionServiceError> {
      const parsed = bulkAnswersSchema.safeParse(input.body);
      if (!parsed.success) {
        return {
          code: "invalid_answer",
          message: "Answers are not usable",
          status: 400,
        };
      }
      let progress: SessionProgress | undefined;
      for (const questionId of Object.keys(parsed.data.answers)) {
        const result = await service.saveAnswer({
          sessionId: input.sessionId,
          questionId,
          publicToken: input.publicToken,
          body: parsed.data.answers[questionId],
        });
        if (isServiceError(result)) {
          return result;
        }
        progress = result.progress;
      }
      if (!progress) {
        return {
          code: "invalid_answer",
          message: "Answers are not usable",
          status: 400,
        };
      }
      if (!parsed.data.submit) {
        return { progress };
      }
      const submitted = await service.submit({
        sessionId: input.sessionId,
        publicToken: input.publicToken,
      });
      if (isServiceError(submitted)) {
        return submitted;
      }
      return { progress, submitted };
    },

    // Every check attachFile makes, without writing anything. The upload route
    // calls this before it puts bytes in storage, so a caller without the
    // answer token cannot reach the bucket at all. attachFile still repeats the
    // checks — the upload is not instant and the session can freeze meanwhile.
    async canAcceptFile(input: {
      sessionId: string;
      publicToken?: string;
      questionId: string;
    }): Promise<SessionServiceError | null> {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) {
        return session;
      }
      return fileGuard(session, input.questionId);
    },

    async ownedUploadContext(input: {
      sessionId: string;
      publicToken?: string;
      questionId: string;
    }) {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) return session;
      const refused = fileGuard(session, input.questionId);
      if (refused) return refused;
      return { owned: session.storageRevision !== undefined };
    },
    async ownedUploadResult(input: { sessionId: string; publicToken?: string; fileId: string }) {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) return session;
      const file = ownValue(session.uploads, input.fileId);
      if (!file) return unknownSessionError();
      return {
        file: { ...file, key: undefined, url: fileUrlFor(session, file.id) },
        progress: progressFor(session),
      };
    },

    async attachFile(input: {
      sessionId: string;
      publicToken?: string;
      questionId: string;
      filename: string;
      contentType: string;
      size: number;
      storageKey: string;
    }): Promise<AttachFileResult | SessionServiceError> {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) {
        return session;
      }
      const refused = fileGuard(session, input.questionId);
      if (refused) {
        return refused;
      }
      if (session.storageRevision !== undefined)
        return {
          code: "invalid_upload",
          message: "Owned attachments must use the verified storage operation",
          status: 409,
        };
      const existing = ownValue(session.answers, input.questionId)?.files ?? [];
      const fileId = deps.createToken();
      const file: SessionFile = {
        id: fileId,
        questionId: input.questionId,
        filename: input.filename,
        contentType: input.contentType,
        size: input.size,
        key: input.storageKey,
        url: fileUrlFor(session, fileId),
        // Record the actual first attachment receipt; claims must never invent this later.
        uploadedAt: deps.now().toISOString(),
      };
      const previous = ownValue(session.answers, input.questionId);
      const nextAnswer: SessionAnswer = {
        selectedOptionIds: previous?.selectedOptionIds ?? [],
        answeredAt: deps.now().toISOString(),
        files: [...existing, file],
      };
      if (previous?.text) {
        nextAnswer.text = previous.text;
      }
      if (previous?.entries) {
        nextAnswer.entries = previous.entries;
      }
      const next: Session = {
        ...session,
        status: session.status === "pending" ? "in_progress" : session.status,
        uploads: { ...session.uploads, [file.id]: file },
        answers: {
          ...session.answers,
          [input.questionId]: nextAnswer,
        },
      };
      await deps.store.save(next);
      return { file, progress: progressFor(next) };
    },

    async readPublicFile(input: {
      sessionId: string;
      publicToken?: string;
      fileId: string;
    }): Promise<SessionFile | SessionServiceError> {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) {
        return session;
      }
      const file = ownValue(session.uploads, input.fileId);
      if (!file) {
        return {
          code: "not_found",
          message: "File was not found",
          status: 404,
        };
      }
      const readable = await requireReadableFile(session, input.fileId);
      if (isServiceError(readable)) return readable;
      return { ...readable, url: fileUrlFor(session, readable.id) };
    },

    async submit(input: {
      sessionId: string;
      publicToken?: string;
    }): Promise<SubmitResult | SessionServiceError> {
      const session = await loadForPublic(input.sessionId, input.publicToken);
      if (isServiceError(session)) {
        return session;
      }
      if (session.status === "submitted" && session.submittedAt) {
        return {
          status: "submitted",
          submittedAt: session.submittedAt,
          answers: outwardAnswers(session),
        };
      }
      if (session.status === "expired") {
        return expiredError();
      }
      if (session.status === "cancelled") {
        return frozenError();
      }

      const missing: string[] = [];
      for (const question of session.questions) {
        if (!question.required) {
          continue;
        }
        if (!questionIsAnswered(question, ownValue(session.answers, question.id))) {
          missing.push(question.id);
        }
      }
      if (missing.length > 0) {
        return {
          code: "required_unanswered",
          message: `Required questions have no answer: ${missing.join(", ")}`,
          status: 400,
        };
      }

      const submittedAt = deps.now().toISOString();
      const next: Session = {
        ...session,
        status: "submitted",
        submittedAt,
      };
      await deps.store.save(next);
      await notifyTerminal(next);
      return {
        status: "submitted",
        submittedAt,
        answers: outwardAnswers(next),
      };
    },

    async cancel(input: {
      sessionId: string;
      publicToken?: string;
      agentToken?: string;
      hasCreateCredential: boolean;
    }): Promise<CancelResult | SessionServiceError> {
      const session = await loadById(input.sessionId);
      if (isServiceError(session)) {
        return session;
      }
      const allowed =
        input.hasCreateCredential ||
        (input.agentToken !== undefined && tokensMatch(input.agentToken, session.agentToken)) ||
        (input.publicToken !== undefined && tokensMatch(input.publicToken, session.publicToken));
      if (!allowed) {
        return unknownSessionError();
      }
      if (session.status === "cancelled") {
        return {
          status: "cancelled",
          answers: outwardAnswers(session),
        };
      }
      if (session.status === "submitted" || session.status === "expired") {
        return frozenError();
      }
      const cancelledAt = deps.now().toISOString();
      const next: Session = {
        ...session,
        status: "cancelled",
        cancelledAt,
      };
      await deps.store.save(next);
      await notifyTerminal(next);
      return {
        status: "cancelled",
        answers: outwardAnswers(next),
      };
    },

    async downloadForPublic(input: {
      sessionId: string;
      publicToken?: string;
    }): Promise<DownloadAnswers | SessionServiceError> {
      const session = await loadSubmittedForPublic(input);
      if (isServiceError(session)) {
        return session;
      }
      return downloadAnswersFrom(session);
    },

    async downloadMarkdownForPublic(input: {
      sessionId: string;
      publicToken?: string;
    }): Promise<string | SessionServiceError> {
      const session = await loadSubmittedForPublic(input);
      if (isServiceError(session)) {
        return session;
      }
      return answersDownloadMarkdown(downloadAnswersFrom(session), session.questions);
    },

    async wait(input: {
      sessionId: string;
      agentToken?: string;
      hasCreateCredential: boolean;
      body: unknown;
    }): Promise<AgentSessionView | SessionServiceError> {
      const parsed = waitSchema.safeParse(input.body);
      if (!parsed.success) {
        return {
          code: "invalid_bound",
          message: `Wait bound must be between 1 and ${WAIT_MAX_SECONDS} seconds`,
          status: 400,
        };
      }

      const deadline = deps.now().getTime() + parsed.data.seconds * 1000;
      const pollMs = deps.waitPollMs ?? WAIT_POLL_MS;
      while (true) {
        const session = await loadForAgent({
          sessionId: input.sessionId,
          agentToken: input.agentToken,
          hasCreateCredential: input.hasCreateCredential,
        });
        if (isServiceError(session)) {
          return session;
        }
        if (isTerminalStatus(session.status)) {
          return agentView(session, urlsFor(session));
        }
        const remaining = deadline - deps.now().getTime();
        if (remaining <= 0) {
          return agentView(session, urlsFor(session));
        }
        await deps.sleep(Math.min(pollMs, remaining));
      }
    },
  };
  type SafeService = {
    [K in keyof typeof service]: (
      ...args: Parameters<(typeof service)[K]>
    ) => Promise<Awaited<ReturnType<(typeof service)[K]>> | SessionServiceError>;
  };
  return new Proxy(service, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        try {
          return await Reflect.apply(value, target, args);
        } catch (error) {
          if (error instanceof OwnedSessionError)
            return { code: error.code, message: error.message, status: error.status };
          throw error;
        }
      };
    },
  }) as SafeService;
}

export async function postCallbackJson(url: string, body: unknown): Promise<void> {
  // Re-checked at delivery, not just at create: the name may resolve somewhere
  // else by now, and this is the moment the request actually goes out.
  const checked = callbackUrlIsUsable(url);
  if (!checked.ok) {
    return;
  }
  if (!(await callbackHostResolvesPublicly(checked.url.hostname))) {
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, 3000);
  try {
    const response = await fetch(checked.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      // A redirect is a second destination the agent never named, and it would
      // not go through the checks above.
      redirect: "manual",
    });
    // Read nothing back. The body is not wanted and reading it is a way to be
    // held open by a slow responder.
    void response.status;
  } catch {
    return;
  } finally {
    clearTimeout(timer);
  }
}

export function isSessionServiceError(value: unknown): value is SessionServiceError {
  return isServiceError(value);
}

export function defaultSessionServiceDeps(store: SessionStore): SessionServiceDeps {
  return {
    store,
    metadata: defaultAskMetadata(),
    now: () => new Date(),
    createId: () => randomUUID(),
    createToken,
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
    waitPollMs:
      process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL ? 400 : WAIT_POLL_MS,
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
    postCallback: postCallbackJson,
  };
}
