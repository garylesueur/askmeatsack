import { z } from "zod";
import {
  SESSION_MAX_TTL_SECONDS,
  WAIT_MAX_SECONDS,
  appearanceSchema,
  questionSchema,
} from "./schema";
import {
  isSessionServiceError,
  type SessionServiceError,
  type createSessionService,
} from "./sessions";

export const ASKMEATSACK_TOOL_NAME = "askmeatsack.com";

export const askmeatsackToolActions = [
  "create",
  "status",
  "wait",
  "cancel",
  "email",
  "edit",
] as const;

export type AskmeatsackToolAction = (typeof askmeatsackToolActions)[number];

export const askmeatsackToolInputShape = {
  action: z.enum(askmeatsackToolActions),
  sessionId: z.string().min(1).optional(),
  seconds: z.number().int().positive().max(WAIT_MAX_SECONDS).optional(),
  title: z.string().min(1).optional(),
  context: z.string().optional(),
  expiresInSeconds: z
    .number()
    .int()
    .positive()
    .max(SESSION_MAX_TTL_SECONDS)
    .optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  callbackUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  appearance: appearanceSchema.optional(),
  agentToken: z.string().min(1).optional(),
  questions: z.array(questionSchema).optional(),
};

export type AskmeatsackToolSessions = ReturnType<typeof createSessionService>;

function invalidAction(message: string): SessionServiceError {
  return {
    code: "invalid_action",
    message,
    status: 400,
  };
}

export function createAskmeatsackTool(sessions: AskmeatsackToolSessions) {
  return {
    name: ASKMEATSACK_TOOL_NAME,
    async invoke(input: {
      action: AskmeatsackToolAction;
      sessionId?: string;
      seconds?: number;
      title?: string;
      context?: string;
      expiresInSeconds?: number;
      metadata?: Record<string, string>;
      callbackUrl?: string;
      email?: string;
      appearance?: unknown;
      agentToken?: string;
      questions?: unknown;
    }): Promise<unknown> {
      if (input.action === "create") {
        return await sessions.create({
          title: input.title,
          context: input.context,
          expiresInSeconds: input.expiresInSeconds,
          metadata: input.metadata,
          callbackUrl: input.callbackUrl,
          email: input.email,
          appearance: input.appearance,
          questions: input.questions,
        });
      }

      if (!input.sessionId) {
        return invalidAction("sessionId is required");
      }

      if (input.action === "status") {
        return await sessions.getForAgent({
          sessionId: input.sessionId,
          agentToken: input.agentToken,
          hasCreateCredential: false,
        });
      }

      if (input.action === "wait") {
        return await sessions.wait({
          sessionId: input.sessionId,
          agentToken: input.agentToken,
          hasCreateCredential: false,
          body: { seconds: input.seconds },
        });
      }

      if (input.action === "email") {
        return await sessions.sendEmail({
          sessionId: input.sessionId,
          agentToken: input.agentToken,
          hasCreateCredential: false,
          body: { email: input.email },
        });
      }

      if (input.action === "edit") {
        return await sessions.update({
          sessionId: input.sessionId,
          agentToken: input.agentToken,
          hasCreateCredential: false,
          body: {
            title: input.title,
            context: input.context,
            expiresInSeconds: input.expiresInSeconds,
            metadata: input.metadata,
            callbackUrl: input.callbackUrl,
            email: input.email,
            appearance: input.appearance,
            questions: input.questions,
          },
        });
      }

      return await sessions.cancel({
        sessionId: input.sessionId,
        agentToken: input.agentToken,
        hasCreateCredential: false,
      });
    },
  };
}

export function isAskmeatsackToolError(
  value: unknown,
): value is SessionServiceError {
  return isSessionServiceError(value);
}
