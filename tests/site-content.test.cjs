const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const index = read('index.html');
const checkout = read('checkout.html');

test('homepage is regional, canonical, and free of Saudi-only positioning', () => {
  assert.match(index, /<html lang="ar" dir="rtl">/);
  assert.match(index, /<link rel="canonical" href="https:\/\/agency\.rawj\.pro\/">/);
  assert.doesNotMatch(index, /ar-SA|geo\.region|geo\.placename|AggregateRating/);
  assert.doesNotMatch(index, /خالد العتيبي|سارة المطيري|عبدالرحمن الغامدي|نورة الشمري|فيصل الدوسري|فاطمة الحربي/);
  assert.doesNotMatch(index, /الرياض|جدة|الدمام|ريال مبيعات|متاجر حقيقية في السعودية|متجر سعودي/);
  assert.doesNotMatch(index, /mada\.webp|stc\.webp|tgara\.webp|a3mal\.webp|avatar_(?:male|female)\.webp/);
});

test('homepage has general lead fields and visible Egypt offer', () => {
  assert.match(index, /id="fcountry"/);
  assert.match(index, /id="fstage"/);
  assert.match(index, /\^\\\+\?\[0-9\]\{8,15\}\$/);
  assert.match(index, /باقة العملاء داخل مصر/);
  assert.match(index, /10,000 EGP/);
  assert.doesNotMatch(index, /data-eg-only|egypt\.js|country\.is/);
});

test('structured data is valid JSON and identifies the Egyptian merchant', () => {
  const match = index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'JSON-LD block is missing');
  const data = JSON.parse(match[1]);
  const business = data.find((item) => item['@type'] === 'ProfessionalService');
  assert.equal(business.alternateName, 'RAWJ PRO');
  assert.equal(business.url, 'https://agency.rawj.pro/');
  assert.equal(business.address.addressCountry, 'EG');
  assert.equal(business.contactPoint.email, 'info@rawj.pro');
});

test('checkout is public, explicit, and non-transactional', () => {
  assert.doesNotMatch(checkout, /data-eg-only|egypt\.js|region-status|country\.is/);
  assert.match(checkout, /10,000 EGP/);
  assert.match(checkout, /شهر واحد/);
  assert.match(checkout, /خدمة رقمية/);
  assert.match(checkout, /id="policy-consent"/);
  assert.match(checkout, /سياسة الإلغاء والاسترداد/);
  assert.match(checkout, /disabled aria-disabled="true"/);
  assert.match(checkout, /لن يُخصم أي مبلغ/);
});

test('merchant details and policy pages are present and consistent', () => {
  for (const file of ['about.html', 'contact.html', 'services.html', 'terms.html', 'privacy.html', 'refund.html', 'shipping.html']) {
    const page = read(file);
    assert.match(page, /https:\/\/agency\.rawj\.pro\//, `${file} canonical is missing`);
    assert.match(page, /info@rawj\.pro/, `${file} email is missing`);
    assert.match(page, /\+20 105 084 5080/, `${file} phone is missing`);
    assert.match(page, /القاهرة، مصر/, `${file} country is missing`);
  }
});

test('required local assets exist and generated photos are WebP', () => {
  for (const file of ['style.css', 'policies.css', 'logo.webp', 'img1.webp', 'img2.webp', 'img3.webp', 'img4.webp', 'visa.webp', 'master.webp']) {
    assert.ok(existsSync(join(root, file)), `${file} is missing`);
  }
  for (const file of ['img2.webp', 'img3.webp', 'img4.webp']) {
    const bytes = readFileSync(join(root, file));
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.ok(bytes.length > 20_000, `${file} appears unexpectedly small`);
  }
});
