// Generate the homepage's single stylesheet without altering its CSS cascade.
// Run: node scripts/build-home-css.mjs
// Check: node scripts/build-home-css.mjs --check
// Whenever site.css, home.css, or design.css changes, regenerate the bundle.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inputs = ['site.css', 'home.css', 'design.css'];
const target = resolve(root, 'home-bundle.css');
const expected = inputs
  .map(name => readFileSync(resolve(root, name), 'utf8'))
  .join('\n');

if (process.argv.includes('--check')) {
  const actual = readFileSync(target, 'utf8');
  if (actual !== expected) {
    console.error('home-bundle.css is outdated; run node scripts/build-home-css.mjs');
    process.exitCode = 1;
  } else {
    console.log('home-bundle.css matches all three source stylesheets.');
  }
} else {
  writeFileSync(target, expected, 'utf8');
  console.log('Updated home-bundle.css.');
}
