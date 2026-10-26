import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const pages = ['index.html', 'about.html', 'expertise.html', 'services.html', 'vision.html', 'communications.html', 'social/index.html'];
const expected = ['Accueil', 'À propos', 'Notre exploitation', 'Nos produits', 'Notre développement', 'Partenaires', 'Contact', 'Demander une cotation'];
for (const file of pages) {
  test(`${file}: coherent navigation and accessible mobile control`, () => {
    const html = read(file);
    const nav = html.match(/<nav[^>]*aria-label="Navigation principale"[^>]*>([\s\S]*?)<div class="social-icons"/)[1];
    assert.deepEqual([...nav.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map(m => m[1]), expected);
    assert.match(html, /aria-controls="mobile-menu"/);
    assert.match(html, /data-menu-target="mobile-menu"/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.match(html, /design\.css\?v=/);
    assert(!nav.includes('communications.html'));
  });
}
test('home preserves all functional quote controls and endpoint', () => {
  const html = read('index.html');
  assert.match(html, /<form[^>]*id="quote-form"[^>]*action="\/api\/quote"[^>]*method="POST"/);
  for (const id of ['frequency','vol','zone','details','inst','email','phone','quote-whatsapp-prepare','quote-whatsapp-open','quote-whatsapp-message','form-status']) assert(html.includes(`id="${id}"`));
  assert.match(html, /class="cf-turnstile"/);
  assert.match(html, /name="_honey"/);
  assert.match(html, /data-inventory-panel data-commercialisation="preparation" hidden/);
  assert.match(html, /<video[^>]*controls muted autoplay loop playsinline preload="none"/);
});
test('capacity figures are project data, not live stock or achieved production', () => {
  const html = read('index.html');
  assert(html.includes('Données de projet, non résultats de production.'));
  assert(html.includes('Prévision à confirmer selon le lot'));
  assert(!/500\s+(œufs|oeufs)\s+(par jour|chaque jour)/i.test(html));
  for (const value of ['500','3 000','5 000','8 000','12 000']) assert(read('vision.html').includes(`<strong>${value}<span> poules</span>`));
  assert(read('vision.html').includes('ambition stratégique, et non une capacité acquise'));
});
test('director profile precedes the company sections without the removed heading', () => {
  const html = read('about.html');
  assert(!html.includes('Gouvernance et direction'));
  assert(html.indexOf('id="fondateur-title"') < html.indexOf('id="entreprise-title"'));
  assert(html.includes('girard-gumel-j-henry.jpg'));
  assert(html.includes('Fondateur et Directeur général'));
});
test('communications retain their three real dates and zoom controls', () => {
  const html = read('communications.html');
  for (const date of ['2026-05-13','2026-05-09','2026-05-01']) assert(html.includes(`datetime="${date}"`));
  assert.equal((html.match(/role="dialog"/g)||[]).length,3);
  assert.match(html,/data-lightbox-close/);
});
test('official social destinations and QR page remain available', () => {
  const html = read('social/index.html');
  for(const url of ['https://www.facebook.com/p/Zepoul-Ayiti-61578818947873/','https://www.instagram.com/zepoul_ayiti/','https://www.tiktok.com/@zepoul.ayiti','https://x.com/Zepoul_Ayiti','https://wa.me/50944975668']) assert(html.includes(url));
  assert(existsSync(new URL('social/index.html',import.meta.url)));
});
