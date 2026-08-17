import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { wantsAnswerMarkdown } from "@/lib/answer-document";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.endsWith(".md") || pathname.endsWith("/md")) {
    return NextResponse.next();
  }

  if (wantsAnswerMarkdown(request.headers.get("accept"))) {
    const url = request.nextUrl.clone();
    url.pathname = `${pathname}/md`;
    return NextResponse.rewrite(url);
  }

  const markdownPath = `${pathname}.md${search}`;
  const response = NextResponse.next();
  response.headers.set(
    "Link",
    `<${markdownPath}>; rel="alternate"; type="text/markdown"`,
  );
  return response;
}

export const config = {
  matcher: ["/s/:sessionId", "/s/:sessionId/manage"],
};
