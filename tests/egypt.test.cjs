const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const script = readFileSync(require('node:path').join(__dirname, '../egypt.js'), 'utf8');

async function render(fetch) {
    const elements = [{ hidden: true }, { hidden: true }];
    const status = { hidden: false, textContent: '' };
    const context = {
        fetch, AbortController, setTimeout, clearTimeout,
        document: { querySelectorAll: () => elements, getElementById: () => status }
    };
    await vm.runInNewContext(script, context);
    return { elements, status };
}

for (const country of ['EG', 'SA', 'US', 'AE']) {
    test(`country ${country}`, async () => {
        const result = await render(async () => ({ ok: true, json: async () => ({ country }) }));
        assert.ok(result.elements.every(element => element.hidden === (country !== 'EG')));
        assert.equal(result.status.hidden, country === 'EG');
    });
}
for (const payload of [{}, { country: 'eg' }, { country: 'EG', error: true }]) {
    test(`invalid lookup ${JSON.stringify(payload)}`, async () => {
        const result = await render(async () => ({ ok: true, json: async () => payload }));
        assert.ok(result.elements.every(element => element.hidden));
        assert.equal(result.status.hidden, false);
    });
}
test('network failure keeps checkout hidden', async () => {
    const result = await render(async () => { throw new Error('offline'); });
    assert.ok(result.elements.every(element => element.hidden));
});
test('HTTP error keeps checkout hidden', async () => {
    const result = await render(async () => ({ ok: false }));
    assert.ok(result.elements.every(element => element.hidden));
});
test('lookup sends no credentials or referrer', async () => {
    await render(async (url, options) => {
        assert.equal(url, 'https://api.country.is/');
        assert.equal(options.credentials, 'omit');
        assert.equal(options.referrerPolicy, 'no-referrer');
        assert.equal(options.cache, 'no-store');
        return { ok: true, json: async () => ({ country: 'EG' }) };
    });
});
