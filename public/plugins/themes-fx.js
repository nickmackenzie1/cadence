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


  /* Backrooms "found footage" (the user's camcorder pen, trimmed and reworked): TV static and VHS tracking bands on small
     canvases scaled up (cheap: ~15 fps, a few hundred pixels wide), scanlines, a rounded vignette, a 0.5px wobble on the
     overlay only (your text stays still and sharp), and the OSD: blinking REC, elapsed time, clock. Gentle effects: no
     static or bands. Reduced motion: still layers only. Everything is pointer-events:none. */
  function brFootage(layer, level) {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches, busy = level !== 'low' && !still;
    const box = document.createElement('div'); box.className = 'br-cam' + (busy ? ' wob' : '');
    box.innerHTML = '<canvas class="br-snow" width="240" height="150"></canvas><canvas class="br-vcr" width="480" height="300"></canvas><i class="br-lines"></i><i class="br-vig"></i>'
      + '<div class="br-osd"><span class="br-rec"><b></b>REC</span><span class="br-ctr">0:00:00</span><span class="br-clk"></span></div>';
    layer.appendChild(box);
    const snow = box.querySelector('.br-snow'), vcr = box.querySelector('.br-vcr'), sx = snow.getContext('2d'), vx = vcr.getContext('2d');
    const osd = box.querySelector('.br-osd'), ctr = box.querySelector('.br-ctr'), clk = box.querySelector('.br-clk'), t0 = Date.now();
    // keep the OSD inside the main area, clear of the sidebar
    const place = () => { const m = document.querySelector('.main') || document.body, r = m.getBoundingClientRect(); Object.assign(osd.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: Math.min(innerHeight, r.height || innerHeight) + 'px' }); };
    const tick = () => { const s = Math.floor((Date.now() - t0) / 1000); ctr.textContent = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      clk.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }).toUpperCase(); };
    place(); tick(); const clock = setInterval(tick, 1000); addEventListener('resize', place);
    let timer = 0;
    if (busy) {
      const img = sx.createImageData(240, 150), px = new Uint32Array(img.data.buffer);
      const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
      const frame = () => {
        if (document.hidden) return;
        for (let i = 0; i < px.length; i++) px[i] = ((255 * Math.random()) | 0) << 24;
        sx.putImageData(img, 0, 0);
        // tracking noise: specks with smeared tails in a band low on the screen and another near the top
        const W = vcr.width, H = vcr.height; vx.clearRect(0, 0, W, H); vx.fillStyle = '#fff';
        let y1 = H * 0.58, y3 = H * 0.42;
        for (let i = 0; i <= 40; i++) {
          const x = Math.random() * W, a = ri(y1 += 2, H), b = ri(0, Math.max(0, y3 -= 2));
          for (const y of [a, b]) { let xx = x, r = 2; const dir = Math.random() < .5 ? 1 : -1; vx.fillRect(xx, y, 2, 2); for (let k = ri(1, 30); k > 0; k--) { xx += ri(1, 4) * dir; r = Math.max(.3, r - .06); vx.fillRect(xx, y, r, r); } }
        }
      };
      timer = setInterval(frame, 66); frame();
    }
    return () => { clearInterval(clock); clearInterval(timer); removeEventListener('resize', place); box.remove(); };
  }

  /* ---------------- Backrooms: a liminal office. Mono-yellow wallpaper, damp carpet, a ceiling of fluorescent panels
     that buzz and now and then flicker, a faint hum (Effects on, after your first click, very quiet), memos taped to
     doors for tasks, and an endless empty corridor between views. ---------------- */
  const BR_PAPER = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><g fill="none" stroke="#a8955a" stroke-opacity=".35" stroke-width="1.2"><path d="M0 11l11-11 11 11 11-11 11 11M0 33l11-11 11 11 11-11 11 11"/></g><g fill="#a8955a" fill-opacity=".18"><circle cx="11" cy="22" r="1.4"/><circle cx="33" cy="0" r="1.4"/><circle cx="33" cy="44" r="1.4"/></g></svg>')}")`;
  R({ id: 'backrooms', name: 'Backrooms', category: 'Crazy', tagline: 'A liminal office: yellow wallpaper, damp carpet, buzzing fluorescent panels, memos taped to doors, and a long empty corridor between views.',
    fonts: [{ family: 'Courier Prime', src: 'vendor/themes/fonts/courier-prime-latin-400-normal.woff2', weight: 400 }, { family: 'Press Start 2P', src: 'vendor/themes/fonts/press-start-2p-latin-400-normal.woff2', weight: 400 },
      { family: 'Sometype Mono', src: 'vendor/themes/fonts/sometype-mono-latin-400-normal.woff2', weight: 400 }, { family: 'Sometype Mono', src: 'vendor/themes/fonts/sometype-mono-latin-700-normal.woff2', weight: 700 }],
    font: '"Sometype Mono",ui-monospace,monospace',
    vars: { '--ambient': 'off', '--bg': '#e9da8c', '--panel': '#fced97', '--side': '#f3e28f', '--text': '#251418', '--muted': '#5e4a3a', '--faint': '#8a7a58', '--line': '#251418', '--hover': 'rgba(255,251,175,.6)',
      '--accent': '#251418', '--on-accent': '#fffbaf', '--accent-soft': 'rgba(107,93,52,.18)', '--client': '#6b5d34', '--client-soft': 'rgba(107,93,52,.14)', '--ok': '#5d6b34', '--danger': '#8a4a2a', '--danger-soft': 'rgba(138,74,42,.15)', '--r': '0px', '--shadow': '0 1px 0 rgba(0,0,0,.08)' },
    preview: { bg: '#cdbd7e', panel: '#b9a76a', side: '#bfae70', text: '#2e2a1c', accent: '#6b5d34', line: '#a6955c', r: '0' },
    css: `:skin body{background:linear-gradient(180deg,rgba(255,255,230,.18),transparent 30%),${BR_PAPER},linear-gradient(180deg,#d6c789,#c8b776 70%,#b3a263);background-attachment:fixed}
      :skin body::before{content:"";position:fixed;left:0;right:0;top:0;height:30px;z-index:1;pointer-events:none;
        background:linear-gradient(90deg,transparent 0 3%,#fffdf0 3% 17%,transparent 17% 23%,#fffdf0 23% 37%,transparent 37% 43%,#fffdf0 43% 57%,transparent 57% 63%,#fffdf0 63% 77%,transparent 77% 83%,#fffdf0 83% 97%,transparent 97%) 0 8px/100% 9px no-repeat,
          repeating-linear-gradient(90deg,#e6dcc0 0 119px,#bfb38f 119px 120px),#ebe2c8;box-shadow:0 2px 0 #a89d77,0 30px 60px rgba(255,255,220,.35);animation:br-flick 9s steps(1) infinite}
      @keyframes br-flick{0%,62%,64%,66%,to{opacity:1}63%,65%{opacity:.55}}
      :skin body::after{content:"";position:fixed;left:0;right:0;bottom:0;height:18px;z-index:1;pointer-events:none;background:radial-gradient(rgba(0,0,0,.12) 1px,transparent 1.5px) 0 0/5px 5px,linear-gradient(#9a8a52,#857643);box-shadow:0 -1px 0 #6f6238}
      :skin .app,:skin .main{background:transparent}
      :skin .side{position:relative;z-index:2;background:${BR_PAPER},#f3e28f;border-right:2px solid #251418;box-shadow:5px 0 0 rgba(0,0,0,.08)}
      :skin .side .ntile,:skin .side .nav a{border-radius:3px;transition:all .15s steps(2)}
      :skin .side .ntile:hover,:skin .side .nav a:hover,:skin .side .ntile.on,:skin .side .nav a.on{background:#fffbaf;box-shadow:-2px -2px 2px 2px inset rgba(255,255,255,.5),2px 2px 1px 2px inset #825a48}
      :skin .side .ntile.on>*,:skin .side .ntile:hover>*{transform:translateY(2px)}
      :skin .head h1,:skin .c-hero h1{font-family:"Sometype Mono",monospace;font-weight:700;letter-spacing:.02em;color:#251418;text-transform:uppercase;font-size:30px}
      :skin .head h1::before{content:"LEVEL 0 · ";color:#825a48;font-weight:400}
      :skin .group,:skin .gl,:skin .stat,:skin .qa,:skin .modal{position:relative;background:#fced97;border:2px solid #251418;border-radius:10px;
        box-shadow:5px 5px 3px inset rgba(255,255,255,.65),5px 10px 10px 5px inset #fffbaf,-6px -6px 1px inset #825a48,3px 3px 0 rgba(0,0,0,.1),5px 5px 0 rgba(0,0,0,.1),7px 7px 0 rgba(0,0,0,.1),9px 9px 0 rgba(0,0,0,.1)}
      :skin .group{padding:22px 40px 18px 22px}
      :skin .group::before{content:"";position:absolute;inset:9px;border:2px solid #251418;border-radius:5px;pointer-events:none}
      :skin .group::after{content:"";position:absolute;right:13px;top:22px;width:16px;height:16px;border:2px solid #251418;border-radius:50%;pointer-events:none;
        background:linear-gradient(160deg,#d4d4d4 0%,#825a48 35%,#825a48 40%,#251418 40%,#251418 60%,#825a48 60%,#825a48 65%,#d4d4d4 100%);box-shadow:3px 3px 3px rgba(0,0,0,.3)}
      :skin .qa{padding-left:14px}
      :skin .group-h{letter-spacing:.12em;text-transform:uppercase;font-size:12px;font-weight:700;color:#251418;border-bottom:2px solid #251418;padding-bottom:6px}
      :skin .task:not(.td-b){font-family:"Courier Prime","Courier New",monospace;background:#fbf8ec;margin:9px 26px 9px 4px;padding:8px 10px;border:0;box-shadow:0 1px 2px rgba(0,0,0,.18),0 6px 10px -6px rgba(0,0,0,.3);transform:rotate(-.5deg);position:relative}
      :skin .task:not(.td-b):nth-child(even){transform:rotate(.6deg)}
      :skin .task:not(.td-b)::before{content:"";position:absolute;left:50%;top:-6px;width:46px;height:13px;margin-left:-23px;background:rgba(240,235,200,.75);box-shadow:0 0 0 1px rgba(0,0,0,.05);transform:rotate(-2deg)}
      :skin .task:not(.td-b):hover{background:#fffdf3}
      :skin .check{border:2px solid #251418;border-radius:3px}
      :skin .task.done .check{background:#251418}
      :skin .btn{border-radius:3px;background:#fef5b9;border:1px solid #251418;color:#251418;font-weight:700;text-transform:uppercase;letter-spacing:.05em;box-shadow:.2em .2em .2em rgba(0,0,0,.25);transition:all .2s steps(2)}
      :skin .btn:hover{background:#fffbaf}
      :skin .btn.primary,:skin .meet-btn{background:#251418;border-color:transparent;color:#fffbaf;box-shadow:.2em .2em .2em .1em inset #825a48,.2em .2em .2em rgba(0,0,0,.25)}
      :skin .btn.primary:hover,:skin .meet-btn:hover{background:#825a48;color:#fef5b9;box-shadow:-.2em -.2em .2em .1em inset #251418,.2em .2em .2em rgba(0,0,0,.25)}
      :skin .ftoast{background:#251418;color:#fffbaf;border-radius:3px}
      :skin ::selection{background:#251418;color:#fef5b9}
      /* the light switch (the pen's toggler) and lights-off */
      :skin .br-switch{position:fixed;right:22px;top:92px;z-index:30;width:44px;height:70px;border:2px solid #251418;border-radius:6px;background:#fced97;cursor:pointer;padding:0;
        box-shadow:5px 5px 3px inset rgba(255,255,255,.65),-4px -4px 1px inset #825a48,3px 3px 0 rgba(0,0,0,.1),5px 5px 0 rgba(0,0,0,.1)}
      :skin .br-switch i{position:absolute;left:12px;top:14px;width:16px;height:38px;border:2px solid #251418;border-radius:3px;background:linear-gradient(to bottom,#fced97 0%,#fced97 20%,#fef5b9 30%,#fffbaf 60%,#825a48 95%);transform:perspective(200px) rotateX(30deg);transition:transform .2s steps(2)}
      :skin .br-switch[aria-pressed="false"] i{transform:perspective(200px) rotateX(-30deg)}
      :skin.br-dark body::before{opacity:.25;animation:none}
      :skin.br-dark .app::after{content:"";position:fixed;inset:0;z-index:20;pointer-events:none;background:#000;opacity:.5;mix-blend-mode:color-burn}
      :skin .br-hall{position:fixed;inset:0;z-index:2500;pointer-events:none;opacity:0;background:
        radial-gradient(closest-side,#fffbe0 0 4%,transparent 30%) 50% 46%/100% 100% no-repeat,
        conic-gradient(from 135deg at 50% 46%,#bfae70 0 90deg,#a69458 90deg 180deg,#d9cc95 180deg 270deg,#b5a465 270deg 360deg);animation:br-hall .5s ease-out forwards}
      :skin .br-hall::after{content:"";position:absolute;inset:0;background:repeating-radial-gradient(circle at 50% 46%,transparent 0 46px,rgba(80,70,40,.35) 46px 48px)}
      @keyframes br-hall{0%{opacity:0;transform:scale(1.4)}35%{opacity:1}to{opacity:0;transform:scale(1)}}
      :skin .br-cam{position:absolute;inset:0;pointer-events:none}
      :skin .br-cam.wob{animation:br-wob 120ms infinite}
      @keyframes br-wob{0%{transform:translateY(.5px)}to{transform:none}}
      :skin .br-cam canvas{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}
      :skin .br-snow{opacity:.07;mix-blend-mode:multiply} :skin .br-vcr{opacity:.35;filter:blur(1px)}
      :skin .br-lines{position:absolute;inset:0;background:linear-gradient(transparent 50%,rgba(0,0,0,.09) 50%) 0 0/100% 2px}
      :skin .br-vig{position:absolute;inset:0;border-radius:22px;background:radial-gradient(ellipse at center,transparent 55%,rgba(40,30,0,.38) 100%);box-shadow:inset 0 0 14px 6px rgba(0,0,0,.28),inset 0 0 160px rgba(30,24,0,.3)}
      :skin .br-osd{position:absolute;font:12px "Press Start 2P",monospace;color:#fff;--p:clamp(16px,2.4vw,40px)}
      :skin .br-osd span{position:absolute;filter:blur(.8px);text-shadow:0 0 4px rgba(0,0,0,.6),0 0 2px rgba(255,255,255,.35)}
      :skin .br-rec{left:var(--p);top:calc(var(--p) + 14px);display:flex;align-items:center;gap:.6em}
      :skin .br-rec b{width:.9em;height:.9em;border-radius:50%;background:#ff2b2b;box-shadow:0 0 .4em rgba(255,40,40,.85);animation:br-rec 1.4s steps(1,end) infinite}
      @keyframes br-rec{0%,50%{opacity:1}50.01%,to{opacity:.15}}
      :skin .br-ctr{right:var(--p);top:calc(var(--p) + 14px)} :skin .br-clk{left:var(--p);bottom:var(--p)}
      @media (prefers-reduced-motion:reduce){:skin body::before,:skin .br-rec b{animation:none}}`,
    enhance: () => {
      const b = document.createElement('button'); b.className = 'br-switch'; b.innerHTML = '<i></i>'; b.title = 'Lights';
      const set = on => { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Turn the lights off' : 'Turn the lights on'); document.documentElement.classList.toggle('br-dark', !on); try { localStorage.setItem('cadence.br.lights', on ? '1' : '0'); } catch (e) {} };
      let on = true; try { on = localStorage.getItem('cadence.br.lights') !== '0'; } catch (e) {}
      set(on); b.onclick = () => set(b.getAttribute('aria-pressed') !== 'true');
      document.body.appendChild(b);
      return () => { b.remove(); document.documentElement.classList.remove('br-dark'); };
    },
    effects: ({ layer, level }) => {
      const footage = brFootage(layer, level);
      // the corridor between views
      const hall = () => { const d = document.createElement('div'); d.className = 'br-hall'; layer.appendChild(d); setTimeout(() => d.remove(), 520); };
      addEventListener('hashchange', hall);
      // the hum: two quiet tones (mains buzz + its harmonic), only after you've clicked something, never loud
      let ctx = null, nodes = [];
      const start = () => { if (ctx) return; try { ctx = new (window.AudioContext || window.webkitAudioContext)(); const g = ctx.createGain(); g.gain.value = 0.006; g.connect(ctx.destination);
        for (const [f, v] of [[120, 1], [240, .35], [360, .12]]) { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; gg.gain.value = v; o.connect(gg); gg.connect(g); o.start(); nodes.push(o); } } catch (e) {} };
      const stop = () => { nodes.forEach(o => { try { o.stop(); } catch (e) {} }); nodes = []; if (ctx) { ctx.close().catch(() => {}); ctx = null; } };
      document.addEventListener('pointerdown', start, { once: true });
      const vis = () => { if (document.hidden) stop(); };
      document.addEventListener('visibilitychange', vis);
      return () => { footage(); removeEventListener('hashchange', hall); document.removeEventListener('pointerdown', start); document.removeEventListener('visibilitychange', vis); stop(); };
    } });

  /* ---------------- Nothing: no styling. The same layout, but the page looks like plain HTML: white, Times, blue
     underlined links, the browser's own buttons and fields, no colours, shadows, rounding or effects. ---------------- */
  R({ id: 'nothing', name: 'Nothing', category: 'Useful', tagline: 'No styling: the same layout as plain HTML. White page, Times, the browser’s own buttons and fields, blue links.',
    font: '"Times New Roman",Times,serif',
    vars: { '--ambient': 'off', '--bg': '#ffffff', '--panel': '#ffffff', '--side': '#ffffff', '--text': '#000000', '--muted': '#000000', '--faint': '#555555', '--line': '#000000', '--hover': 'transparent',
      '--accent': '#0000ee', '--on-accent': '#ffffff', '--accent-soft': 'transparent', '--client': '#000000', '--client-soft': 'transparent', '--ok': '#000000', '--danger': '#000000', '--danger-soft': 'transparent', '--r': '0px', '--shadow': 'none' },
    preview: { bg: '#fff', panel: '#fff', side: '#fff', text: '#000', accent: '#0000ee', line: '#000', r: '0' },
    css: `:skin body,:skin .app,:skin .main,:skin .side{background:#fff!important;color:#000;font-size:16px}
      :skin *{box-shadow:none!important;text-shadow:none!important;border-radius:0!important;transition:none!important;animation:none!important;backdrop-filter:none!important}
      :skin .side{border-right:1px solid #000}
      :skin .group,:skin .gl,:skin .stat,:skin .qa,:skin .modal,:skin .task,:skin .chip,:skin .ntile,:skin .nav a{background:transparent!important;border-color:transparent}
      :skin .head h1,:skin .c-hero h1{font:bold 32px "Times New Roman",Times,serif;color:#000;letter-spacing:0;text-transform:none}
      :skin .group-h,:skin .th-cat{font:bold 18.7px "Times New Roman",Times,serif;color:#000;text-transform:none;letter-spacing:0}
      :skin a,:skin .link,:skin [data-act].lnk{color:#0000ee;text-decoration:underline}
      :skin a:visited{color:#551a8b}
      :skin .btn,:skin .btn.primary,:skin .meet-btn,:skin button.btn{appearance:auto;-webkit-appearance:button;background:ButtonFace;color:ButtonText;border:2px outset ButtonBorder;font:13.33px Arial,sans-serif;padding:1px 6px}
      :skin input,:skin select,:skin textarea,:skin .inp{appearance:auto;background:Field;color:FieldText;border:2px inset ButtonBorder;font:13.33px Arial,sans-serif}
      :skin .check{appearance:auto;border:1px solid #000;background:#fff}
      :skin .task.done .check{background:#000}
      :skin .ntile.on,:skin .nav a.on,:skin .side .ntile.on{font-weight:bold;text-decoration:underline;color:#000}
      :skin .ftoast{background:#fff;color:#000;border:1px solid #000}
      :skin hr{border:0;border-top:1px solid #000}` });
})();
