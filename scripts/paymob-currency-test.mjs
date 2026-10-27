import { writeFile } from 'node:fs/promises';

const secretKey = process.env.PAYMOB_TEST_SECRET_KEY?.trim();
const publicKey = process.env.PAYMOB_TEST_PUBLIC_KEY?.trim();
const integrationId = Number(process.env.PAYMOB_TEST_INTEGRATION_ID);
const amount = Number(process.env.PAYMOB_TEST_AMOUNT || 200);
const currency = String(process.env.PAYMOB_TEST_CURRENCY || 'USD').toUpperCase();

if (!secretKey || !publicKey || !Number.isInteger(integrationId) || !(amount > 0)) {
    throw new Error('Missing or invalid Paymob test credentials');
}

const body = {
    amount: Math.round(amount * 100),
    currency,
    payment_methods: [integrationId],
    special_reference: `agency-currency-test-${Date.now()}`,
    expiration: 3600,
    notification_url: 'https://agency.rawj.pro/checkout.html',
    redirection_url: 'https://agency.rawj.pro/checkout.html',
    items: [{
        name: 'Campaign management - test order',
        amount: Math.round(amount * 100),
        description: 'Paymob international currency enablement test',
        quantity: 1
    }],
    billing_data: {
        first_name: 'RAWJ',
        last_name: 'PRO',
        email: 'info@rawj.pro',
        phone_number: '+201050845080',
        apartment: 'NA',
        floor: 'NA',
        street: 'Maadi',
        building: 'NA',
        city: 'Cairo',
        country: 'EG',
        state: 'Cairo',
        postal_code: 'NA'
    }
};

let response;
let payload;
try {
    response = await fetch('https://accept.paymob.com/v1/intention/', {
        method: 'POST',
        headers: {
            Authorization: `Token ${secretKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    payload = await response.json().catch(() => null);
} catch (error) {
    payload = { detail: error instanceof Error ? error.message : String(error) };
    response = { ok: false, status: 0 };
}

const detail = payload && typeof payload === 'object'
    ? payload.detail ?? payload.message ?? payload.error
    : payload;
const message = response.ok
    ? 'Paymob accepted the USD test intention.'
    : `Paymob API error (${response.status}): ${typeof detail === 'string' ? detail : JSON.stringify(detail ?? payload)}`;
const result = {
    ok: response.ok,
    mode: 'Test',
    amount,
    currency,
    integrationId,
    httpStatus: response.status,
    testedAt: new Date().toISOString(),
    message
};

await writeFile('paymob-test-result.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
