import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
const COPY: Record<string, { title: string; message: string }> = {
  checkout: { title: "Checkout unavailable", message: "No payment has been initiated by this page. Merchant eligibility, approved prices and verified event processing are still required." },
  "payment-required": { title: "Payment may be required", message: "This URL does not establish a payment requirement. Review your actual workspace plan in billing. Paid checkout is not enabled." },
  "payment-pending": { title: "Payment confirmation not available", message: "No live payment status can be verified here. Do not pay again based on this page. Check billing and your provider receipt." },
  "payment-failed": { title: "Unable to confirm payment status", message: "This URL alone does not prove a payment failure or that no charge occurred. Check your provider receipt before retrying." },
  success: { title: "Payment not verified", message: "A return URL is not payment proof. This page never activates a paid plan. Only verified server-side records can change access." },
  cancel: { title: "Checkout return", message: "Returning here does not cancel a subscription or issue a refund. No cancellation was executed by this page." },
};
export default async function BillingStatePage({ params }: { params: Promise<{ status: string }> }) {
  await requireUser();
  const { status } = await params;
  const copy = Object.prototype.hasOwnProperty.call(COPY, status) ? COPY[status] : null;
  if (!copy) notFound();
  return <section className="mx-auto max-w-xl space-y-5 rounded-card border border-border-default bg-bg-surface p-6"><p className="text-small text-text-secondary">NEXUS · Billing</p><h1 className="text-2xl font-medium">{copy.title}</h1><p className="text-text-secondary">{copy.message}</p><div className="flex flex-wrap gap-5"><Link className="min-h-11 inline-flex items-center underline" href="/billing">Review workspace billing</Link><Link className="min-h-11 inline-flex items-center underline" href="/plans">Compare plans</Link></div></section>;
}
