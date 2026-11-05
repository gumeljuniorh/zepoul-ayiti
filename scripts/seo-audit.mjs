// Read-only SEO audit: validates public HTML, shared metadata and sitemaps.
// Run: node scripts/seo-audit.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const pages = [
  'index.html', 'about.html', 'services.html', 'vision.html',
  'expertise.html', 'communications.html', 'contact.html', 'cotation.html',
  'fournisseur-oeufs-haiti.html', 'social.html',
  'girard-gumel-j-henry.html', 'mentions-legales.html',
  'politique-confidentialite.html'
];
const sitemap = read('sitemap.xml');
const imageSitemap = read('sitemap-images.xml');
const robots = read('robots.txt');
const errors = [];
const titles = new Set();
const canonicals = new Set();
const fail = (file, message) => errors.push(file + ': ' + message);
const meta = (html, name, attr) => [...html.matchAll(/<meta\b[^>]*>/gi)]
  .map(x => x[0]).filter(tag => tag.includes(attr + '="' + name + '"'))
  .map(tag => tag.match(/\bcontent="([^"]*)"/i)?.[1]).filter(Boolean);
const canonical = html => [...html.matchAll(/<link\b[^>]*>/gi)]
  .map(x => x[0]).filter(tag => /\brel="canonical"/i.test(tag))
  .map(tag => tag.match(/\bhref="([^"]+)"/i)?.[1]).filter(Boolean);

for (const file of pages) {
  const html = read(file);
  const head = html.split('</head>')[0];
  const title = head.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) fail(file, 'missing title');
  else if (titles.has(title)) fail(file, 'duplicate title: ' + title);
  else titles.add(title);
  // The browser title and shared-link titles should describe the same page.
  if (title && meta(head, 'og:title', 'property')[0] !== title) fail(file, 'og:title differs from title');
  if (title && meta(head, 'twitter:title', 'name')[0] !== title) fail(file, 'twitter:title differs from title');
  const description = meta(head, 'description', 'name');
  if (description.length !== 1 || description[0].trim().length < 30) fail(file, 'missing/short or duplicate description');
  const urls = canonical(head);
  if (urls.length !== 1 || !urls[0].startsWith('https://www.zepoulayiti.com/')) fail(file, 'missing/invalid canonical');
  else {
    if (canonicals.has(urls[0])) fail(file, 'duplicate canonical');
    canonicals.add(urls[0]);
    if (!sitemap.includes('<loc>' + urls[0] + '</loc>')) fail(file, 'canonical missing from sitemap.xml');
    if (meta(head, 'og:url', 'property')[0] !== urls[0]) fail(file, 'Open Graph URL differs from canonical');
  }
  if (!/<html\b[^>]*\blang="fr"/i.test(html)) fail(file, 'missing French lang');
  if ((html.match(/<h1\b/gi) || []).length !== 1) fail(file, 'expected exactly one h1');
  if (meta(head, 'robots', 'name').some(v => /\bnoindex\b/i.test(v))) fail(file, 'public page marked noindex');
  if (meta(head, 'og:locale', 'property')[0] !== 'fr_HT') fail(file, 'missing Open Graph locale fr_HT');
  for (const key of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:image', 'og:image:alt']) {
    if (meta(head, key, 'property').length !== 1) fail(file, 'missing/duplicate ' + key);
  }
  for (const key of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
    if (meta(head, key, 'name').length !== 1) fail(file, 'missing/duplicate ' + key);
  }
  for (const image of [meta(head, 'og:image', 'property')[0], meta(head, 'twitter:image', 'name')[0]]) {
    if (image && !image.startsWith('https://www.zepoulayiti.com/')) fail(file, 'unexpected image host');
  }
  for (const data of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(data[1]); } catch { fail(file, 'invalid JSON-LD'); }
  }
}
for (const page of ['merci.html', '404.html', 'admin.html']) {
  const head = read(page).split('</head>')[0];
  if (!meta(head, 'robots', 'name').some(v => /\bnoindex\b/i.test(v))) fail(page, 'private/utility page must be noindex');
}
for (const name of ['sitemap.xml', 'sitemap-images.xml']) {
  if (!robots.includes('Sitemap: https://www.zepoulayiti.com/' + name)) fail('robots.txt', 'missing ' + name);
}
if (!imageSitemap.includes('<image:loc>https://www.zepoulayiti.com/oeufs-30-zepoul.webp</image:loc>')) {
  fail('sitemap-images.xml', 'missing published 30-egg product image');
}
if (/<image:(?:caption|title|geo_location|license)>/.test(imageSitemap)) {
  fail('sitemap-images.xml', 'deprecated Google image sitemap metadata remains');
}
for (const account of [
  'https://www.facebook.com/p/Zepoul-Ayiti-61578818947873/',
  'https://www.instagram.com/zepoul_ayiti/',
  'https://www.tiktok.com/@zepoul.ayiti',
  'https://x.com/Zepoul_Ayiti'
]) {
  if (!read('index.html').includes(account)) fail('index.html', 'missing official social identity: ' + account);
}

// Guard against the orphan pages highlighted by the November 2026 audit.
for (const [source, target] of [
  ['index.html', '/vision/'],
  ['vision.html', '/expertise/'],
  ['about.html', '/girard-gumel-j-henry/'],
  ['index.html', '/social/']
]) {
  if (!read(source).includes('href="' + target + '"')) {
    fail(source, 'missing crawlable internal link to ' + target);
  }
}
for (const page of [
  'contact.html', 'cotation.html', 'mentions-legales.html',
  'politique-confidentialite.html'
]) {
  if (!read(page).includes('application/ld+json')) fail(page, 'missing structured data');
}

// Maintain truthful brand aliases for recognizable navigation and search snippets.
try {
  const home = read('index.html');
  const jsonlds = [...home.matchAll(/<script\\b[^>]*type="application\\/ld\\+json"[^>]*>([\\s\\S]*?)<\\/script>/gi)]
    .map(match => JSON.parse(match[1]));
  const organization = jsonlds.find(data => data['@id'] === 'https://www.zepoulayiti.com/#organization');
  const website = jsonlds.find(data => data['@id'] === 'https://www.zepoulayiti.com/#website');
  for (const [label, data] of [['Organization', organization], ['WebSite', website]]) {
    if (!data || data.name !== 'Zepoul Ayiti') fail('index.html', label + ' official name not found');
    for (const alias of ['Zepoul', 'Zepoulayiti', 'GL Zepoul Peyi']) {
      if (!data || !Array.isArray(data.alternateName) || !data.alternateName.includes(alias)) {
        fail('index.html', label + ' missing validated alias ' + alias);
      }
    }
  }
} catch {
  fail('index.html', 'invalid brand JSON-LD');
}

if (errors.length) {
  for (const message of errors) console.error('FAIL ' + message);
  console.error(errors.length + ' SEO check(s) failed.');
  process.exitCode = 1;
} else {
  console.log('PASS SEO metadata and sitemap checks on ' + pages.length + ' public pages.');
}
