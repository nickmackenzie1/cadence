/* Themes with a trick: 3D (depth and tilt), Webcam (you, as the backdrop), Halloween (pumpkins with real fire inside).
   Same CadenceThemes.register() API. Effects respect the Effects setting and reduced motion. */
(() => {
  const R = t => window.CadenceThemes.register(t);

  /* ---------------- 3D: a receding grid floor, layered cards, and the page tilting with your pointer ---------------- */
  R({ id: 'depth', name: '3D', category: 'Crazy', tagline: 'Depth: cards float in layers over a grid floor, lift toward you on hover, and the page tilts with your pointer.',
    vars: { '--ambient': 'off', '--bg': '#0d1020', '--panel': 'rgba(24,28,52,.92)', '--side': 'rgba(12,14,30,.94)', '--text': '#e8ecff', '--muted': '#9aa3c8', '--faint': '#646c92', '--line': 'rgba(130,150,255,.22)', '--hover': 'rgba(130,150,255,.12)',
      '--accent': '#7c8cff', '--on-accent': '#0b0e22', '--accent-soft': 'rgba(124,140,255,.18)', '--client': '#ff9f6b', '--client-soft': 'rgba(255,159,107,.16)', '--ok': '#6ee7b7', '--danger': '#ff6b81', '--danger-soft': 'rgba(255,107,129,.16)', '--r': '12px', '--shadow': '0 18px 40px rgba(0,0,0,.45)' },
    preview: { bg: 'linear-gradient(180deg,#0d1020 55%,#2a2f6a)', panel: '#181c34', side: '#0c0e1e', text: '#e8ecff', accent: '#7c8cff', line: '#3a4180', r: '12px' },
    css: `:skin body{background:#0d1020}
      :skin .app,:skin .main{background:transparent}
      :skin .main::before{content:'';position:fixed;left:276px;right:0;bottom:0;height:55vh;pointer-events:none;z-index:0;
        background:linear-gradient(180deg,#0d1020,transparent 30%),repeating-linear-gradient(90deg,rgba(124,140,255,.35) 0 1px,transparent 1px 60px),repeating-linear-gradient(0deg,rgba(124,140,255,.35) 0 1px,transparent 1px 60px);
        transform:perspective(500px) rotateX(62deg);transform-origin:center bottom;opacity:.55}
      @media (max-width:900px){:skin .main::before{left:0}}
      :skin .main{perspective:1600px;perspective-origin:50% 30%}
      :skin #view{position:relative;z-index:1;transform-style:preserve-3d;transform:rotateX(var(--d3x,0deg)) rotateY(var(--d3y,0deg));transition:transform .25s ease-out}
      :skin #view .head{transform:translateZ(40px)}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .group,:skin .qa,:skin .th-card,:skin .mr-card{transform:translateZ(12px);transition:transform .2s ease,box-shadow .2s ease;box-shadow:0 14px 30px rgba(0,0,0,.4),0 0 0 1px rgba(130,150,255,.18)}
      :skin .task:not(.td-b):hover,:skin .gl:hover,:skin .th-card:hover{transform:translateZ(34px) scale(1.01);box-shadow:0 26px 50px rgba(0,0,0,.55),0 0 0 1px rgba(124,140,255,.5)}
      :skin .side{transform:perspective(900px) rotateY(3deg);transform-origin:left center;box-shadow:12px 0 40px rgba(0,0,0,.45)}
      :skin .head h1{text-shadow:0 1px 0 #3a4180,0 2px 0 #333a78,0 3px 0 #2d336e,0 4px 0 #272c64,0 10px 18px rgba(0,0,0,.6)}
      :skin .btn.primary,:skin .meet-btn{background:linear-gradient(180deg,#9aa6ff,#6a78f0);border:0;color:#0b0e22;box-shadow:0 4px 0 #3f49a8,0 10px 20px rgba(0,0,0,.35)}
      :skin .btn.primary:active,:skin .meet-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #3f49a8}`,
    effects: () => {
      let raf = 0, tx = 0, ty = 0;
      const set = () => { raf = 0; document.documentElement.style.setProperty('--d3x', tx.toFixed(2) + 'deg'); document.documentElement.style.setProperty('--d3y', ty.toFixed(2) + 'deg'); };
      const move = e => { const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5; ty = nx * 5; tx = -ny * 3.5; if (!raf) raf = requestAnimationFrame(set); };
      // typing shouldn't make the page swim: hold still while a text box has focus
      const still = () => { const a = document.activeElement; if (a && /INPUT|TEXTAREA/.test(a.tagName)) { tx = ty = 0; if (!raf) raf = requestAnimationFrame(set); } };
      addEventListener('pointermove', move); document.addEventListener('focusin', still);
      return () => { removeEventListener('pointermove', move); document.removeEventListener('focusin', still); cancelAnimationFrame(raf); document.documentElement.style.removeProperty('--d3x'); document.documentElement.style.removeProperty('--d3y'); };
    } });

  /* ---------------- Halloween: a night sky, fog, bats, and jack-o'-lanterns with real fire inside ---------------- */
  // an original jack-o'-lantern: ribbed body, stem, carved eyes/nose/grin (the carving is see-through to the glow behind)
  const FACES = [
    'M34 44 l12 -10 l8 12 z M66 46 l8 -12 l12 10 z M57 52 l6 0 l-3 7 z M30 64 q30 22 60 0 l-6 2 l-4 6 l-6 -5 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 5 l-4 -6 z',
    'M32 40 q8 -8 16 0 q-8 10 -16 0 z M72 40 q8 -8 16 0 q-8 10 -16 0 z M56 52 l8 0 l-4 6 z M34 66 q26 16 52 0 q-26 6 -52 0 z',
    'M36 46 l10 -12 l10 12 z M64 46 l10 -12 l10 12 z M57 54 l6 0 l-3 6 z M32 64 l8 8 l8 -6 l8 8 l8 -8 l8 6 l8 -8 l8 6 q-28 18 -56 0 z'];
  // an original jack-o'-lantern: ribbed body, a stem, and a carved face full of candlelight
  const PUMPKIN = (w, face) => `<svg viewBox="0 0 120 100" width="${w}" height="${Math.round(w * 100 / 120)}" aria-hidden="true">
    <defs><radialGradient id="hw-in${face}" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffc23a"/><stop offset="1" stop-color="#ff7a00"/></radialGradient></defs>
    <path d="M60 14 q-2 -10 6 -12 l3 3 q-6 3 -4 10 z" fill="#4a6b1f"/>
    <ellipse cx="60" cy="58" rx="56" ry="40" fill="#d9650a"/><ellipse cx="60" cy="58" rx="36" ry="40" fill="#ec7a1f"/><ellipse cx="60" cy="58" rx="14" ry="40" fill="#f78f34"/>
    <path d="M26 24 q-10 34 0 70 M94 24 q10 34 0 70 M44 19 q-6 39 0 78 M76 19 q6 39 0 78" stroke="#a9480a" stroke-width="2" fill="none" opacity=".55"/>
    <path class="hw-face" d="${FACES[face % 3]}" fill="url(#hw-in${face})" stroke="#7a2e00" stroke-width="1.5"/></svg>`;
  function lanterns(api) {
    const host = document.createElement('div'); host.className = 'hw-row'; host.setAttribute('aria-hidden', 'true');
    const n = Math.max(2, Math.min(5, Math.floor((innerWidth - 300) / 260)));
    host.innerHTML = Array.from({ length: n }, (_, i) => `<div class="hw-p" style="--s:${i % 2 ? .8 : 1};--d:${(i * .37) % 1.3}s">${PUMPKIN(92, i)}<i class="hw-light"></i></div>`).join('');
    document.body.appendChild(host);
    return host;
  }
  R({ id: 'halloween', name: 'Halloween', category: 'Seasonal', tagline: 'A purple night, rolling fog, bats, and jack-o’-lanterns with real fire flickering inside.',
    vars: { '--ambient': 'off', '--bg': '#140c1f', '--panel': 'rgba(32,20,46,.9)', '--side': '#0d0815', '--text': '#f3e9ff', '--muted': '#b5a3cc', '--faint': '#7a6a92', '--line': '#3a2752', '--hover': '#2a1b3d',
      '--accent': '#ff7a18', '--on-accent': '#1a0d00', '--accent-soft': 'rgba(255,122,24,.18)', '--client': '#9be36d', '--client-soft': 'rgba(155,227,109,.16)', '--ok': '#9be36d', '--danger': '#ff5a5a', '--danger-soft': 'rgba(255,90,90,.16)', '--r': '10px', '--shadow': '0 10px 26px rgba(0,0,0,.45)' },
    preview: { bg: 'radial-gradient(circle at 75% 20%,#f6e7b0 0 6%,#3b2357 7%,#140c1f 70%)', panel: '#20142e', side: '#0d0815', text: '#f3e9ff', accent: '#ff7a18', line: '#3a2752', r: '10px' },
    css: `:skin body{background:radial-gradient(70px 70px at 86% 12%,#f6e7b0 60%,rgba(246,231,176,.25) 62%,transparent 75%),radial-gradient(1000px 600px at 80% 0%,#3b2357,transparent 70%),#140c1f;background-attachment:fixed}
      :skin .app,:skin .main{background:transparent}
      :skin .head h1,:skin .c-hero h1{color:#ff9a3c;text-shadow:0 0 18px rgba(255,122,24,.45)}
      :skin .btn.primary,:skin .meet-btn{background:linear-gradient(180deg,#ff9a3c,#e8620c);border:0;color:#1a0d00}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa{border:1px solid #3a2752}
      :skin #view{position:relative;z-index:2;padding-bottom:140px}
      :skin .hw-row{position:fixed;left:276px;right:0;bottom:-6px;display:flex;justify-content:space-around;align-items:flex-end;pointer-events:none;z-index:3}
      @media (max-width:900px){:skin .hw-row{left:0}}
      :skin .hw-p{position:relative;transform:scale(var(--s));transform-origin:bottom center;filter:drop-shadow(0 8px 10px rgba(0,0,0,.5))}
      :skin .hw-light{position:absolute;inset:-30% -20% 0 -20%;border-radius:50%;background:radial-gradient(circle at 50% 60%,rgba(255,170,60,.45),transparent 65%);animation:hw-fl 1.3s ease-in-out infinite alternate;animation-delay:calc(var(--d) * -1);z-index:-1}
      :skin .hw-face{animation:hw-face 1.1s ease-in-out infinite alternate;animation-delay:calc(var(--d) * -1)} @keyframes hw-face{0%{filter:brightness(.85)}40%{filter:brightness(1.25)}100%{filter:brightness(1)}}
      :skin .hw-p svg{display:block;position:relative}
      @keyframes hw-fl{0%{opacity:.75;transform:scale(.96)}35%{opacity:1}60%{opacity:.82;transform:scale(1.03)}100%{opacity:.95}}
      :skin .hw-fog{position:fixed;left:0;right:0;bottom:0;height:200px;pointer-events:none;z-index:1;background:radial-gradient(60% 100px at 20% 100%,rgba(190,170,220,.22),transparent),radial-gradient(50% 120px at 70% 100%,rgba(190,170,220,.18),transparent);animation:hw-fog 18s ease-in-out infinite alternate}
      @keyframes hw-fog{to{transform:translateX(60px)}}
      @media (prefers-reduced-motion:reduce){:skin .hw-light,:skin .hw-fog,:skin .hw-face{animation:none}}`,
    enhance: ({ api }) => { const row = lanterns(api); const fog = document.createElement('div'); fog.className = 'hw-fog'; document.body.appendChild(fog); return () => { row.remove(); fog.remove(); }; },
    effects: ({ layer, level }) => {
      // real fire licking out of each lantern (the shared Elements layer), and bats crossing the moon
      let fx = null, alive = true, t = 0;
      if (window.CadenceFX) window.CadenceFX.world().then(w => { fx = w; });
      const burn = () => {
        if (!alive) return;
        if (fx && !document.hidden) for (const p of document.querySelectorAll('.hw-p')) { const r = p.getBoundingClientRect(); if (r.width) { fx.spawn(r.left + r.width * .5 + (Math.random() - .5) * r.width * .25, r.top + r.height * .12, fx.M.FIRE, 2, .5, 14, 30); if (Math.random() < .3) fx.spawn(r.left + r.width / 2, r.top + r.height * .1, fx.M.EMBER, 1, .4, 20, 50); } }
        t = setTimeout(burn, level === 'low' ? 320 : 140);
      };
      burn();
      const cv = document.createElement('canvas'), cx = cv.getContext('2d'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; layer.appendChild(cv);
      const size = () => { cv.width = innerWidth; cv.height = innerHeight; }; size(); addEventListener('resize', size);
      const bats = Array.from({ length: level === 'low' ? 2 : 5 }, () => ({ x: -60 - Math.random() * 600, y: 40 + Math.random() * innerHeight * .35, v: 1.2 + Math.random() * 1.4, ph: Math.random() * 6, s: 8 + Math.random() * 8 }));
      let raf = 0;
      const loop = () => {
        cx.clearRect(0, 0, cv.width, cv.height);
        for (const b of bats) {
          b.x += b.v; b.ph += .25; b.y += Math.sin(b.ph * .2) * .6;
          if (b.x > innerWidth + 60) { b.x = -60 - Math.random() * 900; b.y = 40 + Math.random() * innerHeight * .35; }
          const f = Math.sin(b.ph) * b.s * .7; cx.fillStyle = '#05030a'; cx.beginPath();
          cx.moveTo(b.x, b.y); cx.quadraticCurveTo(b.x - b.s * .6, b.y - f - 4, b.x - b.s * 1.4, b.y - f * .4); cx.quadraticCurveTo(b.x - b.s * .7, b.y + 2, b.x, b.y + 3);
          cx.quadraticCurveTo(b.x + b.s * .7, b.y + 2, b.x + b.s * 1.4, b.y - f * .4); cx.quadraticCurveTo(b.x + b.s * .6, b.y - f - 4, b.x, b.y); cx.fill();
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
      return () => { alive = false; clearTimeout(t); cancelAnimationFrame(raf); removeEventListener('resize', size); cv.remove(); };
    } });

  /* ---------------- Mirror (webcam): you as a big-pixel backdrop, and the snow settles on your head and shoulders ----------------
     Opt-in only: choosing the theme shows a card; the camera starts when you press "Turn on camera". Frames are read
     in the browser at 64×48, never stored or sent. A "Camera on" badge stays visible with an Off button; the camera
     stops when you switch theme, hide the tab, or press Off. */
  const CAM = window.__mirror = window.__mirror || { stream: null };
  function mirror({ api, level }) {
    const E = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const bg = document.createElement('canvas'); bg.className = 'mi-bg'; document.body.appendChild(bg);
    const card = document.createElement('div'); card.className = 'mi-card'; document.body.appendChild(card);
    const W = 64, H = 48, grab = document.createElement('canvas'); grab.width = W; grab.height = H; const gx = grab.getContext('2d', { willReadFrequently: true });
    let video = null, raf = 0, timer = 0, prev = null, fx = null, alive = true;
    const bx = bg.getContext('2d');
    const showOff = () => { card.className = 'mi-card'; card.innerHTML = `<b>Mirror</b><span>Your camera becomes the backdrop and the snow settles on you. It stays in this browser: nothing is recorded or sent.</span><button class="btn primary" data-mi="on">Turn on camera</button>`; card.querySelector('[data-mi=on]').onclick = start; };
    const showOn = () => { card.className = 'mi-card on'; card.innerHTML = `<i class="mi-dot"></i><b>Camera on</b><button class="btn" data-mi="off">Off</button>`; card.querySelector('[data-mi=off]').onclick = stop; };
    async function start() {
      try {
        CAM.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
      } catch (e) { card.querySelector('span').textContent = 'The camera is blocked or not available: ' + (e && e.name === 'NotAllowedError' ? 'allow it in the browser’s site settings' : (e && e.message) || 'unknown'); return; }
      if (!alive) { CAM.stream.getTracks().forEach(t => t.stop()); return; }
      video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = CAM.stream; await video.play().catch(() => {});
      showOn();
      if (window.CadenceFX) { window.CadenceFX.want('mirror', { snow: true, everywhere: true }); window.CadenceFX.world().then(w => { fx = w; }); }
      tick();
    }
    function stop() {
      cancelAnimationFrame(raf); clearTimeout(timer); raf = 0;
      if (CAM.stream) { CAM.stream.getTracks().forEach(t => t.stop()); CAM.stream = null; }
      video = null; prev = null; bx.clearRect(0, 0, bg.width, bg.height);
      if (fx && fx.ledgesExtra) fx.ledgesExtra([]);
      if (window.CadenceFX) window.CadenceFX.want('mirror', null);
      if (alive) showOff();
    }
    const PAL = [[20, 16, 40], [70, 46, 110], [160, 90, 150], [240, 170, 140], [255, 236, 200]];   // posterised: dusk shades
    function tick() {
      if (!video || !alive) return;
      if (document.hidden) { stop(); return; }
      // a mirrored, cover-cropped 64×48 frame
      const vw = video.videoWidth || 320, vh = video.videoHeight || 240, s = Math.max(W / vw, H / vh);
      gx.save(); gx.translate(W, 0); gx.scale(-1, 1); gx.drawImage(video, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s); gx.restore();
      const d = gx.getImageData(0, 0, W, H).data, lum = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) lum[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11;
      // the backdrop: big posterised pixels across the window
      const cw = innerWidth, ch = innerHeight; if (bg.width !== cw || bg.height !== ch) { bg.width = cw; bg.height = ch; }
      const px = Math.max(cw / W, ch / H), ox = (cw - W * px) / 2, oy = (ch - H * px) / 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = PAL[Math.min(4, Math.floor(lum[y * W + x] / 52))]; bx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; bx.fillRect(Math.floor(ox + x * px), Math.floor(oy + y * px), Math.ceil(px), Math.ceil(px)); }
      // your outline: per column, the first row that clearly differs from the wall above you (the top rows)
      if (fx && fx.ledgesExtra) {
        const tops = new Array(W).fill(-1);
        for (let x = 0; x < W; x++) { const ref = (lum[x] + lum[W + x] + lum[2 * W + x]) / 3; for (let y = 4; y < H - 2; y++) if (Math.abs(lum[y * W + x] - ref) > 38 && Math.abs(lum[(y + 1) * W + x] - ref) > 38) { tops[x] = y; break; } }
        const led = [];
        for (let x = 1; x < W - 1; x++) { const a = [tops[x - 1], tops[x], tops[x + 1]].sort((p, q) => p - q)[1]; if (a > 3) led.push([ox + x * px, ox + (x + 1) * px, oy + a * px]); }
        fx.ledgesExtra(led);
        // wave a hand: where the picture changes a lot between frames, the snow there is swept away
        if (prev) { for (let gy = 0; gy < H; gy += 8) for (let gx2 = 0; gx2 < W; gx2 += 8) { let m = 0; for (let y = gy; y < gy + 8; y++) for (let x = gx2; x < gx2 + 8; x++) m += Math.abs(lum[y * W + x] - prev[y * W + x]); if (m / 64 > 42) fx.clearAt(ox + (gx2 + 4) * px, oy + (gy + 4) * px, px * 5); } }
        prev = lum;
      }
      timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, level === 'low' ? 330 : 180);
    }
    showOff();
    return () => { alive = false; stop(); bg.remove(); card.remove(); };
  }
  R({ id: 'mirror', name: 'Mirror (webcam)', category: 'Crazy', tagline: 'You, as a big-pixel backdrop, with the snow settling on your head and shoulders. Wave to sweep it off. Camera only when you turn it on.',
    vars: { '--ambient': 'off', '--bg': '#140f24', '--panel': 'rgba(24,18,40,.82)', '--side': 'rgba(14,10,26,.9)', '--text': '#fff3e6', '--muted': '#c9b6c9', '--faint': '#8a7898', '--line': 'rgba(255,220,200,.18)', '--hover': 'rgba(255,220,200,.08)',
      '--accent': '#ffb38a', '--on-accent': '#1a1026', '--accent-soft': 'rgba(255,179,138,.18)', '--client': '#9ad0ff', '--client-soft': 'rgba(154,208,255,.16)', '--ok': '#9be3b0', '--danger': '#ff7a8a', '--danger-soft': 'rgba(255,122,138,.16)', '--r': '12px', '--shadow': '0 10px 30px rgba(0,0,0,.35)' },
    preview: { bg: 'repeating-linear-gradient(90deg,#46306e 0 10px,#a05a96 10px 20px,#f0aa8c 20px 30px)', panel: '#18122a', side: '#0e0a1a', text: '#fff3e6', accent: '#ffb38a', line: '#4a3a5a', r: '12px' },
    css: `:skin body{background:#140f24} :skin .app,:skin .main{background:transparent}
      :skin .mi-bg{position:fixed;inset:0;z-index:0;opacity:.55;image-rendering:pixelated;pointer-events:none}
      :skin .app{position:relative;z-index:1}
      :skin .task:not(.td-b),:skin .gl,:skin .stat,:skin .qa,:skin .group{backdrop-filter:blur(6px)}
      :skin .mi-card{position:fixed;right:18px;bottom:18px;z-index:90;max-width:300px;display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:14px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);font-size:13px;color:var(--text)}
      :skin .mi-card span{color:var(--muted)} :skin .mi-card.on{flex-direction:row;align-items:center;padding:8px 10px;gap:10px}
      :skin .mi-dot{width:9px;height:9px;border-radius:50%;background:#ff4d4d;box-shadow:0 0 8px #ff4d4d;animation:mi-p 1.6s ease-in-out infinite} @keyframes mi-p{50%{opacity:.4}}`,
    // the camera is part of the look (opt-in), so it lives in enhance: it works even with Effects off
    enhance: ctx => mirror({ ...ctx, level: 'full' }) });
})();
