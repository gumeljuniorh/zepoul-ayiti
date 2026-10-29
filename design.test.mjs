import test from 'node:test';
import vm from 'node:vm';
import { sync } from './scripts/sync-components.mjs';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const pages = ['index.html', 'about.html', 'expertise.html', 'services.html', 'vision.html', 'communications.html', 'social/index.html'];
const expected = ["Accueil","Nos produits","Notre exploitation","Notre développement","Partenaires","À propos","Contact","Demander une cotation"];
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
test('only the public long-term objective remains, without invented current production', () => {
  const home = read('index.html');
  assert(!home.includes('class="project-band'));
  assert(!home.includes('class="growth-track"'));
  for (const f of ['index.html','about.html','expertise.html','vision.html','fournisseur-oeufs-haiti.html','llms.txt']) {
    const html = read(f);
    assert(!/Hy-Line|W-80|(?:3|5|8|12) 000|3 500|16 semaines|projet pilote|phase de préparation/i.test(html), f);
    assert(!/500\s+(œufs|oeufs)\s+(par jour|chaque jour)/i.test(html));
  }
  assert(read('vision.html').includes('objectif à long terme'));
  assert(read('vision.html').includes('<strong class="strategic-figure">50 000</strong>'));
  assert(!read('expertise.html').includes('50 000'));
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
  for (const cls of ['purpose-grid','development-band','product-section']) {
    const section = html.match(new RegExp('<section class="' + cls + '[\\s\\S]*?<\\/section>'))?.[0];
    assert(section, cls + ': section presente');
    assert(!/<(?:svg|img|picture)\b/.test(section), cls + ': pas de visuel decoratif');
  }
  assert.equal((html.match(/class="phase-dot"/g) || []).length, 0);
  assert.equal((read('vision.html').match(/class="phase-dot"/g) || []).length, 0);
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
  assert(html.includes('L’élevage de poules pondeuses constitue le cœur de notre activité à Port-de-Paix.'));
  assert(html.includes('GL Zepoul Peyi exerce ses activités avicoles sous la marque Zepoul Ayiti.'));
  assert(html.includes('alt="Portrait de Girard Gumel J. Henry, fondateur de GL Zepoul Peyi" loading="eager"')); 
  assert(!html.includes('projet pilote'));
  assert(!html.includes('bâtiment avicole construit'));
});


test('retired decorative icons are not referenced by public pages', () => {
  for (const file of pages) assert(!read(file).includes('assets/icons/'), file);
  assert(!read('design.css').includes('assets/icons/'));
  assert(!read('index.html').includes('<svg class="editorial-icon"'));
});
test('institutional page titles match the requested subjects', () => {
  const titles = {"index.html":"Production et commercialisation d’œufs en Haïti","about.html":"GL Zepoul Peyi","vision.html":"Notre développement","expertise.html":"Notre exploitation","services.html":"Produits et services","communications.html":"Communications"};
  for(const [file,title] of Object.entries(titles)) {
    const h1=read(file).match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<br\s*\/?>/g,' ').replace(/<[^>]+>/g,'').trim();
    assert.equal(h1,title);
  }
});


test('operational editorial copy does not activate or fabricate stock', () => {
  for (const file of ['index.html','about.html','expertise.html','vision.html','fournisseur-oeufs-haiti.html']) {
    const html = read(file);
    assert(!/projet pilote|phase de préparation|phase de lancement/i.test(html), file);
  }
  assert(read('index.html').includes('data-inventory-panel data-commercialisation="preparation" hidden'));
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
  const footerPages = [...pages, 'fournisseur-oeufs-haiti.html', 'girard-gumel-j-henry.html', 'mentions-legales.html', 'politique-confidentialite.html'];
  const socialLinks = ['https://www.facebook.com/p/Zepoul-Ayiti-61578818947873/', 'https://www.instagram.com/zepoul_ayiti/', 'https://x.com/Zepoul_Ayiti', 'https://www.tiktok.com/@zepoul.ayiti'];
  for (const file of footerPages) {
    const html = read(file);
    const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)[0];
    const prefix = file.startsWith('social/') ? '../' : '';
    assert.deepEqual([...footer.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m => m[1]), ['mailto:commercial@zepoulayiti.com', 'https://wa.me/50944975668', prefix + 'communications.html', ...socialLinks, prefix + 'mentions-legales.html', prefix + 'politique-confidentialite.html'], file);
    for (const text of ['Zepoul Ayiti', 'GL Zepoul Peyi', 'Port-de-Paix, Haïti', '© 2026 GL Zepoul Peyi. Tous droits réservés.']) assert(footer.includes(text), file);
    assert(!footer.includes('Découvrir'), file);
    assert(!/footer-tagline|#commande/.test(footer), file);
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


test('internal files are excluded from Jekyll publication without deleting runtime files', () => {
  const config = read('_config.yml');
  for (const f of ['.local-backups', 'private', 'backups', 'exports', 'cloudflare-worker.js', 'google-apps-script.gs', 'design.test.mjs', 'inventory.test.mjs', 'quote-form.test.mjs', 'validate-site.mjs', 'social/index copy.html']) assert(config.includes('  - ' + f), f);
  for (const f of ['site.js','theme.js','admin.js','admin.html','index.html']) assert(existsSync(new URL(f,import.meta.url)), f);
  assert(read('.gitignore').includes('.local-backups/'));
});

// These checks run locally and never submit forms or contact external services.
test('all published shared components match their source templates', () => {
  assert.deepEqual(sync(false), []);
});

function menuHarness() {
  let document;
  const element = () => {
    const attrs = new Map(), classes = new Set(), listeners = {};
    return {
      attrs, listeners, style: { removeProperty() {}, setProperty() {} },
      classList: {
        contains: key => classes.has(key), add: key => classes.add(key), remove: key => classes.delete(key),
        toggle: (key, enabled) => enabled ? classes.add(key) : classes.delete(key)
      },
      setAttribute: (key, value) => attrs.set(key, value), getAttribute: key => attrs.get(key),
      removeAttribute: key => attrs.delete(key), addEventListener: (type, fn) => { listeners[type] = fn; },
      focus() { document.activeElement = this; }, getClientRects: () => [{}],
      querySelector: () => null, contains(target) { return target === this; }
    };
  };
  const btn = element(), menu = element(), links = [element(), element()];
  btn.setAttribute('data-menu-target', 'mobile-menu');
  menu.querySelector = selector => selector === 'a' ? links[0] : null;
  menu.querySelectorAll = () => links;
  menu.contains = target => target === menu || links.includes(target);
  const events = {}, windowEvents = {};
  document = {
    body: element(), documentElement: element(), activeElement: null,
    querySelectorAll: () => [btn], getElementById: () => menu, querySelector: () => null,
    addEventListener: (type, fn) => { events[type] = fn; }
  };
  const window = { scrollY: 0, scrollTo() {}, matchMedia: () => ({matches: false}),
    addEventListener: (type, fn) => { windowEvents[type] = fn; }
  };
  const source = read('site.js');
  const start = source.indexOf('  function bindMenu()');
  const end = source.indexOf('  function bindTracking()', start);
  assert(start >= 0 && end > start);
  vm.runInNewContext(source.slice(start, end) + '\nbindMenu();', {document, window});
  const click = () => btn.listeners.click({preventDefault() {}});
  return {btn, menu, links, document, events, window, windowEvents, click};
}

test('mobile menu opens, closes with Escape and restores keyboard focus', () => {
  const h = menuHarness();
  assert(h.menu.attrs.has('inert'));
  h.click();
  assert.equal(h.btn.getAttribute('aria-expanded'), 'true');
  assert.equal(h.menu.getAttribute('aria-hidden'), 'false');
  assert(!h.menu.attrs.has('inert'));
  assert.equal(h.document.activeElement, h.links[0]);
  h.events.keydown({key:'Escape'});
  assert.equal(h.btn.getAttribute('aria-expanded'), 'false');
  assert(h.menu.attrs.has('inert'));
  assert.equal(h.document.activeElement, h.btn);
});

test('mobile menu keeps keyboard focus inside and closes when a link is selected', () => {
  const h = menuHarness(); h.click();
  let prevented = false;
  h.links[1].focus();
  h.events.keydown({key:'Tab', shiftKey:false, preventDefault() {prevented = true;}});
  assert(prevented); assert.equal(h.document.activeElement, h.btn);
  h.events.keydown({key:'Tab', shiftKey:true, preventDefault() {}});
  assert.equal(h.document.activeElement, h.links[1]);
  h.links[0].listeners.click();
  assert.equal(h.btn.getAttribute('aria-expanded'), 'false');
  assert(!h.document.body.classList.contains('mobile-menu-open'));
});

test('mobile menu closes on outside click and when switching to desktop', () => {
  const h = menuHarness(); h.click();
  h.events.click({target:{}});
  assert(!h.menu.classList.contains('open'));
  h.click(); h.window.matchMedia = () => ({matches:true}); h.windowEvents.resize();
  assert(!h.menu.classList.contains('open'));
  assert.equal(h.menu.getAttribute('aria-hidden'), 'true');
});
