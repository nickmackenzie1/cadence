'use strict';
/* Recipes: read the schema.org Recipe data from a recipe page (skipping the life story). */
const { safeFetch } = require('../lib/net');
const { decode } = require('./company');

// ---- recipes: read schema.org Recipe JSON-LD from a recipe page (skips the life story) ----
const isoDur = d => { const m = String(d || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i); if (!m) return 0; return (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0); };
function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  const t = node['@type']; if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
  for (const k of ['@graph', 'mainEntity', 'itemListElement']) if (node[k]) { const r = findRecipe(node[k]); if (r) return r; }
  return null;
}
const txt = v => decode(String(v == null ? '' : v).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
function steps(ins) {
  const out = [];
  const walk = x => { if (!x) return; if (typeof x === 'string') { x.split(/\n+/).map(txt).filter(Boolean).forEach(s => out.push(s)); return; } if (Array.isArray(x)) return x.forEach(walk);
    if (x['@type'] === 'HowToSection') { if (x.name) out.push('## ' + txt(x.name)); return walk(x.itemListElement); } if (x.text || x.name) out.push(txt(x.text || x.name)); };
  walk(ins); return out.slice(0, 80);
}
// JSON-LD as sites really write it: wrapped in comments or CDATA, with raw tabs and line breaks inside strings
function ldBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim().replace(/^<!--|-->$/g, '').replace(/^\/\*\s*<!\[CDATA\[\s*\*\/|\/\*\s*\]\]>\s*\*\/$/g, '').replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();
    for (const t of [raw, raw.replace(/\r?\n/g, '\\n').replace(/[\u0000-\u001f]/g, ' '), raw.replace(/[\u0000-\u001f]+/g, ' ')]) { try { out.push(JSON.parse(t)); break; } catch {} }
  }
  return out;
}
// no JSON-LD: read the recipe card itself (WP Recipe Maker, Tasty Recipes, Mediavine Create, schema.org microdata)
function fromCard(html) {
  const grab = re => [...html.matchAll(re)].map(m => txt(m[1])).filter(Boolean);
  const blocks = [
    [/<li[^>]*class=["'][^"']*\bwprm-recipe-ingredient\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi, /<div[^>]*class=["'][^"']*\bwprm-recipe-instruction-text\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi],
    [/<li[^>]*data-tr-ingredient-checkbox[^>]*>([\s\S]*?)<\/li>|<div[^>]*class=["'][^"']*tasty-recipes?-ingredients[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, /<li[^>]*id=["']instruction-step-\d+["'][^>]*>([\s\S]*?)<\/li>/gi],
    [/<li[^>]*class=["'][^"']*\bmv-create-ingredients?\b[^"']*["'][^>]*>([\s\S]*?)<\/li>|<div[^>]*class=["']mv-create-ingredients["'][^>]*>[\s\S]*?<\/div>/gi, /<li[^>]*id=["']mv_create_\d+_\d+["'][^>]*>([\s\S]*?)<\/li>/gi],
    [/<[^>]+itemprop=["'](?:recipeIngredient|ingredients)["'][^>]*>([\s\S]*?)<\/(?:li|span|p|div)>/gi, /<[^>]+itemprop=["']recipeInstructions["'][^>]*>([\s\S]*?)<\/(?:li|ol|div|p)>/gi],
  ];
  for (const [ing, ins] of blocks) {
    const ingredients = grab(ing), steps = grab(ins);
    if (ingredients.length >= 2) return { ingredients, steps };
  }
  return null;
}
async function getPage(u) {
  const opts = { timeout: 20000, headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' } };
  try { return await safeFetch(u, opts, 6 * 1024 * 1024); }
  catch (e) {
    // some recipe sites turn away anything that doesn't look like a plain browser: ask once more as one
    if (!/HTTP (403|406|429|503)/.test(e.message)) throw e;
    return safeFetch(u, { ...opts, headers: { ...opts.headers, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' } }, 6 * 1024 * 1024);
  }
}
// recipe-scrapers (user, 2026-11-18; MIT, vendored as one file in server/vendor): scrapers for hundreds of named
// recipe sites plus a general schema.org reader. Its answer first; ours (parseRecipe) when it has nothing.
let RS = null;
const rsLib = () => RS || (RS = import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '..', 'vendor', 'recipe-scrapers.mjs')).href).catch(() => null));
async function viaScrapers(html, url) {
  const L = await rsLib(); if (!L) return null;
  try {
    const S = L.getScraper(url, { wildMode: true });
    const o = await new S(html, url, { fallbackAuthor: '-', fallbackDescription: '-', fallbackYield: '0' }).toRecipeObject();
    const ingredients = (o.ingredients || []).flatMap(g => (g.items || []).map(i => txt(i.value))).filter(Boolean);
    if (!ingredients.length) return null;
    const steps = (o.instructions || []).flatMap(g => [...(g.name && (o.instructions.length > 1 || g.name) ? ['## ' + txt(g.name)] : []), ...(g.items || []).map(i => txt(i.value))]).filter(x => x && x !== '## ');
    return { url, name: txt(o.title).slice(0, 200), image: o.image || '', description: o.description === '-' ? '' : txt(o.description).slice(0, 400),
      servings: parseInt(o.yields) || null, minutes: o.totalTime || ((o.prepTime || 0) + (o.cookTime || 0)) || null,
      ingredients: ingredients.slice(0, 80), steps: steps.slice(0, 80), tags: [...(o.category || []), ...(o.cuisine || [])].map(txt).filter(Boolean).slice(0, 6),
      site: new URL(url).hostname.replace(/^www\./, '') };
  } catch (e) { return null; }
}
async function readRecipe(u) {
  const r = await getPage(u), html = r.buf.toString('utf8');
  const a = await viaScrapers(html, r.url); if (a) return a;
  return parseRecipe(html, r.url);
}
function parseRecipe(html, url) {
  let rec = null;
  for (const b of ldBlocks(html)) { rec = findRecipe(b); if (rec) break; }
  const meta = n => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]+content=["']([^"']+)`, 'i')) || [])[1] || '';
  const site = new URL(url).hostname.replace(/^www\./, ''), title = txt(meta('og:title')) || txt((html.match(/<title>([^<]*)/i) || [])[1]);
  if (!rec || !(rec.recipeIngredient || rec.ingredients || []).length) {
    const card = fromCard(html);
    if (card) return { url, name: txt(rec && rec.name) || title, image: meta('og:image'), description: txt(meta('og:description')).slice(0, 400), servings: null, minutes: null, ingredients: card.ingredients.slice(0, 80), steps: card.steps.slice(0, 80), tags: [], site };
    if (!rec) return { url, name: title, image: meta('og:image'), ingredients: [], steps: [], partial: true };
  }
  const img = Array.isArray(rec.image) ? rec.image[0] : rec.image; const image = typeof img === 'object' && img ? img.url : img;
  const y = Array.isArray(rec.recipeYield) ? rec.recipeYield.find(x => /\d/.test(x)) || rec.recipeYield[0] : rec.recipeYield;
  const list = v => (Array.isArray(v) ? v : v ? String(v).split(',') : []).map(txt).filter(Boolean).slice(0, 6);
  const ing = rec.recipeIngredient || rec.ingredients || [];
  return { url, name: txt(rec.name).slice(0, 200), image: image ? String(image) : meta('og:image'), description: txt(rec.description).slice(0, 400),
    servings: parseInt(txt(y)) || null, minutes: isoDur(rec.totalTime) || isoDur(rec.prepTime) + isoDur(rec.cookTime) || null,
    ingredients: (Array.isArray(ing) ? ing : [ing]).map(txt).filter(Boolean).slice(0, 80), steps: steps(rec.recipeInstructions),
    tags: [...list(rec.recipeCategory), ...list(rec.recipeCuisine)].slice(0, 6), site };
}

module.exports = { findRecipe, isoDur, readRecipe, parseRecipe, viaScrapers, steps, txt };
