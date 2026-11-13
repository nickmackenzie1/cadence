/* Grammar: Harper (Automattic, Apache-2.0), a grammar checker that runs entirely in your browser. Nothing you
   write leaves the page. The engine is public/vendor/harper (WebAssembly, ~8 MB over the wire, cached after the first
   time) and only loads once you start writing in a text box.

   Checks multi-line text boxes (task notes, meeting notes, descriptions…) while you type: problems get a wavy
   underline drawn on a mirror layer behind the text, and putting the caret on one shows Harper's message with its
   suggestions to click. "Ignore" hides that one, "Add to dictionary" teaches it a word (synced, for all your devices).
   Skips code and JSON boxes, and anything marked data-no-grammar. */
(() => {
  const esc = window.CadenceKit.esc, css = window.CadenceKit.css;
  const G = window.__harper = window.__harper || { linter: null, loading: null, ignored: new Set(), keep: new Set() };
  const DIALECTS = { Canadian: 3, American: 0, British: 1, Australian: 2, Indian: 4 };
  const SKIP = '#dev-code,#imp-json,#copy-fallback,[data-no-grammar],[readonly],[disabled]';
  // single-line boxes that hold writing (quick add everywhere, the meeting's action item box); search boxes are left alone
  const LINES = '#qa,#m-in,.qa input,.m-add input,input[data-grammar]';
  // quick-add syntax isn't English: @client, ^owner, >dev, !1, #tag
  const TOKEN = /[@^>!#][\w.-]*/g;
  // common slips, fixed as soon as you finish the word (before Harper has even loaded)
  const SLIPS = { teh: 'the', hte: 'the', ther: 'the', th: 'the', adn: 'and', nad: 'and', taht: 'that', thta: 'that', wiht: 'with', jsut: 'just', becuase: 'because', becasue: 'because',
    recieve: 'receive', seperate: 'separate', definately: 'definitely', occured: 'occurred', untill: 'until', wich: 'which', alot: 'a lot', thier: 'their', freind: 'friend',
    tommorow: 'tomorrow', tomorow: 'tomorrow', tommorrow: 'tomorrow', dont: "don't", doesnt: "doesn't", didnt: "didn't", isnt: "isn't", wasnt: "wasn't", arent: "aren't", cant: "can't",
    couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't", youre: "you're", theyre: "they're", thats: "that's", whats: "what's", im: "I'm", ive: "I've", i: 'I', u: 'you', ur: 'your',
    pls: 'please', plz: 'please', thx: 'thanks', mtg: 'meeting', recieved: 'received', accross: 'across', adress: 'address', calender: 'calendar', goverment: 'government', wierd: 'weird',
    beleive: 'believe', enviroment: 'environment', existance: 'existence', foward: 'forward', gaurd: 'guard', happend: 'happened', independant: 'independent', knowlege: 'knowledge',
    neccessary: 'necessary', occassion: 'occasion', persue: 'pursue', posession: 'possession', publically: 'publicly', reccomend: 'recommend', recomend: 'recommend', truely: 'truly' };
  const edits = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); } return d[a.length][b.length]; };
  const caseLike = (from, to) => (from === from.toUpperCase() && from.length > 1 ? to.toUpperCase() : from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);
  const KIND_CLASS = k => (/spell/i.test(k) ? 'spell' : /style|readab|wordch|redund|repet/i.test(k) ? 'style' : 'grammar');

  Cadence.registerPlugin({
    id: 'harper', name: 'Grammar (Harper)', version: '1.0.0', category: 'Productivity', spaces: ['work', 'life'],
    description: 'A private grammar and spelling checker (Harper, by Automattic) that runs entirely in your browser. Underlines problems as you write (quick add, meeting notes, task notes and titles), fixes clear slips as you type (Backspace undoes), with one-click fixes, a personal dictionary and your choice of English.',
    tagline: 'Grammar checking that never leaves your browser', color: '#2563eb',
    icon: '<path d="m4 7 4 10 4-10"/><path d="M14 15h6"/><path d="M14 11h6"/><path d="m15 19 2 2 4-4"/>',
    setup(api) {
      if (G.cleanup) G.cleanup();   // setup runs again when plugins are rebuilt: drop the previous run's listeners
      const cfg = () => ({ on: true, auto: true, dialect: 'Canadian', words: [], ...(api.storage.get('cfg') || {}) });
      const save = p => { api.storage.set('cfg', { ...cfg(), ...p }); };

      async function linter() {
        if (G.linter) return G.linter;
        return G.loading = G.loading || (async () => {
          const m = await import(new URL('vendor/harper/index.js', document.baseURI).href);
          const { binary } = await import(new URL('vendor/harper/binary.js', document.baseURI).href);
          const make = Ctor => new Ctor({ binary, dialect: DIALECTS[cfg().dialect] ?? 3 });
          // on the page: Harper's worker build only answers once the engine is also loaded here, so it saves nothing.
          // After the first load a check takes a few milliseconds, and typing is debounced.
          const l = make(m.LocalLinter); await l.lint('Ready.');
          const words = cfg().words; if (words.length) await l.importWords(words);
          G.mod = m; G.linter = l; return l;
        })().catch(e => { G.loading = null; console.warn('Harper could not start', e); return null; });
      }

      // ---- the mirror: same box, same font, same wrapping, transparent text, underlined spans. It sits ON TOP of the
      // text box (clicks pass through), so it also works for text boxes inside dialogs. ----
      const COPY = ['boxSizing', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'textIndent', 'wordSpacing', 'tabSize', 'textAlign', 'direction'];
      let cur = null;   // { ta, mirror, lints:[{start,end,lint,kind}], text, timer, raf }
      const want = ta => ta && (ta.tagName === 'TEXTAREA' || (ta.tagName === 'INPUT' && ta.matches(LINES))) && !ta.matches(SKIP) && !/mono|courier|consol/i.test(getComputedStyle(ta).fontFamily) && cfg().on;

      // Harper counts characters, the browser counts UTF-16 units: convert once per check
      const toUnits = text => { const map = [0]; let u = 0; for (const ch of text) { u += ch.length; map.push(u); } return i => map[Math.min(i, map.length - 1)]; };

      function attach(ta) {
        if (cur && cur.ta === ta) return;
        detach();
        const mirror = document.createElement('div'); mirror.className = 'hp-mirror'; mirror.setAttribute('aria-hidden', 'true');
        document.body.appendChild(mirror);
        ta.dataset.hpSpell = ta.spellcheck ? '1' : '0'; ta.spellcheck = false;   // one set of squiggles, not two
        cur = { ta, mirror, lints: [], text: null, timer: 0 };
        ta.addEventListener('input', onInput); ta.addEventListener('keydown', onKeyUndo); ta.addEventListener('scroll', place); ta.addEventListener('click', onCaret); ta.addEventListener('keyup', onCaret); ta.addEventListener('blur', onBlur);
        const loop = () => { if (!cur || cur.ta !== ta) return; place(); if (cur && cur.ta === ta) cur.raf = requestAnimationFrame(loop); }; loop();   // place() detaches if the box left the page
        check(); linter();
      }
      function detach() {
        if (!cur) return;
        const { ta, mirror } = cur;
        ta.removeEventListener('input', onInput); ta.removeEventListener('keydown', onKeyUndo); ta.removeEventListener('scroll', place); ta.removeEventListener('click', onCaret); ta.removeEventListener('keyup', onCaret); ta.removeEventListener('blur', onBlur);
        if (ta.dataset.hpSpell === '1') ta.spellcheck = true;
        cancelAnimationFrame(cur.raf); clearTimeout(cur.timer); mirror.remove(); cur = null; closePop();
      }
      function place() {
        if (!cur) return;
        const { ta, mirror } = cur;
        if (!ta.isConnected) return detach();
        const r = ta.getBoundingClientRect(), cs = getComputedStyle(ta);
        if (!r.width || !r.height) { mirror.style.display = 'none'; return; }
        mirror.style.display = '';
        for (const k of COPY) mirror.style[k] = cs[k];
        Object.assign(mirror.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderStyle: 'solid', borderColor: 'transparent' });
        if (ta.tagName === 'INPUT') {   // one line, vertically centred, scrolls sideways
          const inner = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
          Object.assign(mirror.style, { whiteSpace: 'pre', overflowWrap: 'normal', lineHeight: Math.max(0, inner) + 'px' });
        }
        mirror.scrollTop = ta.scrollTop; mirror.scrollLeft = ta.scrollLeft;
      }
      function paint() {
        if (!cur) return;
        const { ta, mirror, lints } = cur, text = ta.value;
        let html = '', at = 0;
        const fl = cur.flash && cur.flash.until > Date.now() ? [{ start: cur.flash.start, end: cur.flash.end, kind: 'fixed' }] : [];
        for (const l of [...lints, ...fl].sort((a, b) => a.start - b.start)) { if (l.start < at) continue; html += esc(text.slice(at, l.start)) + `<mark class="hp-${l.kind}">${esc(text.slice(l.start, l.end))}</mark>`; at = l.end; }
        mirror.innerHTML = html + esc(text.slice(at)) + '​';
        place();
      }
      const onInput = e => { if (!cur) return; cur.lints = []; paint(); clearTimeout(cur.timer); cur.timer = setTimeout(check, 450); closePop(); if (e && !e.hpAuto) autocorrect(e); };

      // ---- autocorrect: when you finish a word (space or punctuation), a clear slip is fixed in place.
      // Backspace straight after puts your word back and leaves it alone from then on. ----
      let last = null;   // { ta, start, from, to, after }
      async function autocorrect(e) {
        if (!cfg().auto || e.inputType !== 'insertText' || !/^[\s.,!?;:)]$/.test(e.data || '')) { if (e.inputType !== 'deleteContentBackward') last = null; return; }
        const ta = cur.ta, pos = ta.selectionStart, before = ta.value.slice(0, pos);
        const m = before.match(/(^|[^\w'@^>!#.\/-])([A-Za-z][A-Za-z']*)([\s.,!?;:)])$/); if (!m) return;
        const word = m[2], start = pos - m[3].length - word.length, key = word.toLowerCase();
        if (G.keep.has(key) || cfg().words.some(w => w.toLowerCase() === key)) return;
        let to = Object.prototype.hasOwnProperty.call(SLIPS, key) ? SLIPS[key] : null;
        if (to === 'I' || key === 'i') to = 'I'; else if (to) to = caseLike(word, to);
        if (!to && word.length >= 4 && word[0] === word[0].toLowerCase() && G.linter) {
          // Harper's first spelling suggestion, only when it's a near miss (one or two letters off)
          const text = ta.value; let lints; try { lints = await G.linter.lint(text, { language: 'plaintext' }); } catch { return; }
          if (!cur || cur.ta !== ta || ta.value !== text) return;
          const u = toUnits(text), hit = lints.find(x => { const s = x.span(); return u(s.start) === start && u(s.end) === start + word.length && /spell/i.test(x.lint_kind_pretty()); });
          const s0 = hit && hit.suggestions()[0], cand = s0 && s0.get_replacement_text().trim();
          if (cand && /^[A-Za-z' ]+$/.test(cand) && edits(word, cand) <= (word.length <= 5 ? 1 : 2)) to = caseLike(word, cand);
        }
        if (!to || to === word || ta.value.slice(start, start + word.length) !== word) return;
        const caret = ta.selectionStart;
        ta.setRangeText(to, start, start + word.length, 'preserve');
        const nc = caret + (to.length - word.length); ta.setSelectionRange(nc, nc);
        last = { ta, start, from: word, to, at: nc };
        const ev = new Event('input', { bubbles: true }); ev.hpAuto = true; ta.dispatchEvent(ev);
        G.fixed = (G.fixed || 0) + 1; flash(start, to.length);
      }
      function flash(start, len) {   // the corrected word glows blue for a moment
        if (!cur) return; cur.flash = { start, end: start + len, until: Date.now() + 1400 }; paint(); setTimeout(() => cur && paint(), 1450);
      }
      const onKeyUndo = e => {
        if (e.key !== 'Backspace' || !last || !cur || last.ta !== cur.ta || cur.ta.selectionStart !== last.at || cur.ta.selectionEnd !== last.at) { if (e.key !== 'Shift') last = null; return; }
        e.preventDefault();
        const ta = cur.ta, { start, from, to } = last;
        if (ta.value.slice(start, start + to.length) !== to) { last = null; return; }
        ta.setRangeText(from, start, start + to.length, 'preserve');
        const nc = last.at - (to.length - from.length); ta.setSelectionRange(nc, nc);   // keeps the space you typed
        G.keep.add(from.toLowerCase()); last = null;
        const ev = new Event('input', { bubbles: true }); ev.hpAuto = true; ta.dispatchEvent(ev);
      };
      const onBlur = () => setTimeout(() => { if (cur && document.activeElement !== cur.ta && !document.querySelector('.hp-pop:hover')) { if (!pop) detach(); } }, 150);

      async function check() {
        if (!cur) return;
        const ta = cur.ta, text = ta.value;
        if (!text.trim()) { cur.lints = []; paint(); return; }
        const l = await linter(); if (!l || !cur || cur.ta !== ta || ta.value !== text) return;
        let raw; try { raw = await l.lint(text, { language: 'plaintext' }); } catch (e) { console.warn('Harper lint failed', e); return; }
        if (!cur || cur.ta !== ta || ta.value !== text) return;
        const u = toUnits(text);
        cur.lints = raw.map(x => { const s = x.span(); return { start: u(s.start), end: u(s.end), lint: x, kind: KIND_CLASS(x.lint_kind_pretty()) }; })
          .filter(x => x.end > x.start && !G.ignored.has(x.lint.lint_kind_pretty() + '|' + text.slice(x.start, x.end)))
          .filter(x => ta.tagName !== 'INPUT' || ![...text.matchAll(TOKEN)].some(m => x.start < m.index + m[0].length && x.end > m.index))
          .sort((a, b) => a.start - b.start);
        cur.text = text; ta.dataset.hpCount = cur.lints.length; paint();
      }

      // ---- the suggestions popover, for the problem under the caret ----
      let pop = null;
      const closePop = () => { if (pop) { pop.remove(); pop = null; } };
      function onCaret(e) {
        if (!cur || e.type === 'keyup' && !/Arrow|Home|End|Page/.test(e.key)) return;
        const pos = cur.ta.selectionStart, hit = cur.lints.find(l => pos >= l.start && pos <= l.end);
        if (!hit || cur.ta.selectionEnd !== pos) return closePop();
        showPop(hit);
      }
      function showPop(hit) {
        closePop();
        const idx = cur.lints.indexOf(hit), mark = cur.mirror.querySelectorAll('mark')[idx]; if (!mark) return;
        const r = mark.getBoundingClientRect(), word = cur.ta.value.slice(hit.start, hit.end), seenS = new Set();
        const sugg = hit.lint.suggestions().filter(x => { const k = x.kind() + '|' + x.get_replacement_text().trim(); if (seenS.has(k)) return false; seenS.add(k); return true; });   // Harper sometimes offers the same fix twice
        pop = document.createElement('div'); pop.className = 'hp-pop'; pop.dataset.keepOpen = '';   // clicks here don't close the task editor
        pop.innerHTML = `<div class="hp-k hp-${hit.kind}">${esc(hit.lint.lint_kind_pretty())}</div><div class="hp-msg">${esc(hit.lint.message().replace(/`/g, ''))}</div>
          <div class="hp-sugg">${sugg.slice(0, 5).map((s, i) => { const t = s.get_replacement_text(); return `<button class="btn" data-i="${i}">${t ? esc(t.trim() || t) : s.kind() === 1 ? 'Remove' : 'Fix'}</button>`; }).join('')}</div>
          <div class="hp-foot"><button data-ignore>Ignore</button>${hit.kind === 'spell' ? `<button data-dict>Add “${esc(word)}” to dictionary</button>` : ''}</div>`;
        document.body.appendChild(pop);
        const pr = pop.getBoundingClientRect();
        pop.style.left = Math.max(8, Math.min(innerWidth - pr.width - 8, r.left)) + 'px';
        pop.style.top = (r.bottom + 6 + pr.height > innerHeight ? r.top - pr.height - 6 : r.bottom + 6) + 'px';
        pop.onmousedown = e => e.preventDefault();   // keep the caret in the text box
        pop.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
          const ta = cur.ta, s = sugg[+b.dataset.i], l = await linter(); closePop();
          const fixed = await l.applySuggestion(ta.value, hit.lint, s);
          const diffEnd = fixed.length - (ta.value.length - hit.end);
          ta.value = fixed; ta.setSelectionRange(diffEnd, diffEnd); ta.focus();
          ta.dispatchEvent(new Event('input', { bubbles: true }));   // the app saves as if you typed it
        });
        pop.querySelector('[data-ignore]').onclick = () => { G.ignored.add(hit.lint.lint_kind_pretty() + '|' + word); closePop(); check(); };
        const dict = pop.querySelector('[data-dict]');
        if (dict) dict.onclick = async () => { const words = [...new Set([...cfg().words, word])]; save({ words }); const l = await linter(); await l.importWords([word]); closePop(); check(); api.ui.toast(`Added “${word}” to your dictionary`); };
      }

      // ---- watch focus anywhere in the app ----
      const onFocus = e => { const t = e.target; if (want(t)) attach(t); else if (cur && t !== cur.ta && !(pop && pop.contains(t))) detach(); };
      const onDown = e => { if (pop && !pop.contains(e.target) && (!cur || e.target !== cur.ta)) closePop(); };
      const onEsc = e => { if (e.key === 'Escape' && pop) { closePop(); e.stopPropagation(); } };
      document.addEventListener('focusin', onFocus); document.addEventListener('mousedown', onDown, true); addEventListener('keydown', onEsc, true);
      G.cleanup = () => { document.removeEventListener('focusin', onFocus); document.removeEventListener('mousedown', onDown, true); removeEventListener('keydown', onEsc, true); detach(); };
      if (want(document.activeElement)) attach(document.activeElement);
      // load the engine in the background soon after the app opens, so the first typo doesn't wait for it
      if (cfg().on && !G.linter && !G.loading) { const go = () => linter(); 'requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 6000 }) : setTimeout(go, 2500); }
      window.__harper.check = () => check(); window.__harper.state = () => (cur ? { count: cur.lints.length, ready: !!G.linter } : null);

      function settings() {
        const c = cfg();
        api.ui.modal('Grammar', `<label class="xm-row"><input type="checkbox" id="hp-on" ${c.on ? 'checked' : ''}> Check grammar and spelling as you write</label>
          <label class="xm-row"><input type="checkbox" id="hp-auto" ${c.auto ? 'checked' : ''}> Autocorrect clear slips when you finish a word (“ther” → “the”). Backspace right after undoes it.</label>
          <div class="field"><label>English</label><select class="inp" id="hp-dialect" style="width:auto">${Object.keys(DIALECTS).map(d => `<option ${d === c.dialect ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
          <div class="field"><label>Your dictionary</label><div class="hp-words">${c.words.length ? c.words.map(w => `<span class="chip">${esc(w)}<button data-rm="${esc(w)}" aria-label="Remove ${esc(w)}">${api.ui.icon('x')}</button></span>`).join(' ') : '<span class="muted">Words you add show up here.</span>'}</div></div>
          <p class="muted" style="font-size:12px">Runs in your browser with Harper (Automattic, Apache-2.0). Nothing you write is sent anywhere.</p>`, '<button class="btn primary" data-act="close-modal">Done</button>');
        const el = document.getElementById('modal');
        el.querySelector('#hp-on').onchange = e => { save({ on: e.target.checked }); if (!e.target.checked) detach(); };
        el.querySelector('#hp-auto').onchange = e => save({ auto: e.target.checked });
        el.querySelector('#hp-dialect').onchange = e => { save({ dialect: e.target.value }); G.linter = null; G.loading = null; };   // the next check starts with the new English
        el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { save({ words: cfg().words.filter(w => w !== b.dataset.rm) }); G.linter = null; G.loading = null; settings(); });
      }
      api.onSettings(settings);
      api.commands.add({ title: 'Grammar settings', run: settings });

      css('hp-css', `
        .hp-mirror{position:fixed;z-index:4500;pointer-events:none;overflow:hidden;white-space:pre-wrap;overflow-wrap:break-word;word-wrap:break-word;color:transparent;background:transparent;margin:0}
        .hp-mirror mark{color:transparent;background:none;border-radius:0;text-decoration:underline wavy;text-decoration-thickness:1.5px;text-underline-offset:3px;text-decoration-skip-ink:none}
        .hp-mirror .hp-fixed{text-decoration:underline solid;text-decoration-color:#3b82f6;text-decoration-thickness:2px;background:rgba(59,130,246,.12);border-radius:2px} .hp-mirror .hp-spell{text-decoration-color:#e5484d} .hp-mirror .hp-grammar{text-decoration-color:#3b82f6} .hp-mirror .hp-style{text-decoration-color:#d4a017}
        .hp-pop{position:fixed;z-index:5000;width:min(320px,calc(100vw - 16px));background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:var(--r-l);box-shadow:0 10px 30px rgba(0,0,0,.18);padding:10px 12px;font-size:13px}
        .hp-k{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}.hp-k.hp-spell{color:#e5484d}.hp-k.hp-grammar{color:#3b82f6}.hp-k.hp-style{color:#b8860b}
        .hp-msg{margin-bottom:8px}.hp-sugg{display:flex;flex-wrap:wrap;gap:6px}.hp-sugg .btn{font-weight:600}
        .hp-foot{display:flex;gap:12px;margin-top:8px;border-top:1px solid var(--line);padding-top:6px}.hp-foot button{border:0;background:none;color:var(--muted);font-size:12px;cursor:pointer;padding:0}.hp-foot button:hover{color:var(--text)}
        .hp-words .chip{display:inline-flex;align-items:center;gap:2px}.hp-words .chip button{border:0;background:none;color:var(--muted);cursor:pointer;display:grid;place-items:center;padding:0 0 0 4px}.hp-words svg{width:12px;height:12px}`);
    }
  });
})();
