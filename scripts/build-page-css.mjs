// Bundle public-page CSS without changing selector order or declarations.
// Run: node scripts/build-page-css.mjs
// Check: node scripts/build-page-css.mjs --check
// Keep this manifest updated when adding/changing public-page stylesheets.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundles = {
  'home-bundle.css': ['site.css', 'home.css', 'design.css'],
  'about-design-bundle.css': ['about.css', 'design.css'],
  'services-design-bundle.css': ['services.css', 'design.css'],
  'vision-design-bundle.css': ['vision.css', 'design.css'],
  'expertise-design-bundle.css': ['expertise.css', 'design.css'],
  'communications-design-bundle.css': ['communications.css', 'design.css'],
  'social-design-bundle.css': ['design.css', 'social.css'],
  'contact-design-bundle.css': ['home.css', 'design.css', 'contact.css'],
  'cotation-design-bundle.css': ['home.css', 'design.css', 'quote-cotation.css'],
};
const checking = process.argv.includes('--check');
let outdated = false;

for (const [target, sources] of Object.entries(bundles)) {
  const expected = sources.map(file => readFileSync(resolve(root, file), 'utf8')).join('\n');
  const output = resolve(root, target);
  if (checking) {
    let current;
    try { current = readFileSync(output, 'utf8'); } catch { current = null; }
    if (current !== expected) {
      outdated = true;
      console.error(target + ' is outdated: run node scripts/build-page-css.mjs');
    }
  } else {
    writeFileSync(output, expected, 'utf8');
    console.log('Updated ' + target);
  }
}
if (checking && !outdated) console.log('All public-page CSS bundles match their sources.');
if (outdated) process.exitCode = 1;
