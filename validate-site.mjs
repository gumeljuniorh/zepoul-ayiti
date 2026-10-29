import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, posix, resolve } from "node:path";

const root = process.cwd();
function pageFiles(directory = "") {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || ["shared", "scripts", "node_modules"].includes(entry.name)) return [];
    const path = posix.join(directory, entry.name);
    return entry.isDirectory() ? pageFiles(path) : extname(path) === ".html" ? [path] : [];
  });
}
const htmlFiles = pageFiles().sort();
const cssFiles = readdirSync(root).filter((file) => extname(file) === ".css").sort();
const errors = [];

function report(file, message) {
  errors.push(`${file}: ${message}`);
}

function normalizeReference(reference, fromFile = "index.html") {
  const clean = reference.trim().split(/[?#]/, 1)[0];
  if (!clean || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(clean)) return null;
  if (clean === "/") return "index.html";
  const path = decodeURIComponent(clean);
  const target = path.startsWith("/") ? path.slice(1) : posix.join(dirname(fromFile), path);
  return path.endsWith("/") ? posix.join(target, "index.html") : target;
}

function checkReference(file, reference) {
  const localPath = normalizeReference(reference, file);
  if (!localPath) return;
  if (!existsSync(resolve(root, localPath))) {
    report(file, `reference locale introuvable: ${reference}`);
  }
}

function checkAnchor(file, reference) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(reference)) return;
  const [page, fragment] = reference.split("#");
  if (!fragment) return;
  const target = normalizeReference(page, file) || file;
  if (!target.endsWith(".html") || !existsSync(resolve(root, target))) return;
  const ids = [...readFileSync(resolve(root, target), "utf8").matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  if (!ids.includes(decodeURIComponent(fragment))) report(file, `ancre introuvable: ${reference}`);
}

for (const file of htmlFiles) {
  const html = readFileSync(resolve(root, file), "utf8");
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const redirect = html.match(/<meta[^>]*http-equiv="refresh"[^>]*content="0; url=([^"]+)"/i)?.[1];
  if (redirect && /-(en|es|ht)\.html$/.test(file)) {
    try {
      const target = new URL(redirect);
      if (target.protocol !== "https:" || !["zepoulayiti.com", "www.zepoulayiti.com"].includes(target.hostname)) report(file, "redirection hors domaine");
      checkReference(file, target.pathname);
      if (!/name="robots"[^>]*content="noindex,follow"/.test(html)) report(file, "redirection sans noindex");
    } catch { report(file, "redirection invalide"); }
    continue;
  }
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (!/<html\b[^>]*\blang=["']fr["']/i.test(html)) report(file, "langue de page fr manquante");
  if (!/<title>[^<]+<\/title>/i.test(html)) report(file, "balise title manquante ou vide");
  if (!/<meta\s+name=["']description["'][^>]+content=["'][^"']+["']/i.test(html)) {
    report(file, "meta description manquante ou vide");
  }
  if (h1Count !== 1) report(file, `la page doit contenir exactement un H1 (trouve: ${h1Count})`);
  if (duplicateIds.length) report(file, `identifiants dupliques: ${[...new Set(duplicateIds)].join(", ")}`);

  if (html.includes('aria-label="Navigation principale"')) {
    const menus = [
      ["ordinateur", html.match(/<nav\b[^>]*aria-label="Navigation principale"[^>]*>([\s\S]*?)<\/nav>/i)?.[1]],
      ["mobile", html.match(/<div\b[^>]*id="mobile-menu"[^>]*>([\s\S]*?)<\/div>/i)?.[1]],
    ];
    const expected = [
      ["Accueil", "index.html"], ["Nos produits", "services.html"],
      ["Notre exploitation", "expertise.html"], ["Notre développement", "vision.html"],
      ["Partenaires", "index.html#partenaires"], ["À propos", "about.html"],
      ["Contact", "index.html#commande"], ["Demander une cotation", "index.html#commande"]
    ];
    for (const [name, markup] of menus) {
      const links = [...(markup || "").matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi)];
      const entries = [...(markup || "").matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
        .filter((link) => !/^https?:/i.test(link[1]))
        .map((link) => {
          const url = new URL(link[1], "https://www.zepoulayiti.com/" + file);
          return [link[2].replace(/<[^>]+>/g, "").trim(), url.pathname.slice(1) + url.search + url.hash];
        });
      if (JSON.stringify(entries) !== JSON.stringify(expected)) {
        report(file, `menu ${name}: ordre, libelles ou destinations incorrects`);
      }
      const communications = links.filter((link) => normalizeReference(link[1], file) === "communications.html");
      if (communications.length !== 0) report(file, `menu ${name}: Communications doit rester dans le pied de page`);
    }
  }

  if (html.includes('aria-label="Navigation principale"')) {
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] || "";
    const links = [...footer.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi)];
    if (links.filter((link) => normalizeReference(link[1], file) === "communications.html").length !== 1) {
      report(file, "pied de page: lien Communications absent ou duplique");
    }
  }

  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  const noindex = /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html);
  if (!noindex) {
    const route = file === "index.html" ? "" : file.replace(/\/index\.html$/, "/");
    if (canonical !== "https://www.zepoulayiti.com/" + route) report(file, "URL canonique incorrecte");
    const ogUrl = html.match(/<meta\b[^>]*property="og:url"[^>]*content="([^"]+)"/i)?.[1];
    if (ogUrl !== canonical) report(file, "URL Open Graph absente ou différente de la canonique");
  }
  for (const current of html.matchAll(/<a\b([^>]*aria-current="page"[^>]*)>/gi)) {
    const href = current[1].match(/href="([^"]+)"/)?.[1];
    if (!href || normalizeReference(href, file) !== file) report(file, "aria-current pointe vers une autre page");
  }
  const desktopMenu = html.match(/<nav\b[^>]*aria-label="Navigation principale"[^>]*>([\s\S]*?)<\/nav>/i)?.[1];
  const mobileMenu = html.match(/<div\b[^>]*id="mobile-menu"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (desktopMenu && mobileMenu) {
    const targets = (markup) => [...markup.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].slice(0, 8).map((m) => m[1]).join("|");
    if (targets(desktopMenu) !== targets(mobileMenu)) report(file, "destinations ordinateur/mobile différentes");
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(match[1])) report(file, "image sans attribut alt");
  }

  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    if (/\btarget=["']_blank["']/i.test(match[1]) && !/\brel=["'][^"']*\bnoopener\b[^"']*["']/i.test(match[1])) {
      report(file, "lien target=_blank sans rel=noopener");
    }
    const href = match[1].match(/\bhref=["']([^"']+)["']/i);
    if (href) checkAnchor(file, href[1]);
  }

  for (const label of html.matchAll(/<label\b[^>]*\bfor=["']([^"']+)["']/gi)) {
    if (!ids.includes(label[1])) report(file, `champ du label introuvable: ${label[1]}`);
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
  for (const match of xml.matchAll(/<(?:image:)?loc>([^<]+)<\/(?:image:)?loc>/g)) {
    try {
      const url = new URL(match[1]);
      if (["zepoulayiti.com", "www.zepoulayiti.com"].includes(url.hostname)) checkReference(sitemap, url.pathname);
    } catch {
      report(sitemap, `URL invalide: ${match[1]}`);
    }
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
