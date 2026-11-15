const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { randomUUID, webcrypto } = require('node:crypto');

const source = fs.readFileSync(path.join(__dirname, '../cloudflare/agency-paymob-usd-worker.js'), 'utf8');
const origin = 'https://agency.rawj.pro';
const valid = { firstName: 'Audit', lastName: 'Customer', email: 'audit@example.invalid', phone: '+201000000000' };
const env = {
  PAYMOB_SECRET_KEY: 'test-only-private-server-value',
  PAYMOB_PUBLIC_KEY: 'test-only-public-value',
  PAYMOB_HMAC_SECRET: 'test-only-hmac-value',
  PAYMOB_INTEGRATION_ID: '123'
};

function makeWorker(vendor, platform = {}) {
  const calls = [];
  const logs = [];
  const sandbox = {
    module: { exports: {} }, URL, Response, TextEncoder, TextDecoder, Uint8Array, AbortSignal,
    crypto: { subtle: webcrypto.subtle, randomUUID },
    console: { info: value => logs.push(value), warn: value => logs.push(value), error: value => logs.push(value) },
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body), signal: options.signal });
      return vendor ? vendor(url, options) : new Response(JSON.stringify({ client_secret: 'test-only-checkout-token' }), { status: 201 });
    },
    ...platform
  };
  vm.runInNewContext(source.replace('export default {', 'module.exports = {'), sandbox, { filename: 'agency-paymob-usd-worker.js' });
  return { worker: sandbox.module.exports, calls, logs };
}

function request(payload = valid, options = {}) {
  return new Request('https://worker.example' + (options.path || '/intention/usd'), {
    method: 'POST',
    headers: { Origin: options.origin || origin, 'Content-Type': 'application/json', ...options.headers },
    body: options.rawBody === undefined ? JSON.stringify(payload) : options.rawBody
  });
}

test('checkout uses server-owned USD and EGP offers even when the browser tampers with the price', async () => {
  for (const [route, amount, currency] of [['/intention/usd', 20000, 'USD'], ['/intention/egp', 1000000, 'EGP']]) {
    const { worker, calls } = makeWorker();
    const response = await worker.fetch(request({ ...valid, amount: 1, currency: 'XXX' }, { path: route }), env);
    assert.equal(response.status, 201);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.amount, amount);
    assert.equal(calls[0].body.currency, currency);
    assert.equal(calls[0].body.items[0].amount, amount);
    assert.ok(calls[0].signal);
    assert.equal((await response.text()).includes(env.PAYMOB_SECRET_KEY), false);
  }
});

test('checkout rejects an unapproved Origin before a vendor request', async () => {
  const { worker, calls } = makeWorker();
  const response = await worker.fetch(request(valid, { origin: 'https://other.example' }), env);
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test('checkout fails closed when required merchant or callback configuration is missing', async () => {
  for (const name of ['PAYMOB_SECRET_KEY', 'PAYMOB_PUBLIC_KEY', 'PAYMOB_HMAC_SECRET', 'PAYMOB_INTEGRATION_ID']) {
    const { worker, calls } = makeWorker();
    const response = await worker.fetch(request(), { ...env, [name]: '' });
    assert.equal(response.status, 503, name);
    assert.equal(calls.length, 0);
    assert.deepEqual(await response.json(), { error: 'Checkout is temporarily unavailable' });
  }
});

test('checkout rejects invalid Integration IDs without calling Paymob', async () => {
  for (const integration of ['NaN', '-1', '0', '123.5', '9007199254740992']) {
    const { worker, calls } = makeWorker();
    const response = await worker.fetch(request(), { ...env, PAYMOB_INTEGRATION_ID: integration });
    assert.equal(response.status, 503, integration);
    assert.equal(calls.length, 0);
  }
});

test('checkout rejects JSON null, arrays, primitives and non-string customer fields', async () => {
  for (const input of [null, [], 'customer', 123, { ...valid, firstName: {} }, { ...valid, phone: 201000000000 }]) {
    const { worker, calls } = makeWorker();
    const response = await worker.fetch(request(input), env);
    assert.equal(response.status, 400, JSON.stringify(input));
    assert.equal(calls.length, 0);
  }
});

test('checkout validates field bounds, control characters, email and international phone syntax', async () => {
  const invalid = [
    { firstName: 'A' }, { lastName: 'A'.repeat(81) }, { firstName: 'Audit\nName' },
    { email: 'invalid' }, { email: 'x @example.com' }, { email: 'a'.repeat(161) },
    { phone: '+123' }, { phone: '+1234567890123456' }, { phone: '+20letters10000000' }
  ];
  for (const fields of invalid) {
    const { worker, calls } = makeWorker();
    const response = await worker.fetch(request({ ...valid, ...fields }), env);
    assert.equal(response.status, 400, JSON.stringify(fields));
    assert.equal(calls.length, 0);
  }
});

test('checkout accepts bounded Unicode customer names and common international phone formatting', async () => {
  const { worker, calls } = makeWorker();
  const response = await worker.fetch(request({ ...valid, firstName: 'أحمد', lastName: 'محمد', phone: '+20 (100) 000-0000' }), env);
  assert.equal(response.status, 201);
  assert.equal(calls[0].body.billing_data.first_name, 'أحمد');
});

test('checkout rejects malformed JSON and non-JSON content types', async () => {
  for (const [options, status] of [[{ rawBody: '{' }, 400], [{ headers: { 'Content-Type': 'text/plain' } }, 415]]) {
    const { worker, calls } = makeWorker();
    const response = await worker.fetch(request(valid, options), env);
    assert.equal(response.status, status);
    assert.equal(calls.length, 0);
  }
});

test('checkout enforces the byte limit using the stream even with no or misleading Content-Length', async () => {
  for (const headers of [{}, { 'Content-Length': '100' }]) {
    const { worker, calls } = makeWorker();
    const response = await worker.fetch(request({ ...valid, padding: 'x'.repeat(9000) }, { headers }), env);
    assert.equal(response.status, 413);
    assert.equal(calls.length, 0);
  }
});

test('checkout rejects declared oversized requests before reading or calling Paymob', async () => {
  const { worker, calls } = makeWorker();
  const response = await worker.fetch(request(valid, { headers: { 'Content-Length': '999999' } }), env);
  assert.equal(response.status, 413);
  assert.equal(calls.length, 0);
});

test('Paymob errors remain generic and vendor diagnostic data is never reflected or logged', async () => {
  const { worker, logs } = makeWorker(() => new Response(JSON.stringify({ detail: env.PAYMOB_SECRET_KEY, stack: 'private stack and customer details' }), { status: 400 }));
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'Unable to create checkout. Please try again later.' });
  assert.equal(JSON.stringify(logs).includes(env.PAYMOB_SECRET_KEY), false);
  assert.equal(JSON.stringify(logs).includes('private stack'), false);
});

test('upstream timeout returns a generic failure through the configured abort signal', async () => {
  let requestedTimeout;
  const { worker } = makeWorker((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('private timeout diagnostic')), { once: true });
  }), { AbortSignal: { timeout: milliseconds => {
    requestedTimeout = milliseconds;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);
    return controller.signal;
  } } });
  const response = await worker.fetch(request(), env);
  assert.equal(requestedTimeout, 15000);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'Unable to reach Paymob' });
});

test('malformed successful vendor replies do not produce a checkout URL', async () => {
  for (const result of [null, {}, { client_secret: 123 }]) {
    const { worker } = makeWorker(() => new Response(JSON.stringify(result), { status: 201 }));
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 502);
  }
});

test('callback parsing is bounded and rejects a malformed callback body', async () => {
  for (const [payload, status] of [[null, 400], [{ padding: 'x'.repeat(300000) }, 413]]) {
    const { worker, calls } = makeWorker();
    const response = await worker.fetch(request(payload, { path: '/callbacks/transaction-processed' }), env);
    assert.equal(response.status, status);
    assert.equal(calls.length, 0);
  }
});

test('forged callback HMAC cannot trigger a verified payment event', async () => {
  const { worker, calls, logs } = makeWorker();
  const req = new Request('https://worker.example/callbacks/transaction-processed?hmac=' + '0'.repeat(128), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'TRANSACTION', obj: { id: 1, amount_cents: 20000, currency: 'USD' } })
  });
  const response = await worker.fetch(req, env);
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
  assert.equal(logs.length, 0);
});

test('untrusted return parameters are HTML-escaped even without a valid HMAC', async () => {
  const { worker, calls } = makeWorker();
  const url = new URL('https://worker.example/callbacks/transaction-response');
  url.searchParams.set('id', '<img src=x onerror=alert(1)>');
  url.searchParams.set('currency', '<script>alert(1)</script>');
  const response = await worker.fetch(new Request(url), env);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('تعذر التحقق من النتيجة'));
  assert.equal(calls.length, 0);
});
