const ALLOWED_ORIGIN = 'https://agency.rawj.pro';
const WORKER_ORIGIN = 'https://agency-paymob-usd.moodyads.workers.dev';
const TRANSACTION_PROCESSED_URL = `${WORKER_ORIGIN}/callbacks/transaction-processed`;
const TRANSACTION_RESPONSE_URL = `${WORKER_ORIGIN}/callbacks/transaction-response`;
const OFFERS = {
  '/intention': { code: 'usd', amount: 20000, currency: 'USD', country: 'US' },
  '/intention/usd': { code: 'usd', amount: 20000, currency: 'USD', country: 'US' },
  '/intention/egp': { code: 'egp', amount: 1000000, currency: 'EGP', country: 'EG' }
};

const TRANSACTION_HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success'
];

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    }
  });
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
}

function clean(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function nestedValue(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function transactionHmacSource(transaction) {
  return TRANSACTION_HMAC_FIELDS.map((field) => String(nestedValue(transaction, field) ?? '')).join('');
}

function responseHmacSource(params) {
  const values = {
    amount_cents: params.get('amount_cents'),
    created_at: params.get('created_at'),
    currency: params.get('currency'),
    error_occured: params.get('error_occured'),
    has_parent_transaction: params.get('has_parent_transaction'),
    id: params.get('id'),
    integration_id: params.get('integration_id'),
    is_3d_secure: params.get('is_3d_secure'),
    is_auth: params.get('is_auth'),
    is_capture: params.get('is_capture'),
    is_refunded: params.get('is_refunded'),
    is_standalone_payment: params.get('is_standalone_payment'),
    is_voided: params.get('is_voided'),
    order: params.get('order') ?? params.get('order_id'),
    owner: params.get('owner'),
    pending: params.get('pending'),
    source_data_pan: params.get('source_data.pan'),
    source_data_sub_type: params.get('source_data.sub_type'),
    source_data_type: params.get('source_data.type'),
    success: params.get('success')
  };

  return [
    values.amount_cents,
    values.created_at,
    values.currency,
    values.error_occured,
    values.has_parent_transaction,
    values.id,
    values.integration_id,
    values.is_3d_secure,
    values.is_auth,
    values.is_capture,
    values.is_refunded,
    values.is_standalone_payment,
    values.is_voided,
    values.order,
    values.owner,
    values.pending,
    values.source_data_pan,
    values.source_data_sub_type,
    values.source_data_type,
    values.success
  ].map((value) => String(value ?? '')).join('');
}

async function hmacSha512Hex(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function validHmac(source, receivedHmac, secret) {
  if (!secret || !receivedHmac || !/^[a-f0-9]{128}$/i.test(receivedHmac)) return false;
  const expectedHmac = await hmacSha512Hex(source, secret);
  return constantTimeEqual(expectedHmac.toLowerCase(), receivedHmac.toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function paymentResultPage(params, verified) {
  const success = verified && params.get('success') === 'true' && params.get('pending') !== 'true';
  const pending = verified && params.get('pending') === 'true';
  const status = !verified ? 'unverified' : success ? 'success' : pending ? 'pending' : 'failed';
  const content = {
    success: {
      title: 'تم الدفع بنجاح',
      message: 'تم استلام عملية الدفع بنجاح. سيتواصل معك فريق RAWJ PRO لتأكيد بدء الخدمة.',
      symbol: '✓'
    },
    pending: {
      title: 'جاري تأكيد العملية',
      message: 'عملية الدفع ما زالت قيد المعالجة. لا تُعد المحاولة الآن، وسنتواصل معك بعد وصول النتيجة النهائية.',
      symbol: '…'
    },
    failed: {
      title: 'لم تكتمل عملية الدفع',
      message: 'لم يتم تحصيل المبلغ. يمكنك العودة إلى صفحة الدفع والمحاولة مرة أخرى أو التواصل معنا للمساعدة.',
      symbol: '×'
    },
    unverified: {
      title: 'تعذر التحقق من النتيجة',
      message: 'لم نتمكن من التحقق من بيانات الرجوع. لن نعتبر العملية مدفوعة، ويرجى التواصل معنا قبل إعادة المحاولة.',
      symbol: '!'
    }
  }[status];
  const transactionId = escapeHtml(params.get('id') || 'غير متاح');
  const rawAmountCents = params.get('amount_cents');
  const amountCents = rawAmountCents === null ? Number.NaN : Number(rawAmountCents);
  const currency = escapeHtml(params.get('currency') || '');
  const amount = Number.isFinite(amountCents) ? escapeHtml((amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })) : 'غير متاح';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${content.title} | RAWJ PRO</title>
  <meta name="robots" content="noindex,nofollow">
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7f8;color:#14213d;font-family:Arial,"Tahoma",sans-serif}.card{width:min(620px,100%);padding:38px 30px;border:1px solid #dfe5e8;border-radius:8px;background:#fff;box-shadow:0 18px 50px rgba(20,33,61,.1);text-align:center}.mark{width:64px;height:64px;margin:0 auto 20px;display:grid;place-items:center;border-radius:50%;background:${success ? '#e7f7ef' : pending ? '#fff4d8' : '#fdecec'};color:${success ? '#137a4b' : pending ? '#9a6800' : '#a62e2e'};font-size:36px;font-weight:700}h1{margin:0 0 12px;font-size:clamp(1.7rem,4vw,2.3rem)}p{margin:0 auto 24px;max-width:520px;color:#5e6875;line-height:1.8}.details{margin:0 auto 28px;padding:18px;border:1px solid #e4e9ec;border-radius:6px;background:#f9fbfb;text-align:right}.row{display:flex;justify-content:space-between;gap:18px;padding:7px 0}.row span{color:#69737f}.row strong{direction:ltr}.actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}a{display:inline-flex;min-height:44px;align-items:center;justify-content:center;padding:0 20px;border-radius:6px;font-weight:700;text-decoration:none}.primary{background:#087f5b;color:#fff}.secondary{border:1px solid #cfd7dc;color:#14213d}</style>
</head>
<body>
  <main class="card">
    <div class="mark" aria-hidden="true">${content.symbol}</div>
    <h1>${content.title}</h1>
    <p>${content.message}</p>
    <div class="details">
      <div class="row"><span>رقم العملية</span><strong>${transactionId}</strong></div>
      <div class="row"><span>المبلغ</span><strong>${amount} ${currency}</strong></div>
    </div>
    <div class="actions">
      <a class="primary" href="https://agency.rawj.pro/">العودة إلى الموقع</a>
      ${success ? '' : '<a class="secondary" href="https://agency.rawj.pro/checkout.html">العودة إلى الدفع</a>'}
    </div>
  </main>
</body>
</html>`;
}

async function handleProcessedCallback(request, env, url) {
  if (!env.PAYMOB_HMAC_SECRET) {
    return json({ error: 'Callback verification is not configured' }, 503, ALLOWED_ORIGIN);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid callback body' }, 400, ALLOWED_ORIGIN);
  }

  if (payload?.type !== 'TRANSACTION' || !payload.obj) {
    return json({ received: true, processed: false }, 202, ALLOWED_ORIGIN);
  }

  const verified = await validHmac(
    transactionHmacSource(payload.obj),
    url.searchParams.get('hmac'),
    env.PAYMOB_HMAC_SECRET
  );
  if (!verified) return json({ error: 'Invalid HMAC signature' }, 401, ALLOWED_ORIGIN);

  console.info(JSON.stringify({
    event: 'paymob.transaction',
    transactionId: payload.obj.id,
    orderId: payload.obj.order?.id,
    merchantReference: payload.obj.order?.merchant_order_id,
    success: payload.obj.success,
    pending: payload.obj.pending,
    amountCents: payload.obj.amount_cents,
    currency: payload.obj.currency
  }));
  return json({ received: true, verified: true }, 200, ALLOWED_ORIGIN);
}

async function handleResponseCallback(url, env) {
  const verified = Boolean(env.PAYMOB_HMAC_SECRET) && await validHmac(
    responseHmacSource(url.searchParams),
    url.searchParams.get('hmac'),
    env.PAYMOB_HMAC_SECRET
  );
  return new Response(paymentResultPage(url.searchParams, verified), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const offer = OFFERS[url.pathname];

    if (request.method === 'POST' && url.pathname === '/callbacks/transaction-processed') {
      return handleProcessedCallback(request, env, url);
    }
    if (request.method === 'GET' && url.pathname === '/callbacks/transaction-response') {
      return handleResponseCallback(url, env);
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'agency-paymob' }, 200, ALLOWED_ORIGIN);
    }

    if (request.method === 'OPTIONS') {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST' || !offer) {
      return json({ error: 'Not found' }, 404, ALLOWED_ORIGIN);
    }
    if (origin !== ALLOWED_ORIGIN) {
      return json({ error: 'Origin not allowed' }, 403, ALLOWED_ORIGIN);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400, origin);
    }

    const firstName = clean(input.firstName, 80);
    const lastName = clean(input.lastName, 80);
    const email = clean(input.email, 160);
    const phone = clean(input.phone, 30);
    if (firstName.length < 2 || lastName.length < 2 || !email.includes('@') || phone.replace(/\D/g, '').length < 8) {
      return json({ error: 'Invalid customer details' }, 400, origin);
    }

    const amount = offer.amount;
    const body = {
      amount,
      currency: offer.currency,
      payment_methods: [Number(env.PAYMOB_INTEGRATION_ID)],
      special_reference: `agency-${offer.code}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      expiration: 3600,
      notification_url: TRANSACTION_PROCESSED_URL,
      redirection_url: TRANSACTION_RESPONSE_URL,
      items: [{
        name: 'Campaign management service',
        amount,
        description: 'One month campaign management service',
        quantity: 1
      }],
      billing_data: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phone,
        apartment: 'NA',
        floor: 'NA',
        street: 'NA',
        building: 'NA',
        city: 'NA',
        country: offer.country,
        state: 'NA',
        postal_code: 'NA'
      }
    };

    let paymobResponse;
    let paymobPayload;
    try {
      paymobResponse = await fetch('https://accept.paymob.com/v1/intention/', {
        method: 'POST',
        headers: {
          Authorization: `Token ${env.PAYMOB_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      paymobPayload = await paymobResponse.json().catch(() => ({}));
    } catch {
      return json({ error: 'Unable to reach Paymob' }, 502, origin);
    }

    if (!paymobResponse.ok) {
      const detail = paymobPayload.detail ?? paymobPayload.message ?? paymobPayload.error ?? paymobPayload;
      return json({ paymob: detail }, paymobResponse.status, origin);
    }

    if (!paymobPayload.client_secret) {
      return json({ error: 'Paymob did not return a checkout token' }, 502, origin);
    }

    const checkoutUrl = new URL('https://accept.paymob.com/unifiedcheckout/');
    checkoutUrl.searchParams.set('publicKey', env.PAYMOB_PUBLIC_KEY);
    checkoutUrl.searchParams.set('clientSecret', paymobPayload.client_secret);
    return json({ checkoutUrl: checkoutUrl.toString() }, 201, origin);
  }
};
