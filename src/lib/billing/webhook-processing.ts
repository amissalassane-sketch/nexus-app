import type { PaymentEvent } from "./payment-contract";
/** An implementation must commit the event receipt and subscription update in ONE database transaction.
 * This boundary intentionally has no in-memory production implementation. */
export interface BillingEventStore {
  applyVerifiedEventAtomically(event: PaymentEvent): Promise<"applied" | "duplicate" | "uncorrelated" | "out_of_order">;
}
export async function processVerifiedPayment(event: PaymentEvent, store: BillingEventStore) {
  if (!event.eventId || !event.providerObjectId || !Number.isFinite(Date.parse(event.occurredAt))) throw new Error("INVALID_VERIFIED_EVENT");
  // The durable store must resolve null transactionId via the provider subscription/customer mapping.
  return store.applyVerifiedEventAtomically(event);
}
