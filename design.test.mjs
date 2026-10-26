import test from 'node:test';
import { createHash } from 'node:crypto';
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


test('institutional sections have no decorative icons or illustrative photos', () => {
  const html = read('index.html');
  const purpose = html.match(/<section class="purpose-grid[\s\S]*?<\/section>/)[0];
  assert.deepEqual([...purpose.matchAll(/<h2>[\s\S]*?<span>([^<]+)<\/span><\/h2>/g)].map(m => m[1]), ['Notre mission', 'Notre vision', 'Nos engagements']);
  assert(!html.includes('class="metric-icon"'));
  assert(!html.includes('class="purpose-icon"'));
  for (const cls of ['project-band','purpose-grid','development-band','product-section']) {
    const section = html.match(new RegExp('<section class="' + cls + '[\\s\\S]*?<\\/section>'))?.[0];
    assert(section, cls + ': section presente');
    assert(!/<(?:svg|img|picture)\b/.test(section), cls + ': pas de visuel decoratif');
  }
  assert.equal((html.match(/class="phase-dot"/g) || []).length, 5);
  assert(!html.includes('editorial-icon'));
  assert(!read('design.css').includes('assets/icons/'));
  assert(html.includes('Âge prévu au début de ponte, et non délai après livraison.'));
  assert(html.includes('class="product-principles"'));
  assert(!html.includes('class="product-symbol"'));
});
test('about preserves the director and the six requested narrative sections', () => {
  const html = read('about.html');
  for (const title of ['Notre entreprise', 'Pourquoi Zepoul Ayiti ?', 'Notre projet avicole', 'Notre méthode', 'Perspectives de développement', 'Nos engagements']) assert(html.includes('>' + title + '</h2>'));
  assert(html.includes('phase pilote est en cours'));
  assert(html.includes('La préparation est achevée'));
});


test('unused original SVG resources and their licenses remain preserved', () => {
  const source = JSON.parse(read('assets/icons/sources.json'));
  assert.equal(source.icons.length, 7);
  const license=read('assets/icons/' + source.license);
  assert(license.includes('ISC License'));
  assert(license.includes('The MIT License'));
  const html = read('index.html');
  const css = read('design.css');
  for (const icon of source.icons) {
    const svg = read('assets/icons/' + icon.file);
    assert.equal(createHash('sha256').update(svg).digest('hex'),icon.sha256);
    assert(!html.includes('data-icon="' + icon.name + '"'));
    assert(!css.includes('url("assets/icons/' + icon.file + '")'));
    assert(!/<script|<foreignObject/i.test(svg));
  }
  assert(!/<svg class="editorial-icon"/.test(html));
});
test('institutional page titles match the requested subjects', () => {
  const titles = {"index.html":"Production et commercialisation d’œufs en Haïti","about.html":"Présentation de GL Zepoul Peyi","vision.html":"Stratégie de développement de l’exploitation","expertise.html":"Organisation et gestion de l’exploitation avicole","services.html":"Approvisionnement et relations commerciales","communications.html":"Actualités et communications"};
  for(const [file,title] of Object.entries(titles)) {
    const h1=read(file).match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<br\s*\/?>/g,' ').replace(/<[^>]+>/g,'').trim();
    assert.equal(h1,title);
  }
});


test('pilot status reflects completed preparation without activating stock', () => {
  for (const file of ['index.html','about.html','expertise.html','vision.html','fournisseur-oeufs-haiti.html']) {
    const html = read(file);
    assert(/phase pilote (?:est )?en cours/i.test(html), file);
    assert(!/Pilote en préparation|Mise en exploitation en préparation|phase pilote, en préparation/.test(html), file);
  }
  assert.match(read('index.html'), /data-inventory-panel data-commercialisation="preparation" hidden/);
});
