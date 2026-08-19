import { ImageResponse } from "next/og";
import { SITE_TITLE } from "@/lib/agent-docs";
import { getDefaultSessionService } from "@/lib/app-sessions";
import { isSessionServiceError } from "@/lib/sessions";
import { expiryPhrase, previewSummary, type SessionPreview } from "@/lib/session-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPENGRAPH_SIZE = { width: 1200, height: 630 } as const;

const INK = "#141820";
const PAPER = "#f4f1ea";
const MUTED = "#9aa3b2";
const ACCENT = "#5ecfbc";
const RULE = "#2a313d";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await context.params;
  const previewToken = new URL(request.url).searchParams.get("p") ?? undefined;
  const preview = await getDefaultSessionService().getForPreview({
    sessionId,
    previewToken,
  });

  // A bad or missing preview token is not worth distinguishing from an unknown
  // session: both get the card that says nothing about anybody's questionnaire.
  if (isSessionServiceError(preview)) {
    return card(null);
  }
  return card(preview);
}

function card(preview: SessionPreview | null): ImageResponse {
  const title = preview?.title ?? "Someone needs a few answers";
  const summary = preview ? previewSummary(preview) : "Open the link to see the questions";
  const context = preview?.context ?? null;
  const expiry = preview ? expiryPhrase(preview, new Date()) : null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: INK,
        color: PAPER,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: ACCENT }}
        />
        <div style={{ display: "flex", fontSize: 27, color: MUTED }}>{SITE_TITLE}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 55 ? 58 : 70,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1.12,
          }}
        >
          {title}
        </div>
        {context ? (
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 29,
              lineHeight: 1.4,
              color: MUTED,
            }}
          >
            {context}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingTop: 28,
          borderTop: `1px solid ${RULE}`,
          fontSize: 27,
          color: PAPER,
        }}
      >
        <div style={{ display: "flex" }}>{summary}</div>
        {expiry ? (
          <div style={{ display: "flex", marginLeft: 18, color: MUTED }}>{`· ${expiry}`}</div>
        ) : null}
      </div>
    </div>,
    { ...OPENGRAPH_SIZE },
  );
}
