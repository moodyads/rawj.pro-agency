const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');
const pages = fs.readdirSync(root).filter(name => name.endsWith('.html')).concat('en/index.html');

test('every Agency page limits scripts and preserves checkout, fonts and JSON-LD', () => {
  for (const name of pages) {
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    assert.ok(match, name);
    const policy = match[1];
    assert.match(policy, /default-src 'self';/);
    const scripts = policy.match(/script-src ([^;]+);/)[1];
    assert.doesNotMatch(scripts, /unsafe-inline|unsafe-eval|\*/);
    assert.match(policy, /connect-src 'self' https:\/\/agency-paymob-usd\.moodyads\.workers\.dev;/);
    assert.match(policy, /object-src 'none';/);
    assert.match(policy, /base-uri 'self';/);
    assert.match(policy, /upgrade-insecure-requests/);
    assert.match(html, /name="referrer" content="strict-origin-when-cross-origin"/);
    assert.ok(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf('<script'), name);
    for (const [, body] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.ok(scripts.includes("'sha256-" + createHash('sha256').update(body).digest('base64') + "'"), name);
    }
  }
});
