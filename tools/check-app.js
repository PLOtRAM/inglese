// Controlli rapidi prima/dopo la pubblicazione. Si lancia con: node tools/check-app.js
// Legge gli script dentro index.html, controlla sw.js e che shared.js esporti ciò che serve all'automazione dei dati.
const fs = require('fs'), assert = require('node:assert/strict'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('index.html');

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert.ok(scripts.length >= 2, 'mancano gli script in index.html');
scripts.forEach((s, i) => { try{ new Function(s); }catch(e){ throw new Error('script '+i+' di index.html: '+e.message); } });
new Function(read('sw.js'));                                           // solo lettura del codice: usa `self`, che qui non esiste
assert.match(html, /const APP_VERSION = '\d{4}\.\d{2}\.\d{2}-\d+'/, 'APP_VERSION mancante o in un altro formato');
// la prima voce delle novità deve essere la versione corrente: così non ci si dimentica di scrivere cosa è cambiato
const ver = /const APP_VERSION = '([^']+)'/.exec(html)[1], nov = /const NOVITA = \[\s*\['([^']+)'/.exec(html);
assert.ok(nov && nov[1] === ver, 'la prima voce di NOVITA ('+(nov && nov[1])+') non è APP_VERSION ('+ver+')');

// daily.mjs (repository dei dati, privato) importa questi nomi da shared.js: se ne togli uno, la notifica del mattino si rompe senza che l'app se ne accorga.
// Tieni questo elenco uguale a quello in testa a daily.mjs.
const NEEDED = ['streakOf', 'K', 'NAMES', 'ymd', 'mondayOf', 'dueOf', 'planOf'];
const S = require('../shared.js');
NEEDED.forEach(n => assert.ok(n in S, 'shared.js non esporta '+n));

// elementi che il codice cerca per id: se uno sparisce l'app si ferma al caricamento
['fab','sheet','qform','q-word','missions','paths','metapaths','lastach','setup','setupsum','appver','updbtn','whatsnew','now','mixer','report','piano','podsum','themes']
  .forEach(id => assert.ok(html.includes('id="'+id+'"'), 'in index.html manca #'+id));

console.log('app: controlli ok');
