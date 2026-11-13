/**
 * Pull years of old posts from the Arctic Shift archive and build long-term trends.
 * It samples each month (several pages spread across the month) rather than reading
 * every post, so a 10-year backfill of one sub takes ~20–40 minutes, not days.
 * Safe to stop and re-run: finished months are skipped.
 * Cadence runs it from the Music Radar view ("Pull the archive").
 */
import { archivePage, aggregateMonth, loadHistory, saveHistory } from "./lib/history.mjs";
import { ruleExtract, extractAll } from "./lib/extract.mjs";

// Cadence: the same loop as a function (was a command-line script)
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export async function backfill({ subs = "listentothis,indieheads,hiphopheads,electronicmusic,popheads,Emo,shoegaze".split(","), from = new Date().getFullYear() - 10, samples = 3, ai = false, log = console.log, stop = () => false } = {}) {
  const fromYear = Number(from), useAI = !!ai;
  const hist = loadHistory();
  const nowD = new Date();
  for (const sub of subs) {
    hist[sub] ||= {};
    for (let y = fromYear; y <= nowD.getUTCFullYear(); y++) {
      for (let mo = 1; mo <= 12; mo++) {
        if (stop()) return;
        const month = `${y}-${String(mo).padStart(2, "0")}`;
        if (new Date(Date.UTC(y, mo, 1)) > nowD) break;           // don't backfill the current/future month
        if (hist[sub][month]) continue;                           // already done
        const posts = [];
        for (let s = 0; s < samples; s++) {
          const day = 1 + Math.floor((s * 28) / samples);
          const iso = `${month}-${String(day).padStart(2, "0")}`;
          try { posts.push(...(await archivePage(sub, iso))); }
          catch (e) { log(`  ! r/${sub} ${iso}: ${e.message}`); await pause(5000); }
          await pause(800);
        }
        const unique = [...new Map(posts.map((p) => [p.id, p])).values()];
        const ext = useAI ? await extractAll(unique) : Object.fromEntries(unique.map((p) => [p.id, ruleExtract(p)]));
        hist[sub][month] = aggregateMonth(unique, ext);
        saveHistory(hist);
        log(`r/${sub} ${month}: ${unique.length} posts, ${hist[sub][month].music} music`);
      }
    }
  }
  log("Backfill done.");
}
