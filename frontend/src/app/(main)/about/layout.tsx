import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how UGM-AICare supports earlier mental health intervention for students through AI triage, reflective tools, and counselor-connected workflows.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About UGM-AICare",
    description:
      "Explore the student-first design, safety architecture, and research foundations behind UGM-AICare.",
    url: "/about",
    type: "website",
  },
  twitter: {
    title: "About UGM-AICare",
    description:
      "How UGM-AICare combines proactive AI support with campus mental health pathways.",
  },
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
