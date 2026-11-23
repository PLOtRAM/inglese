// Prova nel browser: node tools/test-browser.mjs
// Carica l'app a 375x812 con i dati veri di ../inglese-dati/data.json (letti al volo, mai copiati qui: questo repository è pubblico),
// in tema scuro e chiaro, e controlla: nessun errore in console, ogni sezione del dock ha contenuto, nessuna rete esterna.
// Screenshot in test-artifacts/ (ignorata da git). Non prova: iPhone vero, notifiche push, scrittura su GitHub.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dati = path.join(root, '..', 'inglese-dati', 'data.json');
if (!fs.existsSync(dati)) { console.log('SALTATO: manca ' + dati); process.exit(0); }
const data = JSON.parse(fs.readFileSync(dati, 'utf8'));
const cache = JSON.stringify({ days: data.days, state: data.state, log: data.log || [], feed: null, report: null, sha: null });

const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404).end(); return; }
  r.writeHead(200, { 'content-type': TIPI[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
}).listen(0);
const base = 'http://localhost:' + srv.address().port;
fs.mkdirSync(path.join(root, 'test-artifacts'), { recursive: true });

// Chromium già in cache (revisione 1223); se Playwright ne vuole un'altra basta `npx playwright install chromium` e togliere executablePath
const exe = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe');
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
let fail = 0;
for (const tema of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  // niente rete esterna: eviterebbe scritture su GitHub e di sporcare la cache CORS dei servizi gratuiti (vedi CLAUDE.md dei dati)
  const esterne = [];
  await ctx.route(u => !new URL(u).hostname.match(/^localhost$/), r => { esterne.push(r.request().url()); r.abort(); });
  await ctx.addInitScript(([c, t]) => { localStorage.setItem('cache', c); localStorage.setItem('tema', t); }, [cache, tema]);
  const page = await ctx.newPage();
  const errori = [];
  page.on('pageerror', e => errori.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errori.push('console: ' + m.text()); });
  await page.goto(base + '/');
  await page.waitForSelector('.dock a');
  const sezioni = await page.$$eval('.dock a', as => as.map(a => a.getAttribute('href')));
  assert.ok(sezioni.length >= 4, 'dock con meno di 4 voci');
  for (const h of sezioni) {
    await page.click(`.dock a[href="${h}"]`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(root, 'test-artifacts', `${tema}-${h.slice(1)}.png`) });
    const testo = await page.evaluate(() => document.body.innerText.trim().length);
    try { assert.ok(testo > 200, `${tema} ${h}: pagina quasi vuota (${testo} caratteri)`); } catch (e) { console.log('KO', e.message); fail++; }
  }
  try { assert.deepEqual(errori, [], `${tema}: errori nel browser`); console.log(`ok ${tema}: ${sezioni.join(' ')}, rete esterna bloccata: ${esterne.length}`); }
  catch (e) { console.log('KO', e.message, errori); fail++; }
  await ctx.close();
}
await browser.close(); srv.close();
if (fail) { console.log(fail + ' problemi'); process.exit(1); }
console.log('browser: prove ok');
