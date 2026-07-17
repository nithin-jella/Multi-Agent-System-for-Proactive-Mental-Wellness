import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mental Health Resources",
  description:
    "Access guided self-help practices, crisis resources, and campus support pathways curated for UGM students.",
  alternates: {
    canonical: "/resources",
  },
  openGraph: {
    title: "UGM-AICare Resources",
    description:
      "Practical tools and support options, from quick grounding exercises to professional counseling pathways.",
    url: "/resources",
    type: "website",
  },
  twitter: {
    title: "UGM-AICare Resources",
    description:
      "Student-focused mental health resources, intervention guidance, and next steps for support.",
  },
};

export default function ResourcesLayout({ children }: { children: ReactNode }) {
  return children;
}
