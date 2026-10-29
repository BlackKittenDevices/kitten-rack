// SPDX-License-Identifier: GPL-3.0-only
// KITTEN RACK: the rack editor live with the FM-1, end to end on Linux: the firmware's M1_EMU_MIDI build on the emulator
// (m1emu serve, its USB MIDI on a TCP socket: tools/emu/src/serve.rs), the built editor in Chromium (Playwright), Web MIDI
// faked in the page and bridged to that socket. Checks: the editor reads the FM-1's patch, a knob turned on either side
// reaches the other, a module added in the editor reaches the FM-1, one added on the FM-1's rack page reaches the editor,
// PRESET on the FM-1 opens that patch in the editor, and AL FM-1 stores into a slot.
//   node scripts/rack-link-e2e.mjs EMU_APP.bin EDITOR_DIR      (EDITOR_DIR: vite build --base ./ of this checkout)
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');   // (the one installed with Chromium: global, or web/node_modules)

const [fw, dir] = process.argv.slice(2).map((p) => resolve(p));
const ROOT = new URL('../../', import.meta.url).pathname;
const M1EMU = join(ROOT, 'tools/emu/target/release/m1emu');
const PORT = 5199 + Math.floor(Math.random() * 400);
let fails = 0;
const check = (what, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`); if (!ok) fails++; };

// the emulator, its command line (one answer per command)
const emu = spawn(M1EMU, ['serve', fw], { env: { ...process.env, M1EMU_MIDI_TCP: String(PORT) }, stdio: ['pipe', 'pipe', 'inherit'] });
const answers = [];
let waiting = [];
let buf = '';
emu.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (line.startsWith('# ')) continue;
    const w = waiting.shift();
    if (w) w(line); else answers.push(line);
  }
});
const cmd = (c) => new Promise((res) => { waiting.push(res); emu.stdin.write(`${c}\n`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a static server for the built editor
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const http = createServer((req, res) => {
  const p = join(dir, decodeURIComponent((req.url ?? '/').split('?')[0]));
  if (!existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => http.listen(0, '127.0.0.1', r));
const site = `http://localhost:${http.address().port}/rack.html`;

try {
  await cmd('until 20000 INIT');   // (the first boot writes the factory bank)
  // the socket: framed messages both ways
  let sock;
  for (let t = 0; t < 50 && !sock; t++) {
    sock = await new Promise((res) => { const s = createConnection(PORT, '127.0.0.1'); s.once('connect', () => res(s)); s.once('error', () => res(null)); });
    if (!sock) await sleep(200);
  }
  if (!sock) throw new Error('no MIDI socket from m1emu serve');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.exposeFunction('__toEmu', (bytes) => {
    const b = Buffer.from(bytes);
    const h = Buffer.alloc(2);
    h.writeUInt16LE(b.length);
    sock.write(Buffer.concat([h, b]));
  });
  let rx = Buffer.alloc(0);
  sock.on('data', (d) => {
    rx = Buffer.concat([rx, d]);
    while (rx.length >= 2 && rx.length >= 2 + rx.readUInt16LE(0)) {
      const n = rx.readUInt16LE(0);
      const msg = [...rx.subarray(2, 2 + n)];
      rx = rx.subarray(2 + n);
      void page.evaluate((m) => window.__fromEmu?.(m), msg).catch(() => {});
    }
  });
  await page.addInitScript(() => {
    const listeners = new Set();
    const input = { id: 'emu-in', name: 'FM-1 (emu)', state: 'connected', type: 'input', onmidimessage: null, addEventListener: () => {}, removeEventListener: () => {} };
    const output = { id: 'emu-out', name: 'FM-1 (emu)', state: 'connected', type: 'output', send: (d) => window.__toEmu(Array.from(d)) };
    window.__fromEmu = (m) => { const ev = { data: Uint8Array.from(m) }; input.onmidimessage?.(ev); };
    const access = { inputs: new Map([['emu-in', input]]), outputs: new Map([['emu-out', output]]), onstatechange: null, sysexEnabled: true };
    void listeners;
    navigator.requestMIDIAccess = async () => access;
  });
  await page.goto(site);
  await page.waitForTimeout(800);
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('kittenrack.current') ?? 'null'));
  const toast = () => page.locator('#toast').textContent();

  // 1. connect: the editor shows the FM-1's patch
  await page.click('#link');
  await page.waitForFunction(() => /EN VIVO/.test(document.querySelector('#link')?.textContent ?? ''), null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  let p = await stored();
  check(`connected: the editor shows the FM-1's patch (${p?.name}, ${p?.modules.length} modules)`, p?.name === 'init' && p.modules.some((m) => m.type === 'steps'));
  const n0 = p.modules.length;

  // 2. the FM-1's PRESET: the editor follows
  await cmd('turn 6 1');
  await page.waitForTimeout(4000);
  p = await stored();
  check(`PRESET on the FM-1: the editor opens it (${p?.name})`, p?.name === 'muug tape');

  // 3. a knob on the FM-1 (K1 on its device page): the editor's value moves
  const before = JSON.stringify(p.modules.map((m) => m.params));
  await cmd('turn 2 6');
  await page.waitForTimeout(1500);
  p = await stored();
  check('K1 turned on the FM-1: a parameter changed in the editor', JSON.stringify(p.modules.map((m) => m.params)) !== before);

  // 4. a knob in the editor: the FM-1 has it (read back after a reconnect)
  await page.evaluate(() => {   // (the cables lie over the panel: the wheel straight into the knob)
    const svg = document.querySelector('.panel.t-muug .knob svg');
    for (let i = 0; i < 6; i++) svg?.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(600);
  const mine = (await stored()).modules.find((m) => m.type === 'muug');
  check('the wheel on the Muug\'s first knob moved it in the editor', JSON.stringify(mine.params) !== JSON.stringify(p.modules.find((m) => m.type === 'muug').params));
  await page.click('#link');
  await page.click('#link');
  await page.waitForFunction(() => /EN VIVO/.test(document.querySelector('#link')?.textContent ?? ''), null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  const back = (await stored()).modules.find((m) => m.type === 'muug');
  const key = Object.keys(mine.params).find((k) => Math.abs((mine.params[k] ?? 0) - (back?.params[k] ?? 0)) > 1e-3);
  check(`a knob turned in the editor: the FM-1 holds it (${key ? `differs at ${key}` : 'same values'})`, !!back && !key);

  // 5. a module added in the editor: the FM-1 has it
  const nBefore = (await stored()).modules.length;
  await page.locator('#catalog button.add', { hasText: 'RUIDO' }).first().click();
  await page.waitForTimeout(1500);
  await page.click('#link');
  await page.click('#link');
  await page.waitForFunction(() => /EN VIVO/.test(document.querySelector('#link')?.textContent ?? ''), null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  p = await stored();
  check(`RUIDO added in the editor: the FM-1 plays it (${nBefore} -> ${p.modules.length} modules)`, p.modules.length === nBefore + 1 && p.modules.some((m) => m.type === 'noise'));

  // 6. a module added on the FM-1's rack page: the editor shows it
  const nDev = p.modules.length;
  for (const c of ['tap 6', 'wait 400', 'turn 0 2', 'wait 300', 'tap 3', 'wait 400', 'turn 0 4', 'wait 300', 'tap 3', 'wait 600']) await cmd(c);
  await page.waitForTimeout(3500);
  p = await stored();
  check(`a module added on the FM-1 (EDIT): the editor shows it (${nDev} -> ${p.modules.length})`, p.modules.length === nDev + 1);
  await cmd('tap 6');   // (out of the patching)

  // 7. notes placed on the piano roll: the FM-1's track has them
  await page.locator('.panel.t-steps .roll-open').first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const g = document.querySelector('.roll-grid');
    const r = g.getBoundingClientRect();
    const y = (108 - 60) * 16 + 8;   // C4
    for (const k of [0, 4, 8, 12]) {
      const x = 44 + k * 22 + 10;
      g.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + x, clientY: r.top + y, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: r.left + x, clientY: r.top + y, bubbles: true }));
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(ROOT, 'build/rack-roll.png') });
  await page.click('#roll-box button:has-text("LISTO")');
  await page.click('#link');
  await page.click('#link');
  await page.waitForFunction(() => /EN VIVO/.test(document.querySelector('#link')?.textContent ?? ''), null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  p = await stored();
  const trk = p.modules.find((m) => m.type === 'steps');
  check(`four notes on the roll: the FM-1's track holds them (${trk?.notes?.length ?? 0})`, trk?.notes?.length === 4 && trk.notes.every((n) => n.note === 60));

  // 8. AL FM-1: into a slot
  await page.click('#tofm1');
  await page.waitForTimeout(6000);
  const opts = await page.locator('#slot-list option').count();
  await page.selectOption('#slot-list', '40');
  await page.fill('#slot-name', 'E2E TEST');
  await page.click('#slot-ok');
  await page.waitForTimeout(3000);
  check(`AL FM-1: the bank listed (${opts} slots), stored in slot 41 (${await toast()})`, opts === 64 && /lugar 41/.test((await toast()) ?? ''));
  check(`no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`, errors.length === 0);
  await page.screenshot({ path: join(ROOT, 'build/rack-link-e2e.png') });
  await browser.close();
  sock.destroy();
} catch (e) {
  console.log(`FAIL  ${e.message}`);
  fails++;
} finally {
  emu.stdin.write('quit\n');
  setTimeout(() => emu.kill(), 500);
  http.close();
}
console.log(fails ? `rack link e2e FAILED (${fails})` : 'rack link e2e ok');
process.exitCode = fails ? 1 : 0;
setTimeout(() => process.exit(process.exitCode), 1000);
