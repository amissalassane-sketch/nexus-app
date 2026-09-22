// Hermetic SDK contract tests only. Fixtures are NOT API responses from Stripe.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Stripe from 'stripe';
const { StripePaymentAdapter } = await import('../../src/lib/billing/adapters/stripe.ts');
const secret = 'fixture-hmac-secret-not-a-provider-credential';
const config = {secretKey:'fixture-transport-never-used-over-network',webhookSecret:secret,siteOrigin:'https://nexus.invalid',expectedLiveMode:false};
const adapter = new StripePaymentAdapter(config);
const encode = (type='payment_intent.succeeded',changes={}) => JSON.stringify({id:'evt_local_fixture',type,created:Math.floor(Date.now()/1000),livemode:false,data:{object:{id:'pi_local_fixture',amount_received:1900,currency:'usd',metadata:{transaction_id:'txn_local_fixture'}}},...changes});
function signature(payload,timestamp=Math.floor(Date.now()/1000)) { return new Headers({'stripe-signature':Stripe.webhooks.generateTestHeaderString({payload,secret,timestamp})}); }

test('official SDK verifies raw HMAC bytes, signed object normalizes without granting access', async () => {
  const payload=encode(); const result=await adapter.verifyWebhook(Buffer.from(payload),signature(payload));
  assert.equal(result.kind,'payment.succeeded'); assert.equal(result.transactionId,'txn_local_fixture'); assert.equal(result.amountMinor,1900); assert.equal(result.currency,'USD');
});
for (const [type,kind] of [['payment_intent.payment_failed','payment.failed'],['customer.subscription.created','subscription.created'],['customer.subscription.updated','subscription.updated'],['customer.subscription.deleted','subscription.cancelled'],['invoice.paid','invoice.paid'],['invoice.payment_failed','invoice.failed']]) test(`normalizes ${type}`,async()=>{const p=encode(type);assert.equal((await adapter.verifyWebhook(Buffer.from(p),signature(p))).kind,kind)});
test('altered body, missing/wrong/expired signature fail', async () => {
  const p=encode();
  await assert.rejects(adapter.verifyWebhook(Buffer.from(p+' '),signature(p)));
  await assert.rejects(adapter.verifyWebhook(Buffer.from(p),new Headers()),/SIGNATURE_REQUIRED/);
  await assert.rejects(adapter.verifyWebhook(Buffer.from(p),new Headers({'stripe-signature':'t=1,v1=bad'})));
  await assert.rejects(adapter.verifyWebhook(Buffer.from(p),signature(p,Math.floor(Date.now()/1000)-301)));
});
test('test/live mixing and oversized body fail; checkout completion is not payment proof',async()=>{
  let p=encode('payment_intent.succeeded',{livemode:true});await assert.rejects(adapter.verifyWebhook(Buffer.from(p),signature(p)),/MODE_MISMATCH/);
  await assert.rejects(adapter.verifyWebhook(new Uint8Array(1048577),new Headers()),/TOO_LARGE/);
  p=encode('checkout.session.completed');assert.equal(await adapter.verifyWebhook(Buffer.from(p),signature(p)),null);
});
test('new Stripe invoice parent subscription and correlation supported',async()=>{
 const p=encode('invoice.paid',{data:{object:{id:'invoice_fixture',currency:'usd',amount_paid:1900,parent:{subscription_details:{subscription:{id:'sub_fixture'},metadata:{transaction_id:'txn_fixture'}}}}}});
 const result=await adapter.verifyWebhook(Buffer.from(p),signature(p));assert.equal(result.subscriptionId,'sub_fixture');assert.equal(result.transactionId,'txn_fixture');
});
test('checkout transport restricts redirects, sets metadata + idempotency, handles missing URL',async()=>{
 let captured;
 const fake={checkout:{sessions:{async create(body,options){captured={body,options};return{id:'checkout_fixture',url:'https://checkout.stripe.invalid/fixture'}}}}};
 const a=new StripePaymentAdapter(config,fake);
 const input={customerId:'customer_fixture',priceId:'price_fixture',transactionId:'txn_fixture',idempotencyKey:'fixture-1',successUrl:config.siteOrigin+'/billing/success',cancelUrl:config.siteOrigin+'/billing/cancel'};
 assert.equal((await a.createCheckout(input)).id,'checkout_fixture');assert.equal(captured.options.idempotencyKey,'fixture-1');assert.equal(captured.body.subscription_data.metadata.transaction_id,'txn_fixture');
 await assert.rejects(a.createCheckout({...input,successUrl:'https://evil.invalid/'}),/REDIRECT/);
 await assert.rejects(a.createCheckout({...input,idempotencyKey:''}),/IDEMPOTENCY/);
});
test('subscription transport creates incomplete and defers unpaid changes',async()=>{
 let body; const fixture={id:'sub_fixture',customer:'cust_fixture',status:'incomplete',cancel_at_period_end:false};
 const a=new StripePaymentAdapter(config,{subscriptions:{async create(v){body=v;return fixture},async update(id,v){body=v;return{...fixture,id}},async retrieve(){return fixture}}});
 await a.createSubscription({customerId:'cust_fixture',priceId:'price_fixture',transactionId:'txn_fixture',idempotencyKey:'fixture'});assert.equal(body.payment_behavior,'default_incomplete');
 await a.updateSubscription('sub_fixture',{itemId:'item_fixture',priceId:'price_fixture',idempotencyKey:'fixture'});assert.equal(body.payment_behavior,'pending_if_incomplete');
 await a.cancelSubscription('sub_fixture','fixture');assert.equal(body.cancel_at_period_end,true);
 assert.equal((await a.getSubscription('sub_fixture')).status,'incomplete');
});
test('refund checks currency and amount before sending a mutation',async()=>{
 let called=false;const a=new StripePaymentAdapter(config,{paymentIntents:{async retrieve(){return{currency:'usd',amount_received:1900}}},refunds:{async create(){called=true;return{id:'refund_fixture',status:'pending'}}}});
 const input={paymentId:'pi_fixture',amountMinor:1900,currency:'USD',idempotencyKey:'fixture'};
 for(const bad of [{...input,amountMinor:0},{...input,amountMinor:1901},{...input,currency:'XOF'}]) await assert.rejects(a.refund(bad));
 assert.equal(called,false);assert.equal((await a.refund(input)).status,'pending');
});
test('customer and invoice methods preserve workspace mapping and minor units',async()=>{
 let received;const a=new StripePaymentAdapter(config,{customers:{async create(body,options){received={body,options};return{id:'customer_fixture'}}},invoices:{async retrieve(){return{id:'invoice_fixture',status:'open',currency:'xof',amount_due:1000}}}});
 assert.equal((await a.createCustomer({email:'fixture@example.invalid',workspaceId:'workspace_fixture',idempotencyKey:'fixture'})).id,'customer_fixture');
 assert.equal(received.body.metadata.workspace_id,'workspace_fixture');assert.equal(received.options.idempotencyKey,'fixture');
 assert.deepEqual(await a.getInvoice('invoice_fixture'),{id:'invoice_fixture',status:'open',currency:'XOF',amountMinor:1000});
});
