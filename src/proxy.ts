import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { wantsAnswerMarkdown } from "@/lib/answer-document";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.endsWith(".md") || pathname.endsWith("/md")) {
    return NextResponse.next();
  }

  let response: NextResponse;
  if (wantsAnswerMarkdown(request.headers.get("accept"))) {
    const url = request.nextUrl.clone();
    url.pathname = `${pathname}/md`;
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }

  const markdownPath = `${pathname}.md${search}`;
  response.headers.set(
    "Link",
    `<${markdownPath}>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"`,
  );
  response.headers.set("Vary", "Accept");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/s/:sessionId", "/s/:sessionId/manage"],
};
