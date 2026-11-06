'use strict';
// Derives the service-worker cache name from the contents of the precached files,
// so users always receive fresh files after any change to the app shell.
//   node scripts/stamp-sw.js   rewrites CACHE_NAME in sw.js
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const swPath = join(root, 'sw.js');
const NAME_PATTERN = /const CACHE_NAME = '[^']*';/;

function readAppShell(source) {
  const block = source.match(/const APP_SHELL = \[([\s\S]*?)\];/);
  if (!block) throw new Error('APP_SHELL not found in sw.js');
  return [...block[1].matchAll(/'([^']+)'/g)]
    .map((m) => m[1])
    .filter((file) => file !== './' && existsSync(join(root, file)))
    .sort();
}

function computeCacheName(source = readFileSync(swPath, 'utf8')) {
  const hash = createHash('sha256');
  for (const file of readAppShell(source)) {
    hash.update(file);
    hash.update(readFileSync(join(root, file)));
  }
  return `gold-calc-shell-${hash.digest('hex').slice(0, 10)}`;
}

function stamp() {
  const source = readFileSync(swPath, 'utf8');
  const next = source.replace(NAME_PATTERN, `const CACHE_NAME = '${computeCacheName(source)}';`);
  if (next !== source) writeFileSync(swPath, next);
  return next !== source;
}

module.exports = { computeCacheName, NAME_PATTERN };

if (require.main === module) {
  console.log(stamp() ? 'sw.js cache name updated' : 'sw.js cache name already current');
}
