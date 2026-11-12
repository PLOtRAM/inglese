// Prove sulle regole di shared.js. Si lanciano con: node tools/test-shared.js
const assert = require('node:assert/strict');
const S = require('../shared.js');

// advanceEp: la durata viene da "(~N′)" nell'etichetta, altrimenti 20′
assert.deepEqual(S.advanceEp({s:1, e:1, min:0}, 25), {s:1, e:2, min:5});
assert.deepEqual(S.advanceEp({s:1, e:1, min:0, label:'Peppa Pig (~5′)'}, 12), {s:1, e:3, min:2, label:'Peppa Pig (~5′)'});
assert.deepEqual(S.advanceEp({s:1, e:2, min:3, label:'The Office · (~20′)'}, -5), {s:1, e:1, min:18, label:'The Office · (~20′)'});
assert.equal(S.advanceEp({s:1, e:1, min:2}, -10).min, 0);      // non scende sotto l'episodio 1
assert.equal(S.advanceEp(undefined, 0).e, 1);                  // stato vuoto

// planOf: senza tipo di settimana turno da lunedì a sabato, domenica da 15′
const mon = new Date('2026-11-09T12:00'), sun = new Date('2026-11-15T12:00');
assert.equal(S.planOf({}, mon, 1).target, 30);
assert.equal(S.planOf({}, sun, 0).kind, 'Domenica');
const w = {week:{monday:'2026-11-09', type:'dom'}};
assert.equal(S.planOf(w, new Date('2026-11-11T12:00'), 3).target, 30);   // mercoledì, non allenamento
assert.equal(S.planOf(w, new Date('2026-11-10T12:00'), 2).target, 45);   // martedì, allenamento
assert.equal(S.planOf(w, sun, 0).kind, 'Partita');
assert.equal(S.planOf({week:{monday:'2026-11-02', type:'dom'}}, mon, 2).target, 30);   // tipo scaduto: vale solo la sua settimana

// dueOf: solo parole non ancora sapute e scadute
const words = [{t:'a'}, {t:'b', due:'2026-11-13'}, {t:'c', due:'2026-11-12'}, {t:'d', got:true}, {due:'2026-01-01'}];
assert.deepEqual(S.dueOf(words, '2026-11-12').map(x => x.t), ['a', 'c']);
assert.deepEqual(S.dueOf(undefined, '2026-11-12'), []);

// streakOf: tre giorni col minimo, un giorno saltato coperto dal jolly del mese
const ok = {u:'min', sem:15, quo:15, tec:15};
assert.equal(S.streakOf({'2026-11-10':ok, '2026-11-11':ok, '2026-11-12':ok}, '2026-11-12').streak, 3);
const gap = S.streakOf({'2026-11-10':ok, '2026-11-12':ok}, '2026-11-12');
assert.equal(gap.streak, 2);
assert.deepEqual(gap.used, ['2026-11-11']);
assert.equal(S.streakOf({}, '2026-11-12').streak, 0);

console.log('shared.js: tutto a posto');
