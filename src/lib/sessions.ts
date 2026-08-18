import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { ZodError } from "zod";
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
import { callbackHostResolvesPublicly } from "./callback-dns";
import { callbackUrlIsUsable } from "./callback-url";
import { manageMarkdown } from "./manage-markdown";
import { questionnaireMarkdown } from "./questionnaire-markdown";
import { parseMoney, resolveEntryCurrency } from "./money";
import { entriesAreComplete, questionEntries, questionKind } from "./question-presentation";
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
    const answered = questionIsAnswered(question, session.answers[question.id]);
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
    answers: session.answers,
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
    answers: session.answers,
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
    const answer = session.answers[question.id];
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
      row.files = answer.files;
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
  const existing = session.answers[questionId]?.files ?? [];
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

  async function hydrate(session: Session): Promise<Session | SessionServiceError> {
    const nowMs = deps.now().getTime();
    let status = session.status;
    if (status === "pending" || status === "in_progress") {
      if (nowMs >= Date.parse(session.expiresAt)) {
        status = "expired";
      }
    }

    const readUntil = readWindowEndsAtMs(session, status);
    if (readUntil !== null && nowMs >= readUntil) {
      await deps.store.delete(session.id);
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
    return session;
  }

  async function loadById(sessionId: string): Promise<Session | SessionServiceError> {
    const session = await deps.store.getById(sessionId);
    if (!session) {
      return unknownSessionError();
    }
    return hydrate(session);
  }

  async function loadForPublic(
    sessionId: string,
    publicToken: string | undefined,
  ): Promise<Session | SessionServiceError> {
    const session = await loadById(sessionId);
    if (isServiceError(session)) {
      return session;
    }
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
    await deps.store.save({ ...session, callbackSent: true });
    try {
      await deps.postCallback(session.callbackUrl, {
        sessionId: session.id,
        status: session.status,
        answers: session.answers,
      });
    } catch {
      return;
    }
  }

  const service = {
    async create(body: unknown): Promise<CreateSessionResult | SessionServiceError> {
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
      const session: Session = {
        id: deps.createId(),
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
      await deps.store.save(session);
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
        answers: session.answers,
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

      const previous = session.answers[input.questionId];
      const selected = parsed.data.selectedOptionIds ?? previous?.selectedOptionIds ?? [];
      const text = parsed.data.text !== undefined ? parsed.data.text : previous?.text;
      let entries = parsed.data.entries !== undefined ? parsed.data.entries : previous?.entries;

      let files = previous?.files;
      if (parsed.data.fileIds !== undefined) {
        const resolved: SessionFile[] = [];
        for (const fileId of parsed.data.fileIds) {
          const uploaded = session.uploads?.[fileId];
          if (!uploaded || uploaded.questionId !== input.questionId) {
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
          const normalised: Record<string, string> = {};
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
        selectedOptionIds: isTextQuestion(question) || isEntryQuestion(question) ? [] : selected,
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
      const existing = session.answers[input.questionId]?.files ?? [];
      const fileId = deps.createToken();
      const file: SessionFile = {
        id: fileId,
        questionId: input.questionId,
        filename: input.filename,
        contentType: input.contentType,
        size: input.size,
        key: input.storageKey,
        url: fileUrlFor(session, fileId),
      };
      const previous = session.answers[input.questionId];
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
      const file = session.uploads?.[input.fileId];
      if (!file) {
        return {
          code: "not_found",
          message: "File was not found",
          status: 404,
        };
      }
      return {
        ...file,
        url: fileUrlFor(session, file.id),
      };
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
          answers: session.answers,
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
        if (!questionIsAnswered(question, session.answers[question.id])) {
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
        answers: next.answers,
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
          answers: session.answers,
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
        answers: next.answers,
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
  return service;
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
