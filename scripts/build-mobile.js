const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const targetDir = path.join(rootDir, 'www');

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

const filesToCopy = [
  'index.html',
  'en.html',
  'tailwind.css',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'gold-calculator.js',
  'sw.js',
];

const dirsToCopy = [
  'fonts',
  'js',
];

for (const file of filesToCopy) {
  const src = path.join(rootDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(targetDir, file));
  }
}

for (const dir of dirsToCopy) {
  const src = path.join(rootDir, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, path.join(targetDir, dir), { recursive: true });
  }
}

console.log('Mobile assets bundled successfully into www/');
