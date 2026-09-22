import { requireUser } from "@/lib/auth";
import { PrivacySettings } from "@/components/privacy-settings";
import Link from "next/link";
export default async function PrivacyPage() {
  await requireUser();
  return <div className="mx-auto max-w-3xl space-y-5"><Link href="/settings" className="text-text-secondary underline">Back to settings</Link><h1 className="text-2xl font-medium">Privacy & data controls</h1><p className="text-text-secondary">See what you can control now, and what still needs an operator.</p><PrivacySettings /></div>;
}
