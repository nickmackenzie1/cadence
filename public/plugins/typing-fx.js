/* Typing effects: your typing makes things happen at the caret.
   Fire (embers rise, the box glows hot when you type fast), Ice (frost crystals shed from the caret, the box frosts over),
   Typewriter (clacks, a bell and the carriage return on Enter, ink specks), Confetti (a puff per word, a burst on Enter),
   Power (combo counter and a little shake as you get going), and Nib, a sticky-note helper with opinions who pops up
   with Cadence tips for what you're typing in quick add.
   One canvas that only runs while particles are alive. Off for password fields; particles off for reduced motion. */
(() => {
  const MODES = [['off', 'Off'], ['fire', 'Fire'], ['ice', 'Ice'], ['typewriter', 'Typewriter'], ['confetti', 'Confetti'], ['power', 'Power'], ['helper', 'Helper only']];
  const KEY = 'cadence.typing';
  const DEF = { mode: 'off', helper: true, sound: true, where: 'all', amount: 1, matter: true };
  const G = window.__tfx = window.__tfx || {};

  Cadence.registerPlugin({
    id: 'typing-fx', name: 'Typing effects', version: '1.0.0', category: 'Look & feel', spaces: ['work', 'life'],
    description: 'Make typing fun: fire, ice, typewriter clacks, confetti or power mode at your caret, plus Nib, a sticky-note helper who chimes in with quick-add tips.',
    tagline: 'Fire, ice, typewriter, confetti, and a helper', color: '#f97316',
    icon: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    settings() { G.settings && G.settings(); },
    setup(api) {
      G.teardown && G.teardown();
      const opts = () => { let v = null; try { v = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} return Object.assign({}, DEF, v || {}); };
      let o = opts();
      // real matter: fire and ice go into the shared Elements layer (they rise, melt snow, settle on cards)
      let fx = null; const wantFx = () => { if (o.matter !== false && (o.mode === 'fire' || o.mode === 'ice') && window.CadenceFX) window.CadenceFX.world().then(w => { fx = w; }); };
      wantFx();
      const save = n => { o = Object.assign({}, o, n); try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} styleBox(); helperCheck(); wantFx(); };
      const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
      const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

      /* ---------- where the caret is ---------- */
      const TYPABLE = 'input:not([type]),input[type=text],input[type=search],input[type=email],input[type=url],textarea,[contenteditable="true"],[contenteditable=""]';
      let mirror = null;
      function caretXY(el) {
        if (el.isContentEditable) { const s = getSelection(); if (!s.rangeCount) return null; const r = s.getRangeAt(0).cloneRange(); r.collapse(true); let b = r.getClientRects()[0]; if (!b) { const e = el.getBoundingClientRect(); return { x: e.left + 8, y: e.top + 12, h: 16 }; } return { x: b.left, y: b.top + b.height / 2, h: b.height }; }
        const cs = getComputedStyle(el), er = el.getBoundingClientRect();
        if (!mirror) { mirror = document.createElement('div'); mirror.setAttribute('aria-hidden', 'true'); document.body.appendChild(mirror); }
        const st = mirror.style;
        for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'textTransform', 'wordSpacing', 'textIndent', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'tabSize']) st[p] = cs[p];
        const ta = el.tagName === 'TEXTAREA';
        Object.assign(st, { position: 'fixed', visibility: 'hidden', left: er.left + 'px', top: er.top + 'px', width: er.width + 'px', whiteSpace: ta ? 'pre-wrap' : 'pre', overflowWrap: ta ? 'break-word' : 'normal', overflow: 'hidden', borderStyle: 'solid', height: 'auto' });
        const pos = el.selectionStart == null ? el.value.length : el.selectionStart;
        mirror.textContent = el.value.slice(0, pos); const mk = document.createElement('span'); mk.textContent = '​'; mirror.appendChild(mk);
        const mr = mk.getBoundingClientRect(), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
        let x = mr.left - el.scrollLeft, y = mr.top - el.scrollTop + mr.height / 2;
        if (!ta) y = er.top + er.height / 2;
        x = Math.max(er.left + 4, Math.min(er.right - 4, x)); y = Math.max(er.top + 4, Math.min(er.bottom - 4, y));
        return { x, y, h: lh };
      }

      /* ---------- particles ---------- */
      let cv = null, cx = null, parts = [], raf = 0, last = 0, DPR = 1;
      const canvas = () => { if (cv) return; cv = document.createElement('canvas'); cv.id = 'tfx-cv'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv); cx = cv.getContext('2d'); size(); };
      const size = () => { if (!cv) return; DPR = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; };
      const run = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
      const CONF = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff8fab', '#00c2a8'];
      function tick(t) {
        const dt = Math.min(3, Math.max(0, (t - last) / 16.67)) || 1; last = t;
        cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, innerWidth, innerHeight);
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.life -= dt / p.max;
          if (p.life <= 0 || !isFinite(p.x + p.y + p.life)) { parts.splice(i, 1); continue; }
          p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          const a = Math.min(1, p.life * 1.6);
          if (p.k === 'fire') {
            const L = p.life, r = p.r * (.4 + L * .9);
            const col = L > .7 ? `rgba(255,${200 + 55 * (L - .7) / .3 | 0},120,${a})` : L > .35 ? `rgba(255,${90 + 110 * (L - .35) / .35 | 0},20,${a})` : `rgba(${110 + 120 * L | 0},${60 + 60 * L | 0},50,${a * .45})`;
            cx.globalCompositeOperation = L > .35 ? 'lighter' : 'source-over';
            const gr = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,80,0,0)');
            cx.fillStyle = gr; cx.beginPath(); cx.arc(p.x, p.y, r, 0, 6.283); cx.fill(); cx.globalCompositeOperation = 'source-over';
            p.vx += (Math.random() - .5) * .25 * dt;
          } else if (p.k === 'ice') {
            cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.globalAlpha = a; cx.strokeStyle = p.c; cx.lineWidth = 1.1; cx.shadowColor = 'rgba(160,210,255,.9)'; cx.shadowBlur = 4;
            cx.beginPath(); for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3; cx.moveTo(0, 0); cx.lineTo(Math.cos(an) * p.r, Math.sin(an) * p.r); const m = p.r * .55; cx.moveTo(Math.cos(an) * m, Math.sin(an) * m); cx.lineTo(Math.cos(an + .5) * p.r * .8, Math.sin(an + .5) * p.r * .8); }
            cx.stroke(); cx.restore();
          } else if (p.k === 'ink') {
            cx.globalAlpha = a * .8; cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r * (1 - p.life * .3), 0, 6.283); cx.fill(); cx.globalAlpha = 1;
          } else if (p.k === 'conf') {
            cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.scale(1, Math.cos(p.rot * 2.3)); cx.globalAlpha = a; cx.fillStyle = p.c; cx.fillRect(-p.r, -p.r * .45, p.r * 2, p.r * .9); cx.restore();
          } else if (p.k === 'spark') {
            cx.globalAlpha = a; cx.strokeStyle = p.c; cx.lineWidth = 1.6; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5); cx.stroke(); cx.globalAlpha = 1;
          } else if (p.k === 'text') {
            cx.globalAlpha = a; cx.font = `800 ${p.r}px ui-rounded,system-ui,sans-serif`; cx.fillStyle = p.c; cx.textAlign = 'center'; cx.fillText(p.s, p.x, p.y); cx.globalAlpha = 1;
          }
        }
        if (parts.length) raf = requestAnimationFrame(tick); else { raf = 0; cx.clearRect(0, 0, innerWidth, innerHeight); }
      }
      const add = p => { if (!isFinite(p.x) || !isFinite(p.y)) return; if (parts.length > 900) parts.shift(); parts.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: .98, rot: 0, vr: 0, life: 1, max: 40, r: 3, c: '#fff' }, p)); };

      /* ---------- sound (typewriter) ---------- */
      let ac = null;
      const audio = () => { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} return ac; };
      function clack(kind) {
        if (!o.sound) return; const a = audio(); if (!a) return; const t = a.currentTime;
        if (kind === 'bell') { for (const [f, d] of [[2093, 1.1], [3140, .7]]) { const os = a.createOscillator(), g = a.createGain(); os.type = 'sine'; os.frequency.value = f; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); os.connect(g).connect(a.destination); os.start(t); os.stop(t + d); } }
        const len = kind === 'return' ? .22 : .045, buf = a.createBuffer(1, a.sampleRate * len | 0, a.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, kind === 'return' ? 1.5 : 4);
        const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
        src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = kind === 'return' ? 900 : kind === 'space' ? 1400 : 2400 + Math.random() * 900; bp.Q.value = kind === 'return' ? .7 : 1.4;
        g.gain.value = kind === 'return' ? .35 : .5; src.connect(bp).connect(g).connect(a.destination); src.start(t + (kind === 'bell' ? .18 : 0));
      }

      /* ---------- the box itself reacts ---------- */
      let heat = 0, heatEl = null, heatT = 0;
      function warm(el, mode) {
        el = el.closest('.qa,.m-add,.inp') || el;   // glow the whole box, not just the bare input inside it
        heat = Math.min(1, heat + .09); heatEl && heatEl !== el && heatEl.style.removeProperty('--tfx-h'); heatEl = el;
        el.dataset.tfx = mode; el.style.setProperty('--tfx-h', heat.toFixed(2));
        clearInterval(heatT); heatT = setInterval(() => { heat = Math.max(0, heat - .04); if (heatEl) heatEl.style.setProperty('--tfx-h', heat.toFixed(2)); if (heat <= 0) { clearInterval(heatT); heatEl && (delete heatEl.dataset.tfx, heatEl.style.removeProperty('--tfx-h')); } }, 80);
      }

      /* ---------- per keystroke ---------- */
      let combo = 0, comboT = 0, lastKey = 0, comboEl = null;
      function onKey(e) {
        const el = e.target; if (!el || !el.matches || !el.matches(TYPABLE) || el.type === 'password' || !api.plugins.enabled('typing-fx')) return;
        if (o.where === 'qa' && el.id !== 'qa') return;
        const k = e.key, printable = k.length === 1, enter = k === 'Enter', back = k === 'Backspace';
        if (!printable && !enter && !back) return;
        if (o.mode === 'off' || o.mode === 'helper') return;
        if (o.mode === 'typewriter') clack(enter ? 'return' : k === ' ' ? 'space' : 'key');
        if (o.mode === 'typewriter' && enter) clack('bell');
        if (reduced()) return;
        // read the caret after the character lands
        requestAnimationFrame(() => {
          const c = caretXY(el); if (!c) return; canvas(); const A = o.amount;
          const now = performance.now(), fast = now - lastKey < 140; lastKey = now;
          if (o.mode === 'fire' && fx && o.matter !== false) {
            fx.spawn(c.x, c.y - 3, fx.M.FIRE, enter ? 7 : back ? 1 : 2, enter ? 0.5 : 0.45, 12, 30 * A);
            if (!back) fx.spawn(c.x, c.y + c.h * .25, fx.M.EMBER, 1, 0.3, 15, 40);
            fx.heatAt(c.x, c.y, enter ? 500 : 220, enter ? 2 : 1);
            if (fast || enter) warm(el, 'fire');
            dispatchEvent(new CustomEvent('cadence:heat', { detail: { x: c.x, y: c.y, r: enter ? 110 : 55, power: enter ? 6 : 2.5 } }));
          } else if (o.mode === 'ice' && fx && o.matter !== false) {
            fx.spawn(c.x, c.y - 2, fx.M.SNOW, enter ? 6 : back ? 1 : 2, enter ? 0.6 : 0.5);
            warm(el, 'ice');
          } else if (o.mode === 'fire') {
            const n = Math.round((enter ? 26 : back ? 3 : 7) * A);
            for (let i = 0; i < n; i++) add({ k: 'fire', x: c.x + (Math.random() - .5) * (enter ? 60 : 6), y: c.y + c.h * .3, vx: (Math.random() - .5) * .8, vy: -1 - Math.random() * 1.6, g: -.03, drag: .97, r: 5 + Math.random() * 6, max: 34 + Math.random() * 26 });
            if (fast || enter) warm(el, 'fire');
            // the flame melts any snow around it (Christmas mode turns it into running water)
            dispatchEvent(new CustomEvent('cadence:heat', { detail: { x: c.x, y: c.y, r: enter ? 110 : 55, power: enter ? 6 : 2.5 } }));
          } else if (o.mode === 'ice') {
            const n = Math.round((enter ? 14 : back ? 1 : 3) * A);
            for (let i = 0; i < n; i++) add({ k: 'ice', x: c.x + (Math.random() - .5) * 6, y: c.y, vx: (Math.random() - .5) * 1.8, vy: -1.2 - Math.random() * 1.5, g: .07, drag: .985, r: 3 + Math.random() * 4.5, vr: (Math.random() - .5) * .12, c: Math.random() < .5 ? '#e8f6ff' : '#a9d8ff', max: 55 + Math.random() * 30 });
            warm(el, 'ice');
          } else if (o.mode === 'typewriter') {
            add({ k: 'ink', x: c.x + (Math.random() - .5) * 3, y: c.y + (Math.random() - .5) * 4, r: 1 + Math.random() * 1.6, c: getComputedStyle(el).color, max: 26 });
            el.classList.remove('tfx-jolt'); void el.offsetWidth; el.classList.add('tfx-jolt');
            if (enter) { el.classList.remove('tfx-return'); void el.offsetWidth; el.classList.add('tfx-return'); }
          } else if (o.mode === 'confetti') {
            const n = Math.round((enter ? 70 : k === ' ' ? 14 : 2) * A);
            for (let i = 0; i < n; i++) { const an = -Math.PI / 2 + (Math.random() - .5) * (enter ? 2.6 : 1.6), sp = (enter ? 4 : 2.4) + Math.random() * (enter ? 5 : 2.5);
              add({ k: 'conf', x: c.x, y: c.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: .12, drag: .965, r: 2.5 + Math.random() * 2.5, vr: (Math.random() - .5) * .35, c: CONF[(Math.random() * CONF.length) | 0], max: 60 + Math.random() * 40 }); }
          } else if (o.mode === 'power') {
            combo = fast || combo === 0 ? combo + 1 : 1; clearTimeout(comboT); comboT = setTimeout(() => { combo = 0; comboEl && comboEl.classList.remove('on'); }, 2200);
            const col = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5b5bd6', n = Math.round((4 + Math.min(10, combo / 6)) * A);
            for (let i = 0; i < n; i++) { const an = Math.random() * 6.283, sp = 1.5 + Math.random() * (2 + combo / 25); add({ k: 'spark', x: c.x, y: c.y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 1, g: .15, drag: .95, c: i % 3 ? col : '#ffd166', max: 22 + Math.random() * 16 }); }
            if (combo >= 10) { const s = Math.min(5, 1 + combo / 25); document.body.style.transform = `translate(${(Math.random() - .5) * s}px,${(Math.random() - .5) * s}px)`; clearTimeout(G.shk); G.shk = setTimeout(() => document.body.style.transform = '', 70); }
            if (combo && combo % 25 === 0) add({ k: 'text', s: combo >= 100 ? 'UNSTOPPABLE' : combo >= 50 ? 'ON FIRE' : 'NICE', x: c.x, y: c.y - 20, vy: -.7, drag: 1, r: 18, c: col, max: 70 });
            if (!comboEl) { comboEl = document.createElement('div'); comboEl.id = 'tfx-combo'; document.body.appendChild(comboEl); }
            if (combo >= 5) { const er = el.getBoundingClientRect(); comboEl.innerHTML = `<b>${combo}</b><span>combo</span>`; comboEl.style.left = Math.min(innerWidth - 90, er.right - 70) + 'px'; comboEl.style.top = Math.max(4, er.top - 46) + 'px'; comboEl.classList.add('on'); comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop'); }
          }
          run();
        });
      }

      /* ---------- Nib: a sticky-note helper with tips for quick add ---------- */
      let nib = null, nibT = 0, tipT = 0, shown = new Set(), lastTip = 0;
      const TIPS = [
        { id: 'client', test: v => { const cl = api.clients.list().find(c => c.name.length > 2 && !/@/.test(v) && new RegExp('\\b' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(v)); return cl && `Looks like this one is for <b>${esc(cl.name)}</b>. Type <code>@${esc(cl.name.split(/\s+/)[0].toLowerCase())}</code> and I'll file it there.`; } },
        { id: 'owe', test: v => /^(waiting on|chase|ask|get|need)\b.*\b(from|to send|for)\b/i.test(v) && !/\^/.test(v) && 'Sounds like the ball is in their court. Start with <code>^</code> and it lands in Waiting.' },
        { id: 'dev', test: v => /\b(dev|developer|build|deploy|script|deluge|api)\b/i.test(v) && !/>dev/.test(v) && 'Handing this to the dev? Add <code>&gt;dev</code>. It still shows on your Today.' },
        { id: 'urgent', test: v => /\b(urgent|asap|today!|critical|blocker)\b/i.test(v) && !/!1/.test(v) && 'Urgent, huh. <code>!1</code> makes it top priority.' },
        { id: 'when', test: v => /\b(tomorrow|next week|monday|tuesday|wednesday|thursday|friday)\b/i.test(v) && !/\b(tmrw|tom|mon|tue|wed|thu|fri)\b/i.test(v) && v.length > 25 && 'Dates work in plain words too: <code>fri 3pm</code>, <code>tmrw</code>, <code>next mon</code>.' },
        { id: 'ticket', test: v => /\b(zoho support|ticket|partnersupport)\b/i.test(v) && 'Opening a Zoho ticket for a client? Save it as a follow-up so you remember to check back.' },
        { id: 'long', test: v => v.length > 90 && "That's a whole paragraph. Keep the title short and put the rest in the task's notes." },
        { id: 'tag', test: v => /\b(invoice|billing|quote)\b/i.test(v) && !/#/.test(v) && 'Want to find these later? Tag it: <code>#billing</code>.' },
      ];
      const NIB_SVG = `<svg viewBox="0 0 64 64" width="56" height="56"><path class="nb-note" d="M8 6h48v40l-12 12H8z"/><path class="nb-fold" d="M44 58V46h12z"/><g class="nb-eyes"><ellipse cx="24" cy="26" rx="6" ry="7" fill="#fff"/><ellipse cx="40" cy="26" rx="6" ry="7" fill="#fff"/><circle class="nb-p" cx="24" cy="27" r="3"/><circle class="nb-p" cx="40" cy="27" r="3"/></g><path class="nb-mouth" d="M25 39q7 5 14 0" fill="none"/><path class="nb-brow" d="M18 16l10 2M46 16l-10 2" fill="none"/></svg>`;
      function helperCheck() { if (!(o.helper || o.mode === 'helper')) { nib && nib.remove(); nib = null; } }
      function say(html) {
        if (!nib) { nib = document.createElement('div'); nib.id = 'tfx-nib'; nib.innerHTML = `<div class="nb-b"><div class="nb-t"></div><div class="nb-a"><button data-nb="ok">Thanks</button><button data-nb="mute">No more tips</button></div></div><div class="nb-c" title="Nib">${NIB_SVG}</div>`; document.body.appendChild(nib);
          nib.addEventListener('click', e => { const b = e.target.closest('[data-nb]'); if (!b) return; if (b.dataset.nb === 'mute') { save({ helper: false }); api.ui.toast('Nib will keep quiet. Turn tips back on in Typing effects.'); } hide(); }); }
        nib.querySelector('.nb-t').innerHTML = html; nib.classList.remove('out'); nib.classList.add('on'); clearTimeout(nibT); nibT = setTimeout(hide, 9000);
      }
      const hide = () => { if (!nib) return; nib.classList.add('out'); nib.classList.remove('on'); };
      function onInput(e) {
        const el = e.target; if (!(o.helper || o.mode === 'helper') || !el || el.id !== 'qa' || !api.plugins.enabled('typing-fx')) return;
        clearTimeout(tipT); tipT = setTimeout(() => {
          const v = el.value || ''; if (v.length < 6 || Date.now() - lastTip < 15000) return;
          for (const t of TIPS) { if (shown.has(t.id)) continue; let h = null; try { h = t.test(v); } catch (er) {} if (h) { shown.add(t.id); lastTip = Date.now(); say(h); break; } }
        }, 700);
      }
      // the eyes follow the caret
      function look() { if (!nib || !nib.classList.contains('on')) return; const a = document.activeElement; if (!a || !a.matches || !a.matches(TYPABLE)) return; const c = caretXY(a); if (!c) return; const r = nib.querySelector('.nb-c').getBoundingClientRect(), dx = c.x - (r.left + r.width / 2), dy = c.y - (r.top + r.height * .4), d = Math.hypot(dx, dy) || 1; nib.querySelectorAll('.nb-p').forEach(p => p.setAttribute('transform', `translate(${(dx / d * 2.4).toFixed(2)} ${(dy / d * 2.4).toFixed(2)})`)); }

      /* ---------- settings ---------- */
      G.settings = () => {
        const seg = (id, list, cur) => `<div class="seg wrap" id="${id}">${list.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
        api.ui.modal('Typing effects', `
          <div class="field"><label>Effect</label>${seg('tfx-mode', MODES, o.mode)}
            <div class="muted" style="font-size:12px;margin-top:6px">Try it in the box below before you close this.</div></div>
          <input class="inp" id="tfx-try" placeholder="Type here to try it…" style="margin:4px 0 12px">
          <div class="field"><label>Where</label>${seg('tfx-where', [['all', 'Every text box'], ['qa', 'Quick add only']], o.where)}</div>
          <div class="field"><label>Amount</label><input type="range" id="tfx-amt" min=".3" max="2.5" step=".1" value="${o.amount}" style="width:100%"></div>
          <label class="xm-row"><input type="checkbox" id="tfx-matter" ${o.matter !== false ? 'checked' : ''}> Real fire and snow (they rise, settle on cards and melt each other)</label>
          <label class="xm-row"><input type="checkbox" id="tfx-sound" ${o.sound ? 'checked' : ''}> Typewriter sounds</label>
          <label class="xm-row"><input type="checkbox" id="tfx-helper" ${o.helper ? 'checked' : ''}> Nib, the sticky-note helper, offers quick-add tips</label>
          ${reduced() ? '<p class="muted" style="font-size:12px">Your system asks for reduced motion, so only sounds and Nib work.</p>' : ''}`,
          `<button class="btn" id="tfx-nib-demo" style="margin-right:auto">Say hi, Nib</button><button class="btn primary" id="tfx-done">Done</button>`);
        const $ = id => document.getElementById(id);
        const pick = (id, k) => document.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { document.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); save({ [k]: b.dataset.v }); $('tfx-try').focus(); });
        pick('tfx-mode', 'mode'); pick('tfx-where', 'where');
        $('tfx-amt').oninput = e => save({ amount: +e.target.value });
        $('tfx-sound').onchange = e => save({ sound: e.target.checked });
        $('tfx-matter').onchange = e => save({ matter: e.target.checked });
        $('tfx-helper').onchange = e => save({ helper: e.target.checked });
        $('tfx-nib-demo').onclick = () => { if (!(o.helper || o.mode === 'helper')) save({ helper: true }); say("Hi! I'm Nib. I'll pop up while you type in quick add if there's a shortcut that would help."); };
        $('tfx-done').onclick = () => api.ui.close();
      };
      api.onSettings && api.onSettings(() => G.settings());
      api.commands.add({ title: 'Typing effects…', hint: 'Fire, ice, typewriter, confetti, power, helper', run: () => G.settings() });
      for (const [v, l] of MODES) if (v !== 'off') api.commands.add({ title: 'Typing effect: ' + l, run: () => { save({ mode: v }); api.ui.toast('Typing effect: ' + l); } });
      api.commands.add({ title: 'Typing effects off', run: () => { save({ mode: 'off' }); api.ui.toast('Typing effects off'); } });

      /* ---------- styles ---------- */
      function styleBox() { document.documentElement.dataset.tfx = o.mode; }
      if (!document.getElementById('tfx-css')) {
        const st = document.createElement('style'); st.id = 'tfx-css';
        st.textContent = `
        #tfx-cv{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:96}
        [data-tfx=fire]{box-shadow:0 0 0 1px rgba(255,120,30,calc(var(--tfx-h,0) * .9)),0 0 calc(var(--tfx-h,0) * 26px) rgba(255,90,0,calc(var(--tfx-h,0) * .55)),inset 0 -6px calc(var(--tfx-h,0) * 18px) rgba(255,110,20,calc(var(--tfx-h,0) * .18))!important;transition:box-shadow .2s}
        [data-tfx=ice]{box-shadow:0 0 0 1px rgba(160,210,255,calc(var(--tfx-h,0) * .9)),0 0 calc(var(--tfx-h,0) * 18px) rgba(150,200,255,calc(var(--tfx-h,0) * .5)),inset 0 0 calc(var(--tfx-h,0) * 22px) rgba(200,230,255,calc(var(--tfx-h,0) * .35))!important;transition:box-shadow .3s}
        .tfx-jolt{animation:tfxJ .09s ease-out}
        @keyframes tfxJ{50%{transform:translateY(1px)}}
        .tfx-return{animation:tfxR .32s cubic-bezier(.3,1.4,.5,1)}
        @keyframes tfxR{30%{transform:translateX(-10px)}100%{transform:none}}
        #tfx-combo{position:fixed;z-index:97;pointer-events:none;background:none!important;border:0!important;box-shadow:none!important;padding:0!important;display:flex;align-items:baseline;gap:4px;font:900 22px/1 ui-rounded,system-ui,sans-serif;color:var(--accent,#5b5bd6);opacity:0;transition:opacity .3s;text-shadow:0 2px 10px color-mix(in srgb,var(--accent,#5b5bd6) 40%,transparent)}
        #tfx-combo span{font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.7}
        #tfx-combo.on{opacity:1}#tfx-combo.pop b{animation:tfxP .18s ease-out}
        @keyframes tfxP{0%{transform:scale(1.5)}}
        #tfx-nib{position:fixed;right:22px;bottom:22px;z-index:94;display:flex;align-items:flex-end;gap:8px;transform:translateY(140%);transition:transform .5s cubic-bezier(.3,1.5,.5,1);pointer-events:none}
        #tfx-nib.on{transform:none;pointer-events:auto}#tfx-nib.out{transform:translateY(140%);transition-duration:.35s}
        #tfx-nib .nb-b{position:relative;max-width:260px;background:#fffbe6;color:#3b3000;border:1px solid #e9d98a;border-radius:12px 12px 4px 12px;padding:10px 12px;font:13px/1.4 Inter,ui-sans-serif,system-ui;box-shadow:0 10px 30px -10px rgba(0,0,0,.35)}
        #tfx-nib .nb-b code{background:rgba(0,0,0,.07);padding:1px 4px;border-radius:4px;font:600 12px ui-monospace,monospace}
        #tfx-nib .nb-a{display:flex;gap:6px;margin-top:8px}
        #tfx-nib .nb-a button{font:600 11.5px Inter,system-ui;border:1px solid #e0cd73;background:#fff5bf;color:#4a3c00;border-radius:7px;padding:4px 8px;cursor:pointer}
        #tfx-nib .nb-a button:hover{background:#ffef99}
        #tfx-nib .nb-c{animation:nbBob 2.8s ease-in-out infinite;filter:drop-shadow(0 6px 8px rgba(0,0,0,.25))}
        #tfx-nib .nb-note{fill:#ffe066;stroke:#e0b800;stroke-width:1.5}#tfx-nib .nb-fold{fill:#f2c700}
        #tfx-nib .nb-p{fill:#2b2b2b;transition:transform .15s}#tfx-nib .nb-mouth,#tfx-nib .nb-brow{stroke:#5a4500;stroke-width:2.2;stroke-linecap:round}
        #tfx-nib .nb-eyes{animation:nbBlink 4.5s infinite;transform-origin:32px 26px}
        @keyframes nbBob{50%{transform:translateY(-4px) rotate(-3deg)}}
        @keyframes nbBlink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
        @media (prefers-reduced-motion:reduce){#tfx-nib .nb-c,#tfx-nib .nb-eyes{animation:none}}`;
        document.head.appendChild(st);
      }

      /* ---------- wiring (bound once; Work/Life rebuilds just swap the handlers) ---------- */
      G.h = { key: onKey, input: onInput, look, size };
      if (!G.bound) { G.bound = true;
        document.addEventListener('keydown', e => G.h.key && G.h.key(e), true);
        document.addEventListener('input', e => { G.h.input && G.h.input(e); G.h.look && G.h.look(); }, true);
        addEventListener('resize', () => G.h.size && G.h.size()); }
      styleBox(); helperCheck();
      G.say = say;
      G.teardown = () => { cancelAnimationFrame(raf); raf = 0; parts = []; cv && cv.remove(); cv = cx = null; mirror && mirror.remove(); mirror = null; nib && nib.remove(); nib = null; comboEl && comboEl.remove(); comboEl = null; G.h = {}; };
    },
  });
})();
