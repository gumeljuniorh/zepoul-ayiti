import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = process.cwd();
const htmlFiles = readdirSync(root).filter((file) => extname(file) === ".html").sort();
const cssFiles = readdirSync(root).filter((file) => extname(file) === ".css").sort();
const errors = [];

function report(file, message) {
  errors.push(`${file}: ${message}`);
}

function normalizeReference(reference) {
  const clean = reference.trim().split(/[?#]/, 1)[0];
  if (!clean || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(clean)) return null;
  if (clean === "/") return "index.html";
  return decodeURIComponent(clean.replace(/^\//, ""));
}

function checkReference(file, reference) {
  const localPath = normalizeReference(reference);
  if (!localPath) return;
  if (!existsSync(resolve(root, localPath))) {
    report(file, `reference locale introuvable: ${reference}`);
  }
}

for (const file of htmlFiles) {
  const html = readFileSync(resolve(root, file), "utf8");
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (!/<html\b[^>]*\blang=["']fr["']/i.test(html)) report(file, "langue de page fr manquante");
  if (!/<title>[^<]+<\/title>/i.test(html)) report(file, "balise title manquante ou vide");
  if (!/<meta\s+name=["']description["'][^>]+content=["'][^"']+["']/i.test(html)) {
    report(file, "meta description manquante ou vide");
  }
  if (h1Count !== 1) report(file, `la page doit contenir exactement un H1 (trouve: ${h1Count})`);
  if (duplicateIds.length) report(file, `identifiants dupliques: ${[...new Set(duplicateIds)].join(", ")}`);

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(match[1])) report(file, "image sans attribut alt");
  }

  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    if (/\btarget=["']_blank["']/i.test(match[1]) && !/\brel=["'][^"']*\bnoopener\b[^"']*["']/i.test(match[1])) {
      report(file, "lien target=_blank sans rel=noopener");
    }
  }

  for (const match of html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      report(file, `JSON-LD invalide: ${error.message}`);
    }
  }

  for (const match of html.matchAll(/\s(?:href|src|poster|data-src)=["']([^"']+)["']/gi)) {
    checkReference(file, match[1]);
  }

  for (const match of html.matchAll(/\s(?:srcset|data-srcset)=["']([^"']+)["']/gi)) {
    match[1].split(",").forEach((candidate) => {
      checkReference(file, candidate.trim().split(/\s+/, 1)[0]);
    });
  }
}

const manifestPath = resolve(root, "site.webmanifest");
if (!existsSync(manifestPath)) {
  report("site.webmanifest", "fichier manquant");
} else {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const icon of manifest.icons || []) checkReference("site.webmanifest", icon.src || "");
  } catch (error) {
    report("site.webmanifest", `JSON invalide: ${error.message}`);
  }
}

for (const file of cssFiles) {
  const css = readFileSync(resolve(root, file), "utf8");
  for (const match of css.matchAll(/url\((?:["']?)([^)"']+)(?:["']?)\)/gi)) {
    checkReference(file, match[1]);
  }
}

for (const sitemap of ["sitemap.xml", "sitemap-images.xml"]) {
  if (!existsSync(resolve(root, sitemap))) {
    report(sitemap, "fichier manquant");
    continue;
  }

  const xml = readFileSync(resolve(root, sitemap), "utf8");
  if (!/<urlset\b/i.test(xml) || !/<\/urlset>/i.test(xml)) {
    report(sitemap, "structure XML urlset invalide");
  }
}

if (!existsSync(resolve(root, "robots.txt"))) {
  report("robots.txt", "fichier manquant");
} else {
  const robots = readFileSync(resolve(root, "robots.txt"), "utf8");
  if (!/^User-agent:\s*\*/im.test(robots)) report("robots.txt", "directive User-agent manquante");
  if (!/^Sitemap:\s*https:\/\//im.test(robots)) report("robots.txt", "directive Sitemap manquante");
}

if (errors.length) {
  console.error("Validation echouee:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validation reussie: ${htmlFiles.length} pages HTML et ${cssFiles.length} feuilles CSS controlees.`);
}
