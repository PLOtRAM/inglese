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
assert.equal(S.planOf(w, new Date('2026-11-10T12:00'), 2).target, 30);   // martedì, allenamento: 30′ per tipo come il turno
assert.equal(S.planOf(w, sun, 0).target, 15);                            // partita: resta 15′
assert.equal(S.planOf({week:{monday:'2026-11-09', type:'sab'}}, sun, 0).target, 30);        // giorno libero dopo la partita del sabato
assert.equal(S.planOf({week:{monday:'2026-11-09', type:'sab'}}, new Date('2026-11-14T12:00'), 6).target, 15);   // partita di sabato
// nessun piano ha più il vecchio obiettivo da 45′
for(const t of Object.keys(S.WEEKS)) for(let d = 0; d < 7; d++) assert.ok(S.dayPlan(t, d).target <= 30);

// dayQuests: tre missioni core fanno la giornata piena, i bonus danno solo punti
let Q = S.dayQuests({}, {}, '2026-11-12', 30);
assert.equal(Q.pts, 0); assert.equal(Q.full, false);
const full30 = {'2026-11-12': {u:'min', sem:30, quo:30, tec:30}}, wd = {words:[{date:'2026-11-12'}]};
Q = S.dayQuests(full30, wd, '2026-11-12', 30);
assert.equal(Q.full, true); assert.equal(Q.pts, 10 + 20 + 10 + S.FULL_BONUS);
Q = S.dayQuests(full30, Object.assign({revDays:['2026-11-12'], sem:{comp:[{d:'2026-11-12', p:60}]}}, wd), '2026-11-12', 30);
assert.equal(Q.pts, Q.max);                                                                // tutto: bonus compresi
assert.equal(S.dayQuests(full30, {}, '2026-11-12', 30).full, false);                      // senza parola nuova non è piena
assert.equal(S.dayQuests({'2026-11-12': {u:'min', sem:15, quo:15, tec:15}}, wd, '2026-11-12', 30).items.find(x => x.id==='obj').done, false);
assert.equal(S.dayQuests({}, {history:[{comp:[{d:'2026-11-12', p:80}]}]}, '2026-11-12', 30).items.find(x => x.id==='cmp').done, true);   // stima fatta prima di chiudere lo spezzone
// i punti e le giornate piene arrivano dentro achieve
const AQ = S.achieve(full30, wd, '2026-11-12', 30);
assert.equal(AQ.vals.piene, 1); assert.equal(AQ.vals.punti, 60);
assert.ok(AQ.earned.includes("piene:1"));
assert.equal(S.achieve(full30, wd, '2026-11-12', 45).vals.piene, 0);                       // oggi vale l'obiettivo di oggi
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

// achieve: percorsi, missioni della settimana, traguardi
const dayList = (from, n, v) => Object.fromEntries(Array.from({length:n}, (_,i) => { const d = new Date(from+'T12:00'); d.setDate(d.getDate()+i); return [S.ymd(d), Object.assign({u:'min', g:30}, v)]; }));
let A = S.achieve({}, {}, '2026-11-12', 30);
assert.deepEqual(A.earned, []);
assert.equal(A.vals.serie, 0);
assert.equal(A.week.length, 4);
assert.equal(S.achieve(undefined, undefined, '2026-11-12', 30).earned.length, 0);          // dati assenti: nessun errore
// sette giorni col minimo: tappe 1, 3 e 7 della serie, non la 14
A = S.achieve(dayList('2026-11-06', 7, {sem:15, quo:15, tec:15}), {}, '2026-11-12', 30);
assert.ok(['serie:1','serie:3','serie:7'].every(id => A.earned.includes(id)));
assert.ok(!A.earned.includes('serie:14'));
assert.equal(A.vals.obiettivo, 0);                                                         // 15′ non è l'obiettivo di 30′
// il giorno in corso usa l'obiettivo di oggi, quelli passati il loro
A = S.achieve({'2026-11-12':{u:'min', sem:45, quo:45, tec:45, g:30}, '2026-11-11':{u:'min', sem:30, quo:30, tec:30, g:45}}, {}, '2026-11-12', 45);
assert.equal(A.vals.obiettivo, 1);
// parole, imparate, ripasso, spezzoni
const manyWords = Array.from({length:12}, (_,i) => ({date:'2026-11-10', got:i<10}));
A = S.achieve({}, {words: manyWords, revDays:['2026-11-10','2026-11-11','2026-11-12'], history:[{}]}, '2026-11-12', 30);
assert.ok(['parole:10','imparate:10','ripasso:3','spezzoni:1'].every(id => A.earned.includes(id)));
assert.equal(A.week.find(m => m.id==='par').val, 12);
// settimana d'oro: lunedì-domenica contano a sé; una nuova settimana riparte da zero
const gold = {days:dayList('2026-11-09', 7, {sem:30, quo:30, tec:30}), state:{words:Array.from({length:5}, () => ({date:'2026-11-10'})), revDays:['2026-11-09','2026-11-10','2026-11-11','2026-11-12']}};
A = S.achieve(gold.days, gold.state, '2026-11-15', 30);              // domenica
assert.equal(A.weekGold, true);
assert.ok(A.earned.includes('settimane:1'));
A = S.achieve(gold.days, gold.state, '2026-11-16', 30);              // lunedì dopo: missioni a zero, ma la settimana d'oro resta
assert.equal(A.weekGold, false);
assert.equal(A.week.find(m => m.id==='min').val, 0);
assert.ok(A.earned.includes('settimane:1'));
// percorsi che contano gli altri
assert.ok(A.vals.fronti >= 2 && A.vals.collezione >= 5);
// le vecchie tappe restano: stesse soglie dei 14 traguardi di prima
['serie:1','serie:3','serie:7','serie:30','obiettivo:1','obiettivo:10','spezzoni:1','spezzoni:5','parole:10','imparate:10','ripasso:7'].forEach(id => {
  const [t, n] = id.split(':'); assert.ok(S.TRACKS.find(x => x.id===t).tiers.some(x => x[0]===+n), id);
});
// ogni percorso ha soglie crescenti e le tappe di quelli base stanno sotto i limiti di conservazione dei dati (parole 500, storico 100, ripasso 200)
S.TRACKS.forEach(t => t.tiers.forEach((x, i) => { if(i) assert.ok(x[0] > t.tiers[i-1][0], t.id); }));
assert.ok(Math.max(...S.TRACKS.find(t => t.id==='parole').tiers.map(x => x[0])) < 500);
assert.ok(Math.max(...S.TRACKS.find(t => t.id==='spezzoni').tiers.map(x => x[0])) <= 100);

// paceOf: stessi giorni, settimana scorsa contro questa
const pd = {};   // sett. scorsa: lun 30, mar 45; questa: lun 60, mar 30 (+ oggi, che non conta)
pd['2026-11-02'] = {u:'min', sem:10, quo:10, tec:10}; pd['2026-11-03'] = {u:'min', sem:15, quo:15, tec:15};
pd['2026-11-09'] = {u:'min', sem:20, quo:20, tec:20}; pd['2026-11-10'] = {u:'min', sem:10, quo:10, tec:10}; pd['2026-11-11'] = {u:'min', sem:99, quo:99, tec:99};
assert.equal(S.paceOf(pd, '2026-11-09'), null);                                  // lunedì: nessun giorno finito
let P = S.paceOf(pd, '2026-11-11');                                              // mercoledì: confronto lun+mar, mercoledì escluso
assert.deepEqual([P.cur, P.prev, P.diff, P.days], [90, 75, 15, 2]);
assert.equal(S.paceOf(pd, '2026-11-15').days, 6);                                // domenica: sei giorni finiti
assert.equal(S.paceOf({'2026-11-09': pd['2026-11-09']}, '2026-11-11'), null);    // settimana scorsa vuota
assert.equal(S.paceOf(undefined, '2026-11-11'), null);
assert.equal(S.paceOf(pd, '2026-11-16'), null);                                  // lunedì dopo: riparte da zero

// nextBlockLabel: il Semplificato avanza di un blocco alla volta, leggendo il testo
assert.equal(S.nextBlockLabel('Peppa Pig, stagione 1, episodi 1-3 (~15′)'), 'Peppa Pig, stagione 1, episodi 4-6 (~15′)');
assert.equal(S.nextBlockLabel('Peppa Pig, stagione 2, episodi 10–12'), 'Peppa Pig, stagione 2, episodi 13-15');          // trattino lungo, senza durata
assert.equal(S.nextBlockLabel('Peppa Pig, stagione 1, episodi 5-5 (~5′)'), 'Peppa Pig, stagione 1, episodi 6-6 (~5′)');   // blocco da uno
assert.equal(S.nextBlockLabel('Peppa Pig (~5′)'), 'Peppa Pig, stagione 1, episodi 1-3');                                   // testo libero: punto di partenza
assert.equal(S.nextBlockLabel('Peppa Pig, stagione 1, episodi 6-4'), 'Peppa Pig, stagione 1, episodi 1-3');          // blocco impossibile: si riparte dal punto di partenza
assert.equal(S.nextBlockLabel(''), '');
assert.equal(S.nextBlockLabel(undefined), '');

// levelOf: soglie in ore, sul totale in minuti
assert.equal(S.levelOf(0), 0); assert.equal(S.levelOf(179), 0); assert.equal(S.levelOf(180), 1); assert.equal(S.levelOf(600), 2);
assert.equal(S.levelOf(500*60), S.LEVELS.length - 1); assert.equal(S.levelOf(99999*60), S.LEVELS.length - 1);

console.log('shared.js: tutto a posto');
