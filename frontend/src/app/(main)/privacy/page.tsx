import { redirect } from "next/navigation";

export default function PrivacyPage(): never {
  // Canonical privacy content lives at /about/privacy.
  redirect("/about/privacy");
}
