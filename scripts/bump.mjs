// Bump the release number before every push (user, 2026-11-13: "new release numbers every time, even if not
// significant"). Patch by default; `node scripts/bump.mjs minor` or `major` for bigger steps.
// Writes public/version.json (what the app and server show, live without a rebuild) and package.json.
import fs from 'node:fs';
const kind = process.argv[2] || 'patch';
const vf = new URL('../public/version.json', import.meta.url), pf = new URL('../package.json', import.meta.url);
const cur = JSON.parse(fs.readFileSync(vf, 'utf8')).version.split('.').map(Number);
const next = kind === 'major' ? [cur[0] + 1, 0, 0] : kind === 'minor' ? [cur[0], cur[1] + 1, 0] : [cur[0], cur[1], cur[2] + 1];
const v = next.join('.');
fs.writeFileSync(vf, JSON.stringify({ version: v, date: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
const p = JSON.parse(fs.readFileSync(pf, 'utf8')); p.version = v; fs.writeFileSync(pf, JSON.stringify(p, null, 2) + '\n');
console.log(v);
