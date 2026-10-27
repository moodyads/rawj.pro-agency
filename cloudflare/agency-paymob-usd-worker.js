const ALLOWED_ORIGIN = 'https://agency.rawj.pro';

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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST' || url.pathname !== '/intention') {
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

    const amount = 20000;
    const body = {
      amount,
      currency: 'USD',
      payment_methods: [Number(env.PAYMOB_INTEGRATION_ID)],
      special_reference: `agency-usd-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      expiration: 3600,
      redirection_url: 'https://agency.rawj.pro/checkout-usd.html',
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
        country: 'US',
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
