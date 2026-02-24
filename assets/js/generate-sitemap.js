const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function toIsoDate(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function normalizePath(p) {
  if (!p) return "/";
  if (!p.startsWith("/")) return `/${p}`;
  return p;
}

function joinUrl(baseUrl, basePath, pagePath) {
  const base = normalizeBaseUrl(baseUrl);
  const bp = normalizePath(basePath || "/");
  const pp = normalizePath(pagePath || "/");

  const combined = (bp === "/" ? pp : `${bp.replace(/\/$/, "")}${pp === "/" ? "/" : pp}`);
  return `${base}${combined}`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function validateChangefreq(v) {
  const allowed = new Set(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]);
  return allowed.has(v) ? v : null;
}

function validatePriority(v) {
  if (typeof v !== "number") return null;
  if (v < 0 || v > 1) return null;
  return Math.round(v * 10) / 10;
}

function generateSitemapXml(config) {
  const today = toIsoDate(new Date());

  const baseUrl = normalizeBaseUrl(config.site.baseUrl);
  const defaultChangefreq = config.site.defaultChangefreq || null;
  const defaultPriority = typeof config.site.defaultPriority === "number" ? config.site.defaultPriority : null;

  const locales = config.locales || {};
  const urls = [];

  for (const localeKey of Object.keys(locales)) {
    const locale = locales[localeKey];
    const basePath = locale.basePath || "/";

    const pages = Array.isArray(locale.pages) ? locale.pages : [];
    for (const page of pages) {
      const loc = joinUrl(baseUrl, basePath, page.path);

      const lastmod = page.lastmod ? String(page.lastmod) : today;
      const changefreq = validateChangefreq(page.changefreq || defaultChangefreq);
      const priority = validatePriority(
        typeof page.priority === "number" ? page.priority : defaultPriority
      );

      urls.push({
        loc,
        lastmod,
        changefreq,
        priority
      });
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const u of urls) {
    if (seen.has(u.loc)) continue;
    seen.add(u.loc);
    deduped.push(u);
  }

  deduped.sort((a, b) => a.loc.localeCompare(b.loc));

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  for (const u of deduped) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(u.loc)}</loc>`);
    lines.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
    if (u.changefreq) lines.push(`    <changefreq>${escapeXml(u.changefreq)}</changefreq>`);
    if (u.priority !== null) lines.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  lines.push("");

  return lines.join("\n");
}

function generateRobotsTxt(config, sitemapPath) {
  const baseUrl = normalizeBaseUrl(config.site.baseUrl);
  const sitemapUrl = `${baseUrl}${sitemapPath.startsWith("/") ? "" : "/"}${sitemapPath}`;

  const lines = [];
  lines.push("User-agent: *");
  lines.push("Allow: /");
  lines.push("");
  lines.push(`Sitemap: ${sitemapUrl}`);
  lines.push("");

  return lines.join("\n");
}

function main() {
  const projectRoot = process.cwd();

  const dataPath = path.join(projectRoot, "data", "urls.json");
  const outSitemapPath = path.join(projectRoot, "sitemap.xml");
  const outRobotsPath = path.join(projectRoot, "robots.txt");

  if (!fs.existsSync(dataPath)) {
    process.stderr.write(`Missing ${dataPath}\n`);
    process.exit(1);
  }

  const config = readJson(dataPath);

  if (!config.site || !config.site.baseUrl) {
    process.stderr.write("urls.json must include site.baseUrl\n");
    process.exit(1);
  }

  const sitemapXml = generateSitemapXml(config);
  fs.writeFileSync(outSitemapPath, sitemapXml, "utf8");

  const robotsTxt = generateRobotsTxt(config, "/sitemap.xml");
  fs.writeFileSync(outRobotsPath, robotsTxt, "utf8");

  process.stdout.write(`Wrote ${outSitemapPath}\n`);
  process.stdout.write(`Wrote ${outRobotsPath}\n`);
}

main();