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
  for (const label of ['Implantation', 'Objectif de développement']) assert(html.includes(label));
  assert(!html.includes('Âge de ponte'));
  assert(!html.includes('3 500'));
  assert(!read('expertise.html').includes('3 500'));
  assert(!html.includes('class="growth-track"'));
  assert(!html.includes('Données de projet, non résultats de production.'));
  assert(read('vision.html').includes('Les phases 2 à 5 sont des objectifs d’expansion.'));
  assert(!/500\s+(œufs|oeufs)\s+(par jour|chaque jour)/i.test(html));
  for (const value of ['3 000','5 000','8 000','12 000']) assert(read('vision.html').includes(`<strong>${value}<span> poules</span>`));
  for (const file of ['expertise.html','vision.html']) {
    assert(read(file).includes('ambition d’atteindre à long terme'));
    assert(read(file).includes('<strong class="strategic-figure">50 000</strong>'));
  }
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
  assert.equal((html.match(/class="phase-dot"/g) || []).length, 0);
  assert.equal((read('vision.html').match(/class="phase-dot"/g) || []).length, 5);
  assert(!html.includes('editorial-icon'));
  assert(!read('design.css').includes('assets/icons/'));
  assert(!html.includes('et non délai après livraison'));
  assert(!html.includes('class="project-caption"'));
  assert(html.includes('class="product-principles"'));
  assert(!html.includes('class="product-symbol"'));
});
test('about preserves the director and the six requested narrative sections', () => {
  const html = read('about.html');
  for (const title of ['Notre entreprise', 'Notre raison d’être', 'Notre exploitation', 'Notre approche', 'Notre développement', 'Nos engagements']) assert(html.includes('>' + title + '</h2>'));
  assert(html.includes('Le projet pilote est en préparation.'));
  assert(html.includes('Notre exploitation est implantée à Port-de-Paix.'));
  assert(!html.includes('bâtiment avicole construit'));
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
  const titles = {"index.html":"Production d’œufs en Haïti","about.html":"GL Zepoul Peyi","vision.html":"Notre développement","expertise.html":"Notre exploitation","services.html":"Produits et services","communications.html":"Communications"};
  for(const [file,title] of Object.entries(titles)) {
    const h1=read(file).match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<br\s*\/?>/g,' ').replace(/<[^>]+>/g,'').trim();
    assert.equal(h1,title);
  }
});


test('pilot remains a preparation phase without activating stock', () => {
  for (const file of ['index.html','about.html','expertise.html','vision.html','fournisseur-oeufs-haiti.html']) {
    const html = read(file);
    assert(/(?:projet pilote[^<.]*en préparation|en préparation[^<.]*projet pilote)/i.test(html), file);
    assert(!/phase pilote (?:est )?en cours|préparation est achevée/i.test(html), file);
  }
  assert.match(read('index.html'), /data-inventory-panel data-commercialisation="preparation" hidden/);
});

test('editorial revision preserves essential commercial and privacy distinctions', () => {
  assert(read('index.html').includes('La cotation ne vaut pas confirmation de commande.'));
  assert(read('index.html').includes('Cet envoi est distinct du formulaire.'));
  assert(read('services.html').includes('Les commandes sont soumises aux disponibilités confirmées.'));
  assert(read('services.html').includes('Analyse de votre demande'));
  const privacy = read('politique-confidentialite.html');
  for (const term of ['La durée de conservation n’est pas encore définie.', 'Google Apps Script et Google Sheets', 'Vos droits', 'ni vendues ni louées']) assert(privacy.includes(term));
  assert(!read('expertise.html').includes('charges d’exploitation'));
  assert(!read('about.html').includes('analyse des besoins'));
  assert.equal((read('communications.html').match(/<figcaption>Visuel de campagne<\/figcaption>/g) || []).length, 3);
});


test('footers contain only the requested identity, communications, social and legal links', () => {
  const footerPages = [...pages, 'social/index copy.html', 'fournisseur-oeufs-haiti.html', 'girard-gumel-j-henry.html', 'mentions-legales.html', 'politique-confidentialite.html'];
  const socialLinks = ['https://www.facebook.com/p/Zepoul-Ayiti-61578818947873/', 'https://www.instagram.com/zepoul_ayiti', 'https://x.com/zepoul_ayiti', 'https://www.tiktok.com/@zepoul.ayiti'];
  for (const file of footerPages) {
    const html = read(file);
    const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)[0];
    const prefix = file.startsWith('social/') ? '../' : '';
    assert.deepEqual([...footer.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m => m[1]), [prefix + 'communications.html', ...socialLinks, prefix + 'mentions-legales.html', prefix + 'politique-confidentialite.html'], file);
    for (const text of ['Zepoul Ayiti', 'GL Zepoul Peyi', 'Port-de-Paix, Haïti', '© 2026 GL Zepoul Peyi. Tous droits réservés.']) assert(footer.includes(text), file);
    assert(!footer.includes('Découvrir'), file);
    assert(!/footer-tagline|mailto:|wa.me|#commande/.test(footer), file);
    const header = html.slice(html.indexOf('<body'), html.indexOf('<main'));
    assert(!header.includes('communications.html'), file);
  }
});

test('public institutional copy omits detailed pilot and building data', () => {
  for (const file of pages.concat(['llms.txt'])) {
    const html = read(file);
    assert(!/Hy-Line|W-80|500\s*(?:<[^>]*>\s*)*poules|Données de projet, non résultats|16 semaines|Bâtiment déjà construit/.test(html), file);
  }
});
