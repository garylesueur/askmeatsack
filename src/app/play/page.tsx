import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KerryPlay } from "./kerry-play";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Playground — leftover questions",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlayPage() {
  if (process.env.VERCEL_ENV === "production") {
    notFound();
  }

  return <KerryPlay />;
}
