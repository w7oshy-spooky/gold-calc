'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');

for (const page of ['index.html']) {
  test(`${page} has a CSP that allows only its inline theme script`, () => {
    const html = fs.readFileSync(page, 'utf8');
    const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
    assert.ok(policy, 'CSP meta tag is missing');
    assert.match(policy, /object-src 'none'/);
    assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);

    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(inline.length, 1, 'expected exactly one inline script');
    const normalizedScript = inline[0][1].replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const hash = crypto.createHash('sha256').update(normalizedScript, 'utf8').digest('base64');
    assert.ok(
      policy.includes(`'sha256-${hash}'`),
      `Inline script changed. Update its hash in the CSP to sha256-${hash}`,
    );
  });
}
