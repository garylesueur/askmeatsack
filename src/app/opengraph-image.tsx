import { ImageResponse } from "next/og";
import { SITE_TAGLINE, SITE_TITLE } from "@/lib/agent-docs";

export const alt = `${SITE_TITLE} — ${SITE_TAGLINE}`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#141820",
        color: "#f4f1ea",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, color: "#9aa3b2" }}>{SITE_TITLE}</div>
      <div
        style={{
          display: "flex",
          marginTop: 24,
          fontSize: 64,
          fontWeight: 500,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
        }}
      >
        {SITE_TAGLINE}
      </div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: "#9aa3b2" }}>
        No API key. Free to create.
      </div>
    </div>,
    { ...size },
  );
}
