// SERVER TRANSPORT ONLY. Not selected by checkout routes until durable processing is installed.
import "server-only";
import Stripe from "stripe";
import type { CustomerInput, InternationalPaymentProvider, PaymentEvent, RefundInput, SubscriptionInput, SubscriptionSnapshot } from "../payment-contract";

function idempotency(key: string) {
  if (!key || key.length > 200 || !/^[a-zA-Z0-9:_-]+$/.test(key)) throw new Error("INVALID_IDEMPOTENCY_KEY");
  return { idempotencyKey: key };
}
function snapshot(s: Stripe.Subscription): SubscriptionSnapshot {
  return { id: s.id, customerId: typeof s.customer === "string" ? s.customer : s.customer.id, status: s.status, cancelAtPeriodEnd: s.cancel_at_period_end };
}
export class StripePaymentAdapter implements InternationalPaymentProvider {
  readonly id = "stripe" as const;
  private readonly client: Stripe;
  constructor(private readonly config: { secretKey: string; webhookSecret: string; siteOrigin: string; expectedLiveMode: boolean }, client?: Stripe) {
    if (!config.secretKey || !config.webhookSecret) throw new Error("STRIPE_NOT_CONFIGURED");
    const origin = new URL(config.siteOrigin);
    if (origin.protocol !== "https:" || origin.origin !== config.siteOrigin) throw new Error("INVALID_BILLING_ORIGIN");
    this.client = client ?? new Stripe(config.secretKey, { timeout: 10_000, maxNetworkRetries: 1 });
  }
  async createCustomer(input: CustomerInput) {
    const c = await this.client.customers.create({ email: input.email, metadata: { workspace_id: input.workspaceId } }, idempotency(input.idempotencyKey));
    return { id: c.id };
  }
  async createCheckout(input: SubscriptionInput & { successUrl: string; cancelUrl: string }) {
    for (const value of [input.successUrl, input.cancelUrl]) if (new URL(value).origin !== this.config.siteOrigin) throw new Error("INVALID_CHECKOUT_REDIRECT");
    const session = await this.client.checkout.sessions.create({ mode: "subscription", customer: input.customerId,
      line_items: [{ price: input.priceId, quantity: 1 }], success_url: input.successUrl, cancel_url: input.cancelUrl,
      client_reference_id: input.transactionId, metadata: { transaction_id: input.transactionId },
      subscription_data: { metadata: { transaction_id: input.transactionId } } }, idempotency(input.idempotencyKey));
    if (!session.url) throw new Error("CHECKOUT_URL_MISSING");
    return { id: session.id, url: session.url };
  }
  async createSubscription(input: SubscriptionInput) {
    return snapshot(await this.client.subscriptions.create({ customer: input.customerId, items: [{ price: input.priceId }], payment_behavior: "default_incomplete", metadata: { transaction_id: input.transactionId } }, idempotency(input.idempotencyKey)));
  }
  async cancelSubscription(id: string, key: string) {
    return snapshot(await this.client.subscriptions.update(id, { cancel_at_period_end: true }, idempotency(key)));
  }
  async updateSubscription(id: string, input: { itemId: string; priceId: string; idempotencyKey: string }) {
    // Do not grant an upgrade before payment. Prorations are explicitly invoiced.
    return snapshot(await this.client.subscriptions.update(id, { items: [{ id: input.itemId, price: input.priceId }], payment_behavior: "pending_if_incomplete", proration_behavior: "always_invoice" }, idempotency(input.idempotencyKey)));
  }
  async getSubscription(id: string) { return snapshot(await this.client.subscriptions.retrieve(id)); }
  async getInvoice(id: string) {
    const i = await this.client.invoices.retrieve(id);
    return { id: i.id, status: i.status, currency: i.currency.toUpperCase(), amountMinor: i.amount_due };
  }
  async refund(input: RefundInput) {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("INVALID_REFUND_AMOUNT");
    const payment = await this.client.paymentIntents.retrieve(input.paymentId);
    if (payment.currency.toUpperCase() !== input.currency || input.amountMinor > payment.amount_received) throw new Error("REFUND_PAYMENT_MISMATCH");
    const result = await this.client.refunds.create({ payment_intent: input.paymentId, amount: input.amountMinor }, idempotency(input.idempotencyKey));
    return { id: result.id, status: result.status };
  }
  async verifyWebhook(rawBody: Uint8Array, headers: Headers): Promise<PaymentEvent | null> {
    if (rawBody.byteLength > 1_048_576) throw new Error("WEBHOOK_TOO_LARGE");
    const signature = headers.get("stripe-signature");
    if (!signature) throw new Error("WEBHOOK_SIGNATURE_REQUIRED");
    // Official SDK verifies raw bytes, HMAC, multiple signatures and 5-minute age tolerance.
    const event = this.client.webhooks.constructEvent(Buffer.from(rawBody), signature, this.config.webhookSecret, 300);
    if (event.livemode !== this.config.expectedLiveMode) throw new Error("WEBHOOK_MODE_MISMATCH");
    const types: Record<string, PaymentEvent["kind"]> = {
      "payment_intent.succeeded": "payment.succeeded", "payment_intent.payment_failed": "payment.failed",
      "customer.subscription.created": "subscription.created", "customer.subscription.updated": "subscription.updated",
      "customer.subscription.deleted": "subscription.cancelled", "invoice.paid": "invoice.paid", "invoice.payment_failed": "invoice.failed",
    };
    const kind = types[event.type];
    if (!kind) return null; // checkout.session.completed is not treated as payment success.
    const object = event.data.object as unknown as Record<string, unknown>;
    if (typeof object.id !== "string" || !object.id || !Number.isSafeInteger(event.created)) throw new Error("INVALID_PROVIDER_EVENT");
    const parent = object.parent as { subscription_details?: { subscription?: string | { id: string }; metadata?: Record<string, unknown> } } | null;
    const details = parent?.subscription_details;
    const metadata = object.metadata as Record<string, unknown> | null;
    const transactionId = metadata?.transaction_id ?? details?.metadata?.transaction_id;
    const subscription = object.subscription ?? details?.subscription;
    const subscriptionId = typeof subscription === "string" ? subscription : subscription && typeof subscription === "object" && "id" in subscription && typeof subscription.id === "string" ? subscription.id : null;
    return { provider: "stripe", eventId: event.id, kind, providerObjectId: String(object.id),
      transactionId: typeof transactionId === "string" ? transactionId : null,
      subscriptionId: event.type.startsWith("customer.subscription.") ? String(object.id) : subscriptionId,
      amountMinor: typeof object.amount_received === "number" ? object.amount_received : typeof object.amount_paid === "number" ? object.amount_paid : null,
      currency: typeof object.currency === "string" ? object.currency.toUpperCase() : null,
      occurredAt: new Date(event.created * 1000).toISOString(), liveMode: event.livemode };
  }
}
