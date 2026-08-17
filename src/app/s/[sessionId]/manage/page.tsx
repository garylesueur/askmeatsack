import type { Metadata } from "next";
import { AppearanceShell } from "@/components/appearance-shell";
import { MarkdownBody } from "@/components/markdown-body";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDefaultSessionService } from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";
import { UnknownLinkScreen } from "../status-screens";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: {
      index: false,
      follow: false,
    },
  };
}

function questionKind(question: {
  options: { id: string }[];
  allowMultiple: boolean;
}): string {
  if (question.options.length === 0) {
    return "Text";
  }
  if (question.allowMultiple) {
    return "Several options";
  }
  return "Choice";
}

export default async function ManagePage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const query = await searchParams;
  const view = await getDefaultSessionService().getForAgent({
    sessionId,
    agentToken: query.token,
    hasCreateCredential: false,
  });

  if (isSessionServiceError(view)) {
    return <UnknownLinkScreen />;
  }

  const canEdit = view.status === "pending";

  return (
    <AppearanceShell className="px-4 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <p className="text-sm text-muted-foreground">askmeatsack.com · private</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-medium">
            {view.title ?? "Questionnaire"}
          </h1>
          <Badge variant="secondary">{view.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Nobody has answered yet. You can still change the questions with the askmeatsack.com tool (action edit) or PATCH."
            : "Questions are frozen. Share the answer link, or wait for a result."}
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Share with the human</CardTitle>
            <CardDescription>
              This page is private. Give them the answer link, not this URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <a className="break-all underline underline-offset-4" href={view.answerUrl}>
              {view.answerUrl}
            </a>
            <p className="text-muted-foreground">
              Expires {view.expiresAt}
              {view.openedAt ? ` · Opened ${view.openedAt}` : " · Not opened yet"}
              {` · ${view.progress.answeredCount} of ${view.progress.totalCount} answered`}
            </p>
          </CardContent>
        </Card>

        {view.context ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Context</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownBody source={view.context} />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Questions</CardTitle>
            <CardDescription>
              {view.questions.length} question
              {view.questions.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {view.questions.map((question) => {
              const answer = view.answers[question.id];
              return (
                <div key={question.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs text-muted-foreground">
                      {question.id}
                    </p>
                    <Badge variant="outline">{questionKind(question)}</Badge>
                    <Badge variant="outline">
                      {question.required ? "Required" : "Optional"}
                    </Badge>
                    {question.allowFiles ? (
                      <Badge variant="outline">Files</Badge>
                    ) : null}
                  </div>
                  <MarkdownBody source={question.prompt} compact />
                  {question.detail ? <MarkdownBody source={question.detail} /> : null}
                  {question.options.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                      {question.options.map((option) => (
                        <li key={option.id}>
                          {option.label}
                          {question.recommendedOptionId === option.id
                            ? " (recommended)"
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {answer ? (
                    <p className="text-sm text-muted-foreground">
                      Answered
                      {answer.selectedOptionIds.length > 0
                        ? `: ${answer.selectedOptionIds.join(", ")}`
                        : ""}
                      {answer.text ? ` — ${answer.text}` : ""}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppearanceShell>
  );
}
