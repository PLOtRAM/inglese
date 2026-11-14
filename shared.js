// Regole comuni all'app e al report del mattino (che gira su GitHub Actions nel repository dei dati).
const K = ['sem','quo','tec'];
const NAMES = {sem:'Semplificato', quo:'Quotidiano', tec:'Tecnico'};
const TOPICS = ['At The Money','Big Take','Merryn','Everybody’s Business','Odd Lots'];
const nextTopic = t => TOPICS[(TOPICS.indexOf(t)+1)%TOPICS.length];
const pad = n => String(n).padStart(2,'0');
const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
function mondayOf(d){ const m = new Date(d); m.setDate(m.getDate()-(m.getDay()+6)%7); return ymd(m); }

const WEEKS = {dom:'Partita domenica', sab:'Partita sabato', post:'Dopo partita di sabato'};
const TRAIN = {dom:[2,4,5], sab:[3,4,5], post:[1,3,5]};   // giorni di allenamento (getDay: 0 = domenica)
// Obiettivo in minuti per tipo e scaletta di un giorno, dato il tipo di settimana
function dayPlan(type, wd){
  const match = type==='sab' ? wd===6 : wd===0;
  if(match) return {kind:'Partita', target:15, rows:[
    ['In casa','Tecnico nel viaggio verso il campo, Peppa Pig e The Office nell’ora dopo il pranzo'],
    ['In trasferta','Tutti e tre in pullman, con le cuffie']]};
  if(type==='sab' && wd===0) return {kind:'Giorno libero', target:30, rows:[
    ['A casa','30′ di Peppa Pig, 30′ di The Office, 30′ di tecnico']]};
  if(TRAIN[type].includes(wd)) return {kind:'Turno e allenamento', target:30, rows:[
    ['Andata al lavoro','Tecnico'],
    ['Prime ore del turno','15′ di Peppa Pig, 15′ di The Office'],
    ['Dalle 13','15′ di Peppa Pig, 15′ di The Office'],
    ['Ritorno a casa','Tecnico'],
    ['Viaggio al campo','Tecnico, se ti mancano minuti ai 30′'],
    ['Ritorno dal campo','Libero: novità Bloomberg, se ti va']]};
  return {kind:'Turno', target:30, rows:[
    ['Andata al lavoro','Tecnico'],
    ['Prime ore del turno','15′ di Peppa Pig, 15′ di The Office'],
    ['Dalle 13','15′ di Peppa Pig, 15′ di The Office'],
    ['Ritorno a casa','Tecnico']]};
}
// Piano del giorno `wd` per lo stato dato. Il tipo di settimana vale solo nella settimana in cui è stato scelto;
// senza tipo: turno dal lunedì al sabato, 15′ la domenica.
function planOf(state, now, wd){
  const w = state && state.week, type = w && w.monday===mondayOf(now) ? w.type : null;
  return type ? dayPlan(type, wd) : Object.assign(dayPlan('dom', wd===0 ? 0 : 1), wd===0 ? {kind:'Domenica'} : {});
}

// Episodio da prendere per un podcast, tra gli ultimi usciti
function pickEpIn(feed, name){
  const eps = (feed && feed.pods && feed.pods[name]) || [];
  if(name==='Big Take') return eps.find(e => !/^weekend listen/i.test(e.title) && e.min<=30) || eps[0];
  if(name==='Merryn') return eps.find(e => e.min<=32) || eps[0];     // mercoledì o venerdì, non l'intervista lunga
  return eps[0];
}
const epTitle = e => e.title.replace(/^at the money:\s*/i,'');
const epLabel = (name, e) => name+' · '+epTitle(e)+' ('+e.min+'′)';
// Parola: significati e esempi. `t` = significati separati da «;» (sinonimi con la virgola); `ex` = una riga per esempio, «frase inglese — traduzione» (vale anche «|»).
// Se i significati e gli esempi sono in numero uguale si abbinano uno a uno, altrimenti prima i significati e poi gli esempi.
function senses(w){
  const meanings = ((w && w.t) || '').split(/\s*;\s*/).filter(Boolean);
  const examples = ((w && w.ex) || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const p = l.split(/\s+[—–|]\s+/); return {e:p[0], i:p.slice(1).join(' — ')}; });
  return {meanings, examples, paired: meanings.length > 1 && meanings.length === examples.length};
}
// Provenienza: solo i tre pilastri. I dati vecchi (Peppa Pig, The Office, nomi dei podcast) si leggono come il pilastro giusto.
const PILLARS = ['Semplificato','Quotidiano','Tecnico'];
const pillarOf = s => PILLARS.includes(s) ? s : s==='Peppa Pig' ? 'Semplificato' : s==='The Office' ? 'Quotidiano' : TOPICS.includes(s) ? 'Tecnico' : '';
/* ---------- Ripasso delle parole: l'algoritmo di Anki (scheduler classico SM-2, letto in rslib/src/scheduler/states di ankitects/anki) ----------
   Uguale ad Anki: facilità iniziale 2,5 (minimo 1,3; Di nuovo −0,2, Difficile −0,15, Facile +0,15), Difficile ×1,2, Facile ×1,3, intervallo dopo un errore 1 giorno,
   primo intervallo 1 giorno (4 con Facile), bonus per il ritardo (metà dei giorni di ritardo con Bene, tutti con Facile), regole per i ripassi in anticipo,
   «fuzz» (±) sugli intervalli da 2,5 giorni in su, sempre Difficile < Bene < Facile.
   Diverso da Anki: i passi di 1 e 10 minuti non hanno attese vere (restano dentro la sessione), nessun limite di carte al giorno, nessuna regola per le parole «sanguisuga». */
function fuzzSeed(s){      // numero fisso in [0,1) per parola e ripasso: l'etichetta del tasto e la risposta danno lo stesso intervallo
  let h = 2166136261; for(const c of String(s)){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h = Math.imul(h ^ (h>>>15), 2246822507); return (((h ^ (h>>>13)) >>> 0)) / 4294967296;
}
function fuzzIvl(iv, min, f){      // porta di constrained_fuzz_bounds / with_review_fuzz
  const max = 36500; min = Math.min(min, max); iv = Math.min(max, Math.max(min, iv));
  let d = 0; if(iv >= 2.5){ d = 1; [[2.5,7,.15],[7,20,.1],[20,1e9,.05]].forEach(([s,e,k]) => { d += k*Math.max(0, Math.min(iv,e)-s); }); }
  let lo = Math.min(max, Math.max(min, Math.round(iv-d))), up = Math.min(max, Math.max(min, Math.round(iv+d)));
  if(up===lo && up>2 && up<max) up = lo+1;
  return Math.floor(lo + f*(1+up-lo));
}
// g: 0 di nuovo, 1 difficile, 2 bene, 3 facile. step: passo nella sessione (undefined = carta già in ripasso). late: giorni di ritardo (negativo = in anticipo). f: fuzz fisso (solo per i test).
function srs(w, step, g, late, f){
  let ivl = w.ivl||0, ease = w.ease||2.5; const lapses = w.lapses||0;
  late = late||0; if(f==null) f = fuzzSeed(w.id+':'+(w.reps||0));
  if(ivl>0 && step===undefined){
    if(g===0) return {ivl:1, ease:Math.max(1.3, ease-.2), lapses:lapses+1, again:true, step:1};
    const cur = Math.max(ivl, 1); let hard, good, easy;
    if(late >= 0){
      hard = fuzzIvl(cur*1.2, ivl+1, f);
      good = fuzzIvl((cur + late/2)*ease, hard+1, f);
      easy = fuzzIvl((cur + late)*ease*1.3, good+1, f);
    } else {      // ripasso in anticipo: Anki conta i giorni passati davvero, non quelli previsti
      const el = ivl + late, base = Math.max(el*ease, cur);
      hard = Math.max(1, Math.round(Math.max(el*1.2, cur*.6))); good = Math.max(1, Math.round(base)); easy = Math.max(1, Math.round(base*1.15));
    }
    return {ivl: [0, hard, good, easy][g], ease: g===1 ? Math.max(1.3, ease-.15) : g===3 ? ease+.15 : ease, lapses, again:false};
  }
  step = step||0;
  if(g===0) return {ivl, ease, lapses, again:true, step:0};
  if(g===1) return {ivl, ease, lapses, again:true, step};
  if(g===3 || step>=1) return {ivl: ivl || (g===3 ? fuzzIvl(4, 1, f) : 1), ease, lapses, again:false};
  return {ivl, ease, lapses, again:true, step:1};
}
// Parole da ripassare in una certa data
const dueOf = (words, today) => (words || []).filter(w => w.t && !w.got && (!w.due || w.due<=today));

// Quotidiano: posizione nella serie. Ogni minuto segnato sposta la posizione; a fine episodio si passa al successivo.
const EP_LEN = 20;      // shortcut: durata fissa di un episodio, renderla per serie se cambia con la prossima serie
function advanceEp(q, delta){
  const o = Object.assign({s:1, e:1, min:0}, q), len = +((/~\s*(\d+)/.exec((q && q.label) || '') || [])[1]) || EP_LEN;   // durata dall'etichetta "(~20′)"
  o.min += delta;
  while(o.min>=len){ o.min -= len; o.e++; }
  while(o.min<0 && o.e>1){ o.min += len; o.e--; }
  if(o.min<0) o.min = 0;
  return o;
}
const quoLabel = q => q && q.label ? q.label+(q.e ? ' · S'+(q.s||1)+' E'+q.e+(q.min ? ', dal minuto '+q.min : '') : '') : '';

// Minuti per tipo di un giorno (i documenti vecchi senza u:'min' sono blocchi da 15′)
const minsOf = d => { const f = d && d.u==='min' ? 1 : 15, o = {}; K.forEach(k => { o[k] = ((d && d[k]) || 0)*f; }); return o; };
// Serie di giorni col minimo (15′ per tipo). Un jolly si guadagna ogni 7 giorni di fila col minimo (al 7°, 14°, 21°…), se ne tengono al massimo 2:
// un giorno saltato ne consuma uno e la serie non si rompe. Si parte con 1 (quello del primo mese, già in mano a Pavel il 14/11).
const JOLLY_EVERY = 7, JOLLY_MAX = 2;
function streakOf(days, today){
  const first = Object.keys(days).sort()[0], used = []; let run = 0, best = 0, bank = 1;
  if(!first) return {streak:0, best:0, bank:0, used};
  for(let d = new Date(first+'T12:00'), dt = first; dt<=today; d.setDate(d.getDate()+1), dt = ymd(d)){
    const v = minsOf(days[dt]);
    if(K.every(k => v[k]>=15)){ run++; if(run % JOLLY_EVERY === 0) bank = Math.min(JOLLY_MAX, bank+1); }
    else if(dt===today){}                                   // oggi non è finito: non rompe e non consuma
    else if(run>0 && bank>0){ bank--; used.push(dt); }
    else run = 0;
    best = Math.max(best, run);
  }
  return {streak:run, best, bank, used};
}

// Livelli: ore totali di ascolto necessarie per ciascuno (usati dall'app e dalla notifica della domenica)
const LEVELS = [[0,'Pulcini'],[3,'Allievi'],[10,'Juniores'],[25,'Panchina'],[50,'Titolare'],[100,'Capitano'],[175,'Serie A'],[300,'Champions'],[500,'Nazionale']];
const levelOf = totalMin => { let li = 0; LEVELS.forEach((l, i) => { if(totalMin/60 >= l[0]) li = i; }); return li; };

// Semplificato a blocchi: «Peppa Pig, stagione 1, episodi 4-6 (~15′)». Il blocco si legge dal testo, così se lo correggi a mano il prossimo riparte da lì.
// Il blocco cambia solo quando chiudi all'80%, non con i minuti: il Semplificato si ripete finché non lo capisci.
const BLOCK_RE = /^(.*?),\s*stagione\s+(\d+),\s*episodi\s+(\d+)\s*[-–]\s*(\d+)\s*(\(~\s*\d+\s*′?\))?\s*$/i;
function nextBlockLabel(label){
  const l = (label || '').trim(), m = BLOCK_RE.exec(l);
  if(m){ const a = +m[3], b = +m[4], n = b - a + 1; if(n >= 1) return m[1]+', stagione '+m[2]+', episodi '+(b+1)+'-'+(b+n)+(m[5] ? ' '+m[5] : ''); }
  const name = (l.split(/\s·|[,(]/)[0] || '').trim();
  return name ? name+', stagione 1, episodi 1-3' : '';      // prima volta: un punto di partenza da correggere
}

// Ritmo: minuti di questa settimana (da lunedì a ieri) contro gli stessi giorni della settimana scorsa. Oggi non conta: non è finito.
// Niente da mostrare di lunedì (nessun giorno finito) né se la settimana scorsa è vuota.
function paceOf(days, today){
  const t = new Date(today + 'T12:00'), dow = (t.getDay() + 6) % 7, mon = mondayOf(t);          // dow: 0 = lunedì
  if(dow === 0) return null;
  const add = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return ymd(x); };
  const tot = d => { const v = minsOf(days && days[d]); return v.sem + v.quo + v.tec; };
  let cur = 0, prev = 0;
  for(let i = 0; i < dow; i++){ cur += tot(add(mon, i)); prev += tot(add(mon, i - 7)); }
  return prev ? {cur, prev, diff: cur - prev, days: dow} : null;
}

/* ---------- Percorsi, missioni e traguardi ----------
   Ogni percorso è una catena di tappe sulla stessa misura: si vede quella in corso, le altre si sbloccano in ordine.
   I due percorsi "meta" contano gli altri (quanti traguardi, su quanti fronti). Tutto si calcola da giorni e stato: niente da tenere in più. */
const WEEK_GOALS = {min:5, obj:2, par:5, rip:4};      // missioni della settimana: ogni numero è il minimo per considerarla fatta
const TRACKS = [
  {id:'serie', name:'Costanza', unit:'giorni di fila', col:'--gold', todo:'Fai almeno 15′ per tipo ogni giorno.',
    tiers:[[1,'Calcio d’inizio'],[3,'Tre di fila'],[7,'Settimana piena'],[14,'Due settimane'],[30,'Un mese senza buchi'],[60,'Due mesi'],[100,'Cento giorni']]},
  {id:'obiettivo', name:'Obiettivi', unit:'giornate a obiettivo', col:'--ok', todo:'Raggiungi l’obiettivo del giorno in tutti e tre i tipi.',
    tiers:[[1,'Giornata perfetta'],[5,'Cinque su cinque'],[10,'Dieci su dieci'],[25,'Stagione da titolare'],[50,'Mezzo centinaio'],[100,'Cento pieni']]},
  {id:'spezzoni', name:'Comprensione', unit:'spezzoni chiusi', col:'--tec', todo:'Chiudi uno spezzone quando capisci l’80%.',
    tiers:[[1,'Primo 80%'],[3,'Tripletta'],[5,'Giro completo'],[10,'Doppia cifra'],[25,'Quarto di secolo'],[50,'Mezzo secolo']]},
  {id:'parole', name:'Taccuino', unit:'parole segnate', col:'--sem', todo:'Segna le parole nuove che senti, con il pulsante +.',
    tiers:[[10,'Taccuino'],[25,'Quaderno'],[50,'Mezzo centinaio'],[100,'Centurione'],[200,'Dizionario in tasca'],[400,'Enciclopedia']]},
  {id:'imparate', name:'Vocabolario', unit:'parole imparate', col:'--sem', todo:'Ripassa una parola finché il prossimo ripasso è oltre 3 settimane.',
    tiers:[[10,'Vocabolario'],[25,'Lessico'],[50,'Glossario'],[100,'Thesaurus'],[200,'Oxford']]},
  {id:'ripasso', name:'Memoria', unit:'giorni di ripasso', col:'--quo', todo:'Completa il ripasso delle carte, un giorno dopo l’altro.',
    tiers:[[3,'Primo ripasso'],[7,'Memoria allenata'],[14,'Due settimane di ripasso'],[30,'Un mese di ripasso'],[60,'Due mesi di ripasso'],[100,'Cento ripassi']]},
  {id:'settimane', name:'Settimane d’oro', unit:'settimane complete', col:'--gold', todo:'Completa tutte e 4 le missioni della settimana.',
    tiers:[[1,'Prima settimana d’oro'],[3,'Tre settimane d’oro'],[6,'Sei settimane d’oro'],[12,'Dodici settimane d’oro'],[26,'Mezz’anno d’oro']]},
  {id:'piene', name:'Giornate piene', unit:'giornate piene', col:'--ok', todo:'Nello stesso giorno: minimo, obiettivo e una parola nuova.',
    tiers:[[1,'Giornata piena'],[3,'Tripletta piena'],[7,'Settimana piena'],[15,'Quindici piene'],[30,'Un mese pieno'],[60,'Sessanta piene'],[100,'Cento piene']]},
  {id:'punti', name:'Punti', unit:'punti', col:'--gold', todo:'Ogni missione del giorno dà punti; la giornata piena ne dà 20 in più.',
    tiers:[[100,'Primi cento'],[300,'Trecento'],[750,'Settecentocinquanta'],[1500,'Millecinquecento'],[3000,'Tremila'],[6000,'Seimila']]},
  {id:'fronti', meta:true, name:'Tutti i fronti', unit:'percorsi iniziati', col:'--tec', todo:'Ottieni almeno un traguardo in ogni percorso.',
    tiers:[[3,'Tre fronti'],[5,'Cinque fronti'],[7,'Sette fronti'],[9,'Tutti i fronti']]},
  {id:'collezione', meta:true, name:'Collezione', unit:'traguardi ottenuti', col:'--gold', todo:'Sblocca traguardi nei percorsi.',
    tiers:[[5,'Collezionista'],[12,'Bacheca'],[20,'Vetrina'],[30,'Museo'],[40,'Hall of Fame'],[60,'Leggenda']]},
];
/* ---------- Missioni del giorno ----------
   Le prime tre (core) fanno la «giornata piena»; ripasso e comprensione sono bonus: danno punti ma non bloccano niente.
   Tutto si calcola da giorni e stato, per qualunque data: niente da salvare. */
const FULL_BONUS = 20;
const DAY_QUESTS = [
  {id:'min', name:'Minimo', hint:'15′ per tipo: la serie continua', pts:10, core:true},
  {id:'obj', name:'Obiettivo', hint:'l’obiettivo del giorno in tutti e tre i tipi', pts:20, core:true},
  {id:'par', name:'Parola nuova', hint:'segnane una con il pulsante +', pts:10, core:true},
  {id:'rip', name:'Ripasso', hint:'finisci le carte da ripassare', pts:10},
  {id:'cmp', name:'Comprensione', hint:'dì quanto hai capito di Semplificato o Tecnico', pts:5}];
function dayQuests(days, state, date, goal){
  const v = minsOf(days && days[date]), st = state || {};
  const done = {min: K.every(k => v[k] >= 15), obj: K.every(k => v[k] >= goal),
    par: (st.words || []).some(w => w.date === date), rip: (st.revDays || []).includes(date),
    cmp: [st.sem, st.tec].concat(st.history || []).some(x => x && (x.comp || []).some(c => c.d === date))};
  const items = DAY_QUESTS.map(q => Object.assign({done: done[q.id]}, q));
  const full = items.every(q => !q.core || q.done);
  return {items, full, pts: items.reduce((n, q) => n + (q.done ? q.pts : 0), 0) + (full ? FULL_BONUS : 0),
    max: DAY_QUESTS.reduce((n, q) => n + q.pts, FULL_BONUS)};
}
const weekMissions = w => [
  {id:'min', name:'Giorni col minimo', unit:'giorni', one:'giorno', hint:'15′ per tipo', val:w.min, target:WEEK_GOALS.min},
  {id:'obj', name:'Giornate a obiettivo', unit:'giornate', one:'giornata', hint:'obiettivo del giorno in tutti e tre i tipi', val:w.obj, target:WEEK_GOALS.obj},
  {id:'par', name:'Parole nuove', unit:'parole', one:'parola', hint:'con il pulsante +', val:w.par, target:WEEK_GOALS.par},
  {id:'rip', name:'Giorni di ripasso', unit:'giorni', one:'giorno', hint:'ripasso delle carte finito', val:w.rip, target:WEEK_GOALS.rip}];
// Valori, traguardi ottenuti (ids "percorso:soglia") e missioni della settimana di `today`. Funzione pura: serve solo `goalToday` per il giorno in corso.
function achieve(days, state, today, goalToday){
  days = days || {};
  const st = state || {}, ws = st.words || [], revs = st.revDays || [], hist = st.history || [];
  const wk = d => mondayOf(new Date(d + 'T12:00')), weeks = {};
  const W = d => weeks[wk(d)] || (weeks[wk(d)] = {min:0, obj:0, par:0, rip:0});
  let perfect = 0;
  Object.keys(days).forEach(dt => {
    const v = minsOf(days[dt]), g = dt===today ? goalToday : ((days[dt] && days[dt].g) || 30), w = W(dt);
    if(K.every(k => v[k] >= 15)) w.min++;
    if(K.every(k => v[k] >= g)){ perfect++; w.obj++; }
  });
  ws.forEach(x => { if(x.date) W(x.date).par++; });
  revs.forEach(d => { W(d).rip++; });
  const gold = w => w.min>=WEEK_GOALS.min && w.obj>=WEEK_GOALS.obj && w.par>=WEEK_GOALS.par && w.rip>=WEEK_GOALS.rip;
  const cur = weeks[wk(today)] || {min:0, obj:0, par:0, rip:0};
  // punti e giornate piene: ogni data in cui è successo qualcosa (minuti, parola, ripasso, stima di comprensione)
  const dates = new Set([...Object.keys(days), ...ws.map(x => x.date), ...revs, today]);
  [st.sem, st.tec].concat(hist).forEach(x => ((x && x.comp) || []).forEach(c => dates.add(c.d)));
  let punti = 0, piene = 0;
  dates.forEach(dt => { if(!dt) return; const q = dayQuests(days, st, dt, dt===today ? goalToday : ((days[dt] && days[dt].g) || 30)); punti += q.pts; if(q.full) piene++; });
  const vals = {serie: streakOf(days, today).best, obiettivo: perfect, spezzoni: hist.length, parole: ws.length, punti, piene,
    imparate: ws.filter(x => x.got || x.ivl>=21).length, ripasso: new Set(revs).size, settimane: Object.values(weeks).filter(gold).length};
  const earned = []; let count = 0, started = 0;
  TRACKS.filter(t => !t.meta).forEach(t => { let n = 0; t.tiers.forEach(([need]) => { if(vals[t.id] >= need){ earned.push(t.id+':'+need); n++; } }); count += n; if(n) started++; });
  vals.collezione = count; vals.fronti = started;
  TRACKS.filter(t => t.meta).forEach(t => t.tiers.forEach(([need]) => { if(vals[t.id] >= need) earned.push(t.id+':'+need); }));
  return {vals, earned, week: weekMissions(cur), weekGold: gold(cur)};
}

if(typeof module!=='undefined') module.exports = {dayQuests, DAY_QUESTS, FULL_BONUS, minsOf, streakOf, EP_LEN, advanceEp, paceOf, nextBlockLabel, LEVELS, levelOf, TRACKS, WEEK_GOALS, weekMissions, achieve, quoLabel, K, NAMES, TOPICS, nextTopic, ymd, mondayOf, WEEKS, dayPlan, planOf, pickEpIn, epTitle, epLabel, dueOf, senses, PILLARS, pillarOf, srs, fuzzIvl, fuzzSeed};
