import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Wellness Activities",
  description:
    "Try interactive wellness activities designed to help with grounding, reflection, and emotional self-regulation.",
  alternates: {
    canonical: "/activities",
  },
  openGraph: {
    title: "UGM-AICare Wellness Activities",
    description:
      "Interactive exercises for daily mental wellness, integrated with UGM-AICare intervention support.",
    url: "/activities",
    type: "website",
  },
  twitter: {
    title: "UGM-AICare Wellness Activities",
    description:
      "Play therapeutic activities that support grounding, stress reduction, and healthier routines.",
  },
};

export default function ActivitiesLayout({ children }: { children: ReactNode }) {
  return children;
}
