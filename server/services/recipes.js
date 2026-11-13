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
async function readRecipe(u) {
  const r = await safeFetch(u, {}, 4 * 1024 * 1024), html = r.buf.toString('utf8');
  let rec = null;
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { rec = findRecipe(JSON.parse(m[1].trim())); } catch {} if (rec) break; }
  const meta = n => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]+content=["']([^"']+)`, 'i')) || [])[1] || '';
  if (!rec) return { url: r.url, name: txt(meta('og:title')) || txt((html.match(/<title>([^<]*)/i) || [])[1]), image: meta('og:image'), ingredients: [], steps: [], partial: true };
  const img = Array.isArray(rec.image) ? rec.image[0] : rec.image; const image = typeof img === 'object' && img ? img.url : img;
  const y = Array.isArray(rec.recipeYield) ? rec.recipeYield.find(x => /\d/.test(x)) || rec.recipeYield[0] : rec.recipeYield;
  const list = v => (Array.isArray(v) ? v : v ? String(v).split(',') : []).map(txt).filter(Boolean).slice(0, 6);
  return { url: r.url, name: txt(rec.name).slice(0, 200), image: image ? String(image) : meta('og:image'), description: txt(rec.description).slice(0, 400),
    servings: parseInt(txt(y)) || null, minutes: isoDur(rec.totalTime) || isoDur(rec.prepTime) + isoDur(rec.cookTime) || null,
    ingredients: (rec.recipeIngredient || rec.ingredients || []).map(txt).filter(Boolean).slice(0, 80), steps: steps(rec.recipeInstructions),
    tags: [...list(rec.recipeCategory), ...list(rec.recipeCuisine)].slice(0, 6), site: new URL(r.url).hostname.replace(/^www\./, '') };
}

module.exports = { findRecipe, isoDur, readRecipe, steps, txt };
