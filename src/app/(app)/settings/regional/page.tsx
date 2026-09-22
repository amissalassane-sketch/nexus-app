import { requireUser } from "@/lib/auth";
import { RegionalSettings } from "@/components/regional-settings";
import Link from "next/link";
export default async function RegionalPage() {
  await requireUser();
  return <div className="mx-auto max-w-3xl space-y-5"><Link href="/settings" className="text-text-secondary underline">Back to settings</Link><h1 className="text-2xl font-medium">Language, region & appearance</h1><RegionalSettings /></div>;
}
