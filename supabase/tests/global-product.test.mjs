import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const { formatMoney, CURRENCIES } = await import('../../src/lib/global/currency.ts');
const { localDateTimeToUtc, dayBoundsUtc, dateOnly, utcInstant, isTimezone } = await import('../../src/lib/global/timezone.ts');
const { DEFAULT_USER_CONTEXT, parseUserContext, displayContext } = await import('../../src/lib/global/context.ts');
const { formatDateOnly, formatInstant } = await import('../../src/lib/global/formatting.ts');
const { commercialPrice, PRICING_CATALOG, draftMonthlyMajor } = await import('../../src/lib/billing/pricing-catalog.ts');
const { transitionBilling } = await import('../../src/lib/billing/state-machine.ts');
const { getBillingProviderStatus } = await import('../../src/lib/billing/provider.ts');
const { entitlementSnapshot } = await import('../../src/lib/billing/entitlements/index.ts');
const { requireSameOrigin, readSmallJson } = await import('../../src/lib/privacy/request.ts');
const { resolveTheme, parseTheme } = await import('../../src/lib/theme/theme.ts');
const { riskForAction } = await import('../../src/lib/intelligence/intent.ts');
const { executeIntelligenceAction } = await import('../../src/lib/intelligence/actions.ts');
const { readMemory } = await import('../../src/lib/intelligence/memory.ts');
const source = p => readFileSync(new URL('../../'+p, import.meta.url), 'utf8');

for (const [zone, expected] of [['Africa/Porto-Novo','2026-09-22T11:00:00Z'],['Europe/Paris','2026-09-22T10:00:00Z'],['America/New_York','2026-09-22T16:00:00Z'],['Asia/Tokyo','2026-09-22T03:00:00Z']]) {
  test(`${zone}: civil input becomes explicit UTC`, () => assert.equal(localDateTimeToUtc('2026-09-22T12:00', zone), expected));
}
for (const [zone,date,hours] of [['Europe/Paris','2026-03-29',23],['Europe/Paris','2026-10-25',25],['America/New_York','2026-03-08',23],['America/New_York','2026-11-01',25],['Africa/Porto-Novo','2026-03-29',24],['Asia/Tokyo','2026-11-01',24]]) {
  test(`${zone} ${date} has ${hours} hours, not a forced 24`, () => { const b = dayBoundsUtc(date,zone); assert.equal((Date.parse(b.end)-Date.parse(b.start))/3600000,hours); });
}
for (const [zone,date] of [['Europe/Paris','2026-03-29T02:30'],['Europe/Paris','2026-10-25T02:30'],['America/New_York','2026-03-08T02:30'],['America/New_York','2026-11-01T01:30']]) {
  test(`reject DST ambiguous/nonexistent ${zone} ${date}`, () => assert.throws(() => localDateTimeToUtc(date,zone)));
}
test('explicit overlap disambiguation differs by one hour', () => assert.equal(Date.parse(localDateTimeToUtc('2026-11-01T01:30','America/New_York','later'))-Date.parse(localDateTimeToUtc('2026-11-01T01:30','America/New_York','earlier')),3600000));
test('invalid date/time/zone rejected; date-only is not an instant', () => {
  for (const date of ['2026-02-30','2026-09-22T00:00Z','not a date']) assert.throws(() => dateOnly(date));
  assert.throws(() => utcInstant('2026-09-22T12:00')); assert.throws(() => utcInstant('2026-09-22'));
  assert.equal(isTimezone('Invalid/Place'), false); assert.equal(isTimezone('+01:00'),false);
  assert.equal(utcInstant('2026-09-22T12:00:00+01:00'),'2026-09-22T11:00:00Z');
});
test('civil date formatting never shifts day with travel timezone', () => {
  assert.equal(formatDateOnly('2026-09-22',{locale:'en-US',dateFormat:'iso'}),'2026-09-22');
  assert.match(formatDateOnly('2026-09-22',{locale:'en-US',dateFormat:'locale'}),/Sep 22, 2026/);
  assert.match(formatInstant('2026-09-22T00:00:00Z',{locale:'en-US',timezone:'America/New_York'}),/Sep 21/);
});
for (const currency of Object.keys(CURRENCIES)) test(`${currency}: exact minor-unit exponent`, () => {
  const expected = new Intl.NumberFormat('fr-FR',{style:'currency',currency,minimumFractionDigits:CURRENCIES[currency],maximumFractionDigits:CURRENCIES[currency]}).format(12345 / 10**CURRENCIES[currency]);
  assert.equal(formatMoney({amountMinor:12345,currency},'fr-FR'),expected);
});
test('money refuses unsafe integer and unsupported currency', () => {
  for (const amountMinor of [0.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) assert.throws(() => formatMoney({amountMinor,currency:'USD'},'en-US'));
  assert.throws(() => formatMoney({amountMinor:1,currency:'ZZZ'},'en-US'));
});
test('travel leaves immutable workspace legal region/currency unchanged', () => {
  const ws = Object.freeze({workspaceCountry:'BJ',workspaceLocale:'fr-BJ',workspaceTimezone:'Africa/Porto-Novo',workspaceCurrency:'XOF'});
  const value = displayContext({...DEFAULT_USER_CONTEXT,country:'BJ'},ws,'Asia/Tokyo');
  assert.deepEqual(value.workspace,ws); assert.equal(value.user.timezone,'Asia/Tokyo'); assert.equal(value.workspace.workspaceCountry,'BJ');
  assert.throws(() => parseUserContext({...DEFAULT_USER_CONTEXT,country:'ZZ'}));
  assert.deepEqual(parseUserContext({...DEFAULT_USER_CONTEXT,workspaceCountry:'US'}),DEFAULT_USER_CONTEXT);
  assert.throws(() => parseUserContext({...DEFAULT_USER_CONTEXT,weekStart:7}));
});
test('draft/FX/expired/ambiguous prices never become checkout offers', () => {
  assert.equal(commercialPrice('PRO','USD','stripe'),null);
  const price = {...PRICING_CATALOG[0], approved:true,tax:'inclusive',provider:'stripe',providerPriceId:'local-fixture-price'};
  assert.equal(commercialPrice('PRO','USD','stripe',new Date('2026-09-23'),null,[price])?.amountMinor,1900);
  assert.equal(commercialPrice('PRO','XOF','stripe',new Date('2026-09-23'),null,[price]),null);
  assert.equal(commercialPrice('PRO','USD','stripe',new Date('2026-09-23'),null,[price,price]),null);
  assert.equal(commercialPrice('PRO','USD','stripe',new Date('2026-09-23'),null,[{...price,effectiveUntil:'2026-09-22T00:00:00Z'}]),null);
  assert.equal(commercialPrice('PRO','USD','stripe',new Date('2026-09-23'),null,[price],'year'),null);
});
test('frontend return URL cannot activate subscription', () => {
  assert.throws(() => transitionBilling('PAYMENT_PENDING','payment_confirmed','browser'));
  assert.throws(() => transitionBilling('PAYMENT_PENDING','payment_confirmed','internal'));
  assert.equal(transitionBilling('PAYMENT_PENDING','payment_confirmed','server_verified_provider'),'ACTIVE');
  assert.throws(() => transitionBilling('FREE','payment_confirmed','server_verified_provider'));
  assert.equal(getBillingProviderStatus().available,false);
  assert.equal(entitlementSnapshot({plan:'PRO',status:'past_due'}).plan,'FREE');
  assert.equal(entitlementSnapshot(null).features.document_analysis,false);
});
test('all mutation types need confirmation before any database call', async () => {
  for (const action of ['create_task','create_project','create_goal','update_task','update_project','update_goal','complete_task','move_task','delete_task','delete_project','delete_goal']) {
    assert.equal(riskForAction(action),action.startsWith('create_')?'medium':'high');
    await assert.rejects(executeIntelligenceAction({from(){throw new Error('DB must not run');}},'workspace','user',action,{}),/Confirmation is required/);
  }
});
test('privacy CSRF rejects cross-origin, opaque and missing origin', () => {
  for (const origin of ['https://evil.invalid','null','']) assert.throws(() => requireSameOrigin(new Request('https://nexus.invalid/api/settings/privacy',{headers:origin?{origin}:{}})));
  assert.doesNotThrow(() => requireSameOrigin(new Request('https://nexus.invalid/api/settings/privacy',{headers:{origin:'https://nexus.invalid'}})));
  assert.throws(() => requireSameOrigin(new Request('https://nexus.invalid/api/settings/privacy',{headers:{origin:'https://nexus.invalid','sec-fetch-site':'cross-site'}})));
});
test('bounded JSON reader rejects oversized bodies, arrays, invalid MIME', async () => {
  const req = (body,contentType='application/json') => new Request('https://nexus.invalid',{method:'POST',headers:{'Content-Type':contentType},body});
  assert.deepEqual(await readSmallJson(req('{"confirm":true}')),{confirm:true});
  for (const body of ['[]','null','"text"','{','{"big":"'+'a'.repeat(5000)+'"}']) await assert.rejects(readSmallJson(req(body)));
  await assert.rejects(readSmallJson(req('{}','text/plain')));
});
test('theme resolves dark/light/system without claiming UI translation', () => {
  assert.equal(resolveTheme('system',true),'dark'); assert.equal(resolveTheme('system',false),'light');
  assert.equal(resolveTheme('light',true),'light'); assert.equal(parseTheme('unknown'),'dark');
});
test('inactive memory is not included in a new AI prompt even before physical purge', async () => {
  const chain = { select(){return this},eq(){return this},maybeSingle(){return {data:{state:{},preferences:[],updated_at:'2020-01-01T00:00:00Z'},error:null}} };
  assert.equal(await readMemory({from(){return chain}},'workspace','user'),null);
});
test('source boundary: legacy memory not restored; privacy export is no-store and own-workspace scoped', () => {
  const ui = source('src/components/intelligence/intelligence-ask.tsx');
  assert.ok(!ui.includes('localStorage.getItem')); assert.ok(!ui.includes('localStorage.setItem')); assert.ok(ui.includes('localStorage.removeItem'));
  assert.ok(!source('src/app/api/intelligence/query/route.ts').includes('body.memory'));
  const route = source('src/app/api/settings/privacy/route.ts');
  assert.ok(route.includes('private, no-store')); assert.ok(route.includes('.eq("user_id", user.id).eq("workspace_id", workspaceId)')); assert.ok(route.includes('body.workspaceId !== workspaceId'));
});

test('public indicative prices use the draft catalog, not converted offers',()=>{ assert.equal(draftMonthlyMajor('FREE'),0); assert.equal(draftMonthlyMajor('PRO'),19); assert.equal(draftMonthlyMajor('TEAM'),49); });
test('origin control accepts browser Host behind internal Next URL, not arbitrary forwarded host',()=>{
 assert.doesNotThrow(()=>requireSameOrigin(new Request('http://internal:3000/api/settings/privacy',{headers:{origin:'https://3000-preview.e2b.app',host:'3000-preview.e2b.app'}})));
 assert.throws(()=>requireSameOrigin(new Request('http://internal:3000/api/settings/privacy',{headers:{origin:'https://evil.invalid',host:'3000-preview.e2b.app','x-forwarded-host':'evil.invalid'}})));
});
