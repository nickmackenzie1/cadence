// Works out Music Radar's "Called it" off the main thread (2026-11-17: on the NAS it took long enough to stop the app
// answering). Its own database connections; the result goes back to radar.js, which keeps it.
import { workerData, parentPort } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";
const X = await import("./lib/extras.mjs"), S = await import("./lib/store.mjs");
let heavySince = () => [];
if (workerData.kexp) {
  const d = new DatabaseSync(workerData.dbFile, { readOnly: true });
  d.exec("PRAGMA busy_timeout = 10000");
  heavySince = (s) => d.prepare("SELECT MIN(artist) AS artist, MIN(airdate) AS t FROM kexp_plays WHERE airdate >= ? AND rotation = 'Heavy' GROUP BY artist COLLATE NOCASE").all(Math.floor(s));
}
try {
  const v = X.calledIt(null, { heavySince, artistOf: (k) => S.artistRecord(k), fresh: true, limit: 200 });
  parentPort.postMessage({ v: { all: v.all.slice(0, 200), count: v.count, median: v.median } });
} catch (e) { parentPort.postMessage({ error: e.message }); }
