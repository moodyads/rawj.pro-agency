const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const index = read('index.html');
const english = read('en/index.html');
const checkout = read('checkout.html');
const services = read('services.html');
const serviceNamesAr = ['استراتيجية النمو الرقمي', 'الإعلانات المدفوعة', 'المحتوى والسوشيال', 'تهيئة محركات البحث SEO', 'تحسين المتجر والتحويل', 'التحليلات والتقارير'];
const serviceNamesEn = ['Digital growth strategy', 'Paid advertising', 'Content and social', 'Search engine optimization', 'Store and conversion optimization', 'Analytics and reporting'];

test('Arabic homepage follows the unified ecommerce agency structure', () => {
  assert.match(index, /<html lang="ar" dir="rtl">/);
  assert.match(index, /تسويق متكامل/);
  for (const name of serviceNamesAr) assert.match(index, new RegExp(name));
  const order = ['id="services"', 'id="process"', 'id="package"', 'id="why-us"', 'id="faq"', 'id="consultation"'];
  let previous = -1;
  for (const marker of order) {
    const position = index.indexOf(marker);
    assert.ok(position > previous, `${marker} is missing or out of order`);
    previous = position;
  }
  assert.doesNotMatch(index, /pain-bg|stats-grid|service-clarity|sticky-bar|ROAS|CAC|CRO/);
});

test('Arabic and English homepages have canonical language relationships', () => {
  assert.match(index, /<link rel="canonical" href="https:\/\/agency\.rawj\.pro\/">/);
  assert.match(index, /hreflang="en" href="https:\/\/agency\.rawj\.pro\/en\/"/);
  assert.match(english, /<html lang="en" dir="ltr">/);
  assert.match(english, /<link rel="canonical" href="https:\/\/agency\.rawj\.pro\/en\/">/);
  assert.match(english, /hreflang="ar" href="https:\/\/agency\.rawj\.pro\/"/);
  for (const name of serviceNamesEn) assert.match(english, new RegExp(name));
  assert.match(english, /Policies in Arabic/);
  assert.match(read('sitemap.xml'), /https:\/\/agency\.rawj\.pro\/en\//);
});

test('lead forms keep the same delivery endpoint and neutral qualification fields', () => {
  for (const page of [index, english]) {
    assert.match(page, /action="https:\/\/formsubmit\.co\/moodysameh66@gmail\.com"/);
    assert.match(page, /data-name/);
    assert.match(page, /data-phone/);
    assert.match(page, /data-country/);
  }
  assert.match(index, /id="country"/);
  assert.match(index, /id="stage"/);
  assert.match(english, /id="en-country"/);
});

test('structured data is valid and exposes all six service groups', () => {
  const match = index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'JSON-LD block is missing');
  const data = JSON.parse(match[1]);
  const business = data.find((item) => item['@type'] === 'ProfessionalService');
  assert.equal(business.alternateName, 'RAWJ PRO');
  assert.equal(business.address.addressCountry, 'EG');
  assert.equal(business.contactPoint.email, 'info@rawj.pro');
  assert.equal(business.hasOfferCatalog.itemListElement.length, 6);
});

test('services page describes the integrated offer and the defined Egypt package', () => {
  for (const name of serviceNamesAr) assert.match(services, new RegExp(name));
  assert.match(services, /10,000 EGP/);
  assert.match(services, /لا يوجد خصم أو تجديد تلقائي/);
  assert.match(services, /خدمة رقمية بالكامل/);
  assert.doesNotMatch(services, /Services &amp; Workflow|english-service|language-divider/);
});

test('checkout remains public, explicit, consent-based, and non-transactional', () => {
  assert.doesNotMatch(checkout, /data-eg-only|egypt\.js|region-status|country\.is/);
  assert.match(checkout, /10,000 EGP/);
  assert.match(checkout, /شهر واحد/);
  assert.match(checkout, /خدمة رقمية/);
  assert.match(checkout, /id="policy-consent"/);
  assert.match(checkout, /سياسة الإلغاء والاسترداد/);
  assert.match(checkout, /disabled aria-disabled="true"/);
  assert.match(checkout, /لن يُخصم أي مبلغ/);
});

test('all public Arabic pages share the unified visual shell and merchant details', () => {
  const pages = ['about.html', 'contact.html', 'services.html', 'terms.html', 'privacy.html', 'refund.html', 'shipping.html', 'checkout.html'];
  for (const file of pages) {
    const page = read(file);
    assert.match(page, /class="site-header"/, `${file} unified header is missing`);
    assert.match(page, /class="site-footer"/, `${file} unified footer is missing`);
    assert.match(page, /\/style\.css\?v=20261006-unified/, `${file} unified stylesheet is missing`);
    assert.match(page, /info@rawj\.pro/, `${file} email is missing`);
    assert.match(page, /\+20 105 084 5080/, `${file} phone is missing`);
    assert.match(page, /القاهرة، مصر/, `${file} address is missing`);
    assert.doesNotMatch(page, /policy-header|policy-footer/, `${file} uses the old visual shell`);
  }
});

test('Saudi-only proof, geo blocking, and fabricated testimonials cannot return', () => {
  const pages = [index, english, services].join('\n');
  assert.doesNotMatch(pages, /ar-SA|geo\.region|geo\.placename|AggregateRating|data-eg-only|egypt\.js|country\.is/);
  assert.doesNotMatch(pages, /خالد العتيبي|سارة المطيري|عبدالرحمن الغامدي|نورة الشمري|فيصل الدوسري|فاطمة الحربي/);
  assert.doesNotMatch(pages, /mada\.webp|stc\.webp|tgara\.webp|a3mal\.webp|avatar_(?:male|female)\.webp/);
});

test('required local assets and generated photos are valid', () => {
  for (const file of ['style.css', 'policies.css', 'site.js', 'logo.webp', 'smalll.webp', 'img2.webp', 'img4.webp', 'visa.webp', 'master.webp']) {
    assert.ok(existsSync(join(root, file)), `${file} is missing`);
  }
  for (const file of ['img2.webp', 'img4.webp']) {
    const bytes = readFileSync(join(root, file));
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.ok(bytes.length > 20_000, `${file} appears unexpectedly small`);
  }
});
