/* Reads a song's tempo, key and energy from its 30-second preview (Music Radar, 2026-11-17), with Essentia.js
   (Music Technology Group, UPF; AGPL-3.0; vendor/essentia). A worker, so the page never waits on it.
   In: { id, pcm: Float32Array (mono, 44.1 kHz) }   Out: { id, bpm, key, scale, dance, loud } or { id, error } */
let ready = null;
function load() {
  if (!ready) ready = new Promise((ok, no) => {
    try {
      // this build of Essentia expects a page: give it the two things it reads (where it was loaded from, a title)
      if (typeof document === 'undefined') self.document = { currentScript: { src: self.location.href }, title: '' };
      importScripts('vendor/essentia/essentia-wasm.web.js', 'vendor/essentia/essentia.js-core.umd.js');
      // the browser build: a factory that fetches its .wasm next to it
      self.EssentiaWASM({ locateFile: f => 'vendor/essentia/' + f }).then(W => ok(new self.Essentia(W)), no);
    } catch (e) { no(e); }
  });
  return ready;
}
self.onmessage = async ({ data }) => {
  const { id, pcm } = data || {};
  try {
    const e = await load(), v = e.arrayToVector(pcm);
    const r = e.RhythmExtractor2013(v), k = e.KeyExtractor(v), d = e.Danceability(v), c = e.DynamicComplexity(v);
    const out = { id, bpm: Math.round(r.bpm * 10) / 10, bpmSure: Math.round(r.confidence * 100) / 100, key: k.key, scale: k.scale, keySure: Math.round(k.strength * 100) / 100,
      dance: Math.round(d.danceability * 100) / 100, loud: Math.round(c.loudness * 10) / 10 };
    v.delete && v.delete();
    self.postMessage(out);
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};
