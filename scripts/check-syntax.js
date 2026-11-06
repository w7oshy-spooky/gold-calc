'use strict';
// Runs `node --check` on every JS file the app ships, so new files are covered automatically.
const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const files = ['gold-calculator.js', 'live-gold.js', 'sw.js'];

function walk(dir) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) walk(rel);
    else if (name.endsWith('.js')) files.push(rel);
  }
}
walk('js');
walk('api');

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
console.log(`${files.length} files checked`);
process.exit(failed ? 1 : 0);
