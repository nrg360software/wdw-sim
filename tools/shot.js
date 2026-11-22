// Screenshot views of the game for visual checks (Playwright + SwiftShader). usage: node tools/shot.js views.json outdir [index.html]
// Needs: npm install three@0.180.0 in /home/claude/t (path T below). View: {n,pk,pl:[lx,lz],ty,dir:[dx,dz],d,ch,h,gfx,date,nopin,wait}
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const views = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3] || 'shots';
const html = fs.readFileSync(process.argv[4] || '/home/claude/wdw-sim/index.html', 'utf8');
fs.mkdirSync(out, { recursive: true });
const T = '/home/claude/t/node_modules/three/';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) });
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('https://game.test/planner.js')) return r.fulfill({ body: fs.readFileSync(require('path').join(__dirname, '..', 'planner.js')), contentType: 'application/javascript' }); // row 67
    if (u.startsWith('https://game.test/')) return r.fulfill({ body: html, contentType: 'text/html' });
    const m = u.match(/three@0\.180\.0\/(.*)$/);
    if (m) { const f = T + m[1]; if (fs.existsSync(f)) return r.fulfill({ body: fs.readFileSync(f), contentType: 'application/javascript' }); }
    if (u.includes('workers.dev')) return r.fulfill({ status: 503, body: '' });
    return r.continue();
  });
  await p.goto('https://game.test/');
  await p.waitForFunction(() => window.WDW && window.WDW.scene, null, { timeout: 120000 });
  await p.addStyleTag({ content: '#start{display:none!important}' });
  for (const v of views) {
    await p.evaluate(v => {
      const W = window.WDW, P = W.PARKS[v.pk || 'MK'];
      const tw = (lx, lz) => { const c = Math.cos(P.rot), s = Math.sin(P.rot), k = P.sc || 1; lx *= k; lz *= k; return [P.c[0] + lx * c - lz * s, P.c[1] + lx * s + lz * c] };
      if (v.date) document.querySelector('#inDate').value = v.date;
      if (v.gfx) W.setGfx(v.gfx);
      W.holdTime(v.h || 12);
      const t = tw(v.pl[0], v.pl[1]);
      const d0 = tw(v.pl[0] + v.dir[0], v.pl[1] + v.dir[1]); let dx = d0[0] - t[0], dz = d0[1] - t[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      W.controls.target.set(t[0], v.ty || 0, t[1]);
      W.camera.position.set(t[0] + dx * v.d, v.ch, t[1] + dz * v.d);
      W.controls.update();
      W.RIDES.forEach(r => { if (r.pin) r.pin.visible = !v.nopin });
    }, v);
    await p.waitForTimeout(v.wait || 5000);
    const info = await p.evaluate(() => window.WDW.renderer.info.render.calls);
    await p.screenshot({ path: path.join(out, v.n + '.png') });
    console.log(v.n, 'calls', info);
  }
  console.log('errors:', errs.slice(0, 10).join('\n'));
  await b.close();
})();
