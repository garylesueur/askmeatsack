import type { Appearance } from "@/lib/schema";
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
  markdownHref,
  appearance,
}: {
  title: string;
  body: string;
  downloadHref?: string;
  markdownHref?: string;
  appearance?: Appearance;
}) {
  const hasDownload = Boolean(markdownHref || downloadHref);
  return (
    <AppearanceShell appearance={appearance} className="items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm text-muted-foreground">askmeatsack.com</p>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">{body}</CardDescription>
        </CardHeader>
        {hasDownload ? (
          <CardContent className="flex flex-col gap-3">
            {markdownHref ? (
              <Button asChild>
                <a href={markdownHref} download="answers.md">
                  Download as Markdown
                </a>
              </Button>
            ) : null}
            {downloadHref ? (
              <Button asChild variant="outline">
                <a href={downloadHref} download="answers.json">
                  Download as JSON
                </a>
              </Button>
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
  markdownHref,
  appearance,
}: {
  downloadHref?: string;
  markdownHref?: string;
  appearance?: Appearance;
}) {
  return (
    <StatusScreen
      title="This questionnaire is already finished"
      body="You can close this tab. Answers cannot be changed. Download a copy if you want one."
      downloadHref={downloadHref}
      markdownHref={markdownHref}
      appearance={appearance}
    />
  );
}

export function ThankYouScreen({
  downloadHref,
  markdownHref,
  appearance,
}: {
  downloadHref?: string;
  markdownHref?: string;
  appearance?: Appearance;
}) {
  return (
    <StatusScreen
      title="You are done"
      body="You can close this tab. Download a copy if you want one."
      downloadHref={downloadHref}
      markdownHref={markdownHref}
      appearance={appearance}
    />
  );
}
