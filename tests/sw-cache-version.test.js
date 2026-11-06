'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { computeCacheName, NAME_PATTERN } = require('../scripts/stamp-sw.js');

test('sw.js cache name matches the precached files', () => {
  const source = fs.readFileSync('sw.js', 'utf8');
  const match = source.match(NAME_PATTERN);
  assert.ok(match, 'sw.js must declare CACHE_NAME');
  assert.equal(
    match[0],
    `const CACHE_NAME = '${computeCacheName(source)}';`,
    'Precached files changed. Run: npm run stamp:sw',
  );
});
