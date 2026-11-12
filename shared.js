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
  if(match) return {kind:'Partita', target:15, tec:'Nel viaggio verso il campo, o in pullman', tv:'Nell’ora dopo pranzo, o in pullman', rows:[
    ['In casa','Tecnico nel viaggio verso il campo, Peppa Pig e The Office nell’ora dopo il pranzo'],
    ['In trasferta','Tutti e tre in pullman, con le cuffie']]};
  if(type==='sab' && wd===0) return {kind:'Giorno libero', target:15, tec:'A casa', tv:'A casa', rows:[
    ['A casa','15′ di Peppa Pig, 15′ di The Office, 15′ di tecnico']]};
  if(TRAIN[type].includes(wd)) return {kind:'Turno e allenamento', target:45, tec:'In auto: lavoro e campo', tv:'Al turno: prime ore e dalle 13', rows:[
    ['Andata al lavoro','Tecnico'],
    ['Prime ore del turno','30′ di Peppa Pig, 30′ di The Office'],
    ['Dalle 13','15′ di Peppa Pig, 15′ di The Office'],
    ['Ritorno a casa','Tecnico'],
    ['Viaggio al campo','Tecnico, fino a 45′ totali'],
    ['Ritorno dal campo','Libero: novità Bloomberg, se ti va']]};
  return {kind:'Turno', target:30, tec:'In auto, andata e ritorno', tv:'Al turno: prime ore e dalle 13', rows:[
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
// Serie di giorni col minimo (15′ per tipo). Ogni mese arriva un jolly e si accumulano: un giorno saltato ne consuma uno e la serie non si rompe.
function streakOf(days, today){
  const first = Object.keys(days).sort()[0], used = []; let run = 0, best = 0, bank = 0, month = '';
  if(!first) return {streak:0, best:0, bank:0, used};
  for(let d = new Date(first+'T12:00'), dt = first; dt<=today; d.setDate(d.getDate()+1), dt = ymd(d)){
    if(dt.slice(0,7)!==month){ month = dt.slice(0,7); bank++; }
    const v = minsOf(days[dt]);
    if(K.every(k => v[k]>=15)) run++;
    else if(dt===today){}                                   // oggi non è finito: non rompe e non consuma
    else if(run>0 && bank>0){ bank--; used.push(dt); }
    else run = 0;
    best = Math.max(best, run);
  }
  return {streak:run, best, bank, used};
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
  {id:'fronti', meta:true, name:'Tutti i fronti', unit:'percorsi iniziati', col:'--tec', todo:'Ottieni almeno un traguardo in ogni percorso.',
    tiers:[[3,'Tre fronti'],[5,'Cinque fronti'],[7,'Tutti i fronti']]},
  {id:'collezione', meta:true, name:'Collezione', unit:'traguardi ottenuti', col:'--gold', todo:'Sblocca traguardi nei percorsi.',
    tiers:[[5,'Collezionista'],[12,'Bacheca'],[20,'Vetrina'],[30,'Museo'],[40,'Hall of Fame']]},
];
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
  const vals = {serie: streakOf(days, today).best, obiettivo: perfect, spezzoni: hist.length, parole: ws.length,
    imparate: ws.filter(x => x.got || x.ivl>=21).length, ripasso: new Set(revs).size, settimane: Object.values(weeks).filter(gold).length};
  const earned = []; let count = 0, started = 0;
  TRACKS.filter(t => !t.meta).forEach(t => { let n = 0; t.tiers.forEach(([need]) => { if(vals[t.id] >= need){ earned.push(t.id+':'+need); n++; } }); count += n; if(n) started++; });
  vals.collezione = count; vals.fronti = started;
  TRACKS.filter(t => t.meta).forEach(t => t.tiers.forEach(([need]) => { if(vals[t.id] >= need) earned.push(t.id+':'+need); }));
  return {vals, earned, week: weekMissions(cur), weekGold: gold(cur)};
}

if(typeof module!=='undefined') module.exports = {minsOf, streakOf, EP_LEN, advanceEp, paceOf, TRACKS, WEEK_GOALS, weekMissions, achieve, quoLabel, K, NAMES, TOPICS, nextTopic, ymd, mondayOf, WEEKS, dayPlan, planOf, pickEpIn, epTitle, epLabel, dueOf};
