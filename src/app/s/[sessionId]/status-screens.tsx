import type { Appearance } from "@/lib/schema";
import { AnswersCopyForm } from "@/components/answers-copy-form";
import { AppearanceShell } from "@/components/appearance-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function StatusScreen({
  title,
  body,
  downloadHref,
  appearance,
  sessionId,
  publicToken,
}: {
  title: string;
  body: string;
  downloadHref?: string;
  appearance?: Appearance;
  sessionId?: string;
  publicToken?: string;
}) {
  return (
    <AppearanceShell appearance={appearance} className="items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm text-muted-foreground">askmeatsack.com</p>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">{body}</CardDescription>
        </CardHeader>
        {downloadHref ? (
          <CardContent className="flex flex-col gap-4">
            <Button asChild variant="outline">
              <a href={downloadHref} download="answers.json">
                Download answers as JSON
              </a>
            </Button>
            {sessionId && publicToken ? (
              <AnswersCopyForm
                sessionId={sessionId}
                publicToken={publicToken}
              />
            ) : null}
          </CardContent>
        ) : null}
      </Card>
    </AppearanceShell>
  );
}

export function UnknownLinkScreen() {
  return (
    <StatusScreen
      title="This link is unknown"
      body="No questionnaire is available here."
    />
  );
}

export function ExpiredLinkScreen({ appearance }: { appearance?: Appearance }) {
  return (
    <StatusScreen
      title="This link has expired"
      body="Answers can no longer be changed or submitted."
      appearance={appearance}
    />
  );
}

export function CancelledScreen({ appearance }: { appearance?: Appearance }) {
  return (
    <StatusScreen
      title="This questionnaire was cancelled"
      body="Answers can no longer be changed or submitted."
      appearance={appearance}
    />
  );
}

export function SubmittedScreen({
  downloadHref,
  appearance,
  sessionId,
  publicToken,
}: {
  downloadHref?: string;
  appearance?: Appearance;
  sessionId?: string;
  publicToken?: string;
}) {
  return (
    <StatusScreen
      title="This questionnaire is already finished"
      body="You can close this tab. Answers cannot be changed."
      downloadHref={downloadHref}
      appearance={appearance}
      sessionId={sessionId}
      publicToken={publicToken}
    />
  );
}

export function ThankYouScreen({
  downloadHref,
  appearance,
  sessionId,
  publicToken,
}: {
  downloadHref?: string;
  appearance?: Appearance;
  sessionId?: string;
  publicToken?: string;
}) {
  return (
    <StatusScreen
      title="You are done"
      body="You can close this tab."
      downloadHref={downloadHref}
      appearance={appearance}
      sessionId={sessionId}
      publicToken={publicToken}
    />
  );
}
