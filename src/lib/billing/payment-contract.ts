import type { Currency } from "../global/currency";
export type InternalPaymentKind = "payment.succeeded" | "payment.failed" | "subscription.created" | "subscription.updated" | "subscription.cancelled" | "invoice.paid" | "invoice.failed";
export type PaymentEvent = {
  provider: "stripe" | "kkiapay" | "fedapay"; eventId: string; kind: InternalPaymentKind;
  providerObjectId: string; transactionId: string | null; subscriptionId: string | null;
  amountMinor: number | null; currency: string | null; occurredAt: string; liveMode: boolean;
};
export type SubscriptionSnapshot = { id: string; customerId: string; status: string; cancelAtPeriodEnd: boolean };
export type CustomerInput = { email: string; workspaceId: string; idempotencyKey: string };
export type SubscriptionInput = { customerId: string; priceId: string; transactionId: string; idempotencyKey: string };
export type RefundInput = { paymentId: string; amountMinor: number; currency: Currency; idempotencyKey: string };
/** Server transports only. None of these methods is an entitlement grant. */
export interface InternationalPaymentProvider {
  readonly id: "stripe" | "kkiapay" | "fedapay";
  createCustomer(input: CustomerInput): Promise<{ id: string }>;
  createCheckout(input: SubscriptionInput & { successUrl: string; cancelUrl: string }): Promise<{ id: string; url: string }>;
  createSubscription(input: SubscriptionInput): Promise<SubscriptionSnapshot>;
  cancelSubscription(id: string, idempotencyKey: string): Promise<SubscriptionSnapshot>;
  updateSubscription(id: string, input: { itemId: string; priceId: string; idempotencyKey: string }): Promise<SubscriptionSnapshot>;
  getSubscription(id: string): Promise<SubscriptionSnapshot>;
  getInvoice(id: string): Promise<{ id: string; status: string | null; currency: string; amountMinor: number }>;
  refund(input: RefundInput): Promise<{ id: string; status: string | null }>;
  verifyWebhook(rawBody: Uint8Array, headers: Headers): Promise<PaymentEvent | null>;
}
