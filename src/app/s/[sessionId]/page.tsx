import type { Metadata } from "next";
import { machineQuestionnairePath } from "@/lib/answer-document";
import { getDefaultSessionService } from "@/lib/app-sessions";
import { humanScreenFor, isSessionServiceError } from "@/lib/sessions";
import { previewTokenFor } from "@/lib/preview-token";
import { previewFromPublicView, previewSummary } from "@/lib/session-preview";
import { publicOrigin } from "@/lib/public-origin";
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

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  const query = await searchParams;
  const publicToken = query.t ?? query.token;
  const base: Metadata = {
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

  // Only someone already holding the public token can be handed a card URL, and
  // the card URL cannot be turned back into the public token.
  if (!publicToken) {
    return base;
  }
  const view = await getDefaultSessionService().getForPublic({ sessionId, publicToken });
  if (isSessionServiceError(view)) {
    return base;
  }
  const preview = previewFromPublicView(view);
  const imageUrl = `${publicOrigin()}/s/${sessionId}/opengraph-image?p=${previewTokenFor({
    sessionId,
    publicToken,
  })}`;

  return {
    ...base,
    title: preview.title,
    description: previewSummary(preview),
    openGraph: {
      type: "website",
      title: preview.title,
      description: previewSummary(preview),
      images: [{ url: imageUrl, width: 1200, height: 630, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: preview.title,
      description: previewSummary(preview),
      images: [imageUrl],
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
    const downloadQuery = `t=${encodeURIComponent(publicToken ?? "")}`;
    return (
      <SubmittedScreen
        downloadHref={`/api/v1/sessions/${sessionId}/download?${downloadQuery}`}
        markdownHref={`/api/v1/sessions/${sessionId}/download?${downloadQuery}&format=md`}
        appearance={view.appearance}
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
