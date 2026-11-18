// Type checking without a build step (user, 2026-11-17). Runs TypeScript over the app's own scripts (tsconfig.json)
// using types/cadence.d.ts for the plugin API, and fails on the two kinds of mistake that break things at runtime:
//   - a plugin using part of the API that doesn't exist (api.ui.toats, api.tasks.lst, a call renamed in core.js)
//   - a name used that's defined nowhere (a misspelled variable, a function another file never handed over)
// tsc reports much more for plain JavaScript (mostly DOM types it can't see through); those are counted, not fatal.
// Usage: npm run typecheck   (CI runs it before the tests)   --all prints every finding.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const r = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--pretty', 'false'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lines = (r.stdout + r.stderr).split('\n').filter(l => /error TS\d+/.test(l));
const FATAL = l => /'Cadence(Api\w*|PluginDef|Global)'/.test(l) || /error TS(2304|2552|2551.*'Cadence)/.test(l);
const bad = lines.filter(FATAL);
if (process.argv.includes('--all')) for (const l of lines) console.log(l);
for (const l of bad) console.log(l);
console.log(`typecheck: ${bad.length ? bad.length + ' problem' + (bad.length === 1 ? '' : 's') : 'no problems'} with the plugin API or undefined names` +
  ` (${lines.length - bad.length} other notes from TypeScript, not checked; --all lists them)`);
process.exit(bad.length ? 1 : 0);
