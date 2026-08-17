import { SESSION_READ_WINDOW_SECONDS } from "./schema";
import type { Appearance, Question, SessionStatus } from "./schema";

export type SessionFile = {
  id: string;
  questionId: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
};

export type SessionAnswer = {
  selectedOptionIds: string[];
  text?: string;
  files?: SessionFile[];
  answeredAt: string;
};

export type Session = {
  id: string;
  createdAt: string;
  expiresAt: string;
  submittedAt?: string;
  cancelledAt?: string;
  openedAt?: string;
  status: SessionStatus;
  title?: string;
  context?: string;
  appearance?: Appearance;
  questions: Question[];
  answers: Record<string, SessionAnswer>;
  uploads?: Record<string, SessionFile>;
  publicToken: string;
  agentToken: string;
  metadata?: Record<string, string>;
  callbackUrl?: string;
  callbackSent?: boolean;
  emailTo?: string;
  emailStatus?: "sent" | "failed";
  emailLastAttemptAt?: string;
  emailError?: string;
};

export type SessionStore = {
  save(session: Session): Promise<void>;
  getById(id: string): Promise<Session | null>;
  delete(id: string): Promise<void>;
};

export function createMemorySessionStore(): SessionStore {
  const sessions = new Map<string, Session>();

  return {
    async save(session: Session): Promise<void> {
      sessions.set(session.id, session);
    },
    async getById(id: string): Promise<Session | null> {
      return sessions.get(id) ?? null;
    },
    async delete(id: string): Promise<void> {
      sessions.delete(id);
    },
  };
}

export type KvClient = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: Session, opts: { ex: number }) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};

function sessionKey(id: string): string {
  return `askmeatsack:session:${id}`;
}

function redisTtlSeconds(session: Session, nowMs: number): number {
  const ends = [
    Date.parse(session.expiresAt) + SESSION_READ_WINDOW_SECONDS * 1000,
  ];
  if (session.submittedAt) {
    ends.push(
      Date.parse(session.submittedAt) + SESSION_READ_WINDOW_SECONDS * 1000,
    );
  }
  if (session.cancelledAt) {
    ends.push(
      Date.parse(session.cancelledAt) + SESSION_READ_WINDOW_SECONDS * 1000,
    );
  }
  const until = Math.max(...ends);
  return Math.max(1, Math.ceil((until - nowMs) / 1000));
}

export function createRedisSessionStore(
  kv: KvClient,
  now: () => Date = () => new Date(),
): SessionStore {
  return {
    async save(session: Session): Promise<void> {
      await kv.set(sessionKey(session.id), session, {
        ex: redisTtlSeconds(session, now().getTime()),
      });
    },
    async getById(id: string): Promise<Session | null> {
      const session = await kv.get<Session>(sessionKey(id));
      return session ?? null;
    },
    async delete(id: string): Promise<void> {
      await kv.del(sessionKey(id));
    },
  };
}
