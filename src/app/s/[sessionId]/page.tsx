import type { Metadata } from "next";
import { machineQuestionnairePath } from "@/lib/answer-document";
import {
  getDefaultSessionService,
} from "@/lib/app-sessions";
import {
  humanScreenFor,
  isSessionServiceError,
} from "@/lib/sessions";
import { AnsweringForm } from "./answering-form";
import {
  CancelledScreen,
  ExpiredLinkScreen,
  SubmittedScreen,
  UnknownLinkScreen,
} from "./status-screens";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string; token?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  const query = await searchParams;
  const publicToken = query.t ?? query.token;
  return {
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      types: {
        "text/markdown": machineQuestionnairePath(sessionId, publicToken),
      },
    },
  };
}

export default async function AnsweringPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const query = await searchParams;
  const publicToken = query.t ?? query.token;
  const view = await getDefaultSessionService().getForPublic({
    sessionId,
    publicToken,
  });
  const screen = humanScreenFor(view);

  if (screen === "unknown_link" || isSessionServiceError(view)) {
    return <UnknownLinkScreen />;
  }
  if (screen === "submitted_view") {
    return (
      <SubmittedScreen
        downloadHref={`/api/v1/sessions/${sessionId}/download?t=${encodeURIComponent(publicToken ?? "")}`}
        appearance={view.appearance}
        sessionId={sessionId}
        publicToken={publicToken}
      />
    );
  }
  if (screen === "expired_view") {
    return <ExpiredLinkScreen appearance={view.appearance} />;
  }
  if (screen === "cancelled_view") {
    return <CancelledScreen appearance={view.appearance} />;
  }

  const machineHref = machineQuestionnairePath(sessionId, publicToken);

  return (
    <AnsweringForm
      sessionId={view.sessionId}
      publicToken={publicToken ?? ""}
      title={view.title}
      context={view.context}
      appearance={view.appearance}
      questions={view.questions}
      initialAnswers={view.answers}
      initialProgress={view.progress}
      expiresAt={view.expiresAt}
      machineHref={machineHref}
    />
  );
}
