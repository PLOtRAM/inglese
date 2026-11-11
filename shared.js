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
  const o = Object.assign({s:1, e:1, min:0}, q); o.min += delta;
  while(o.min>=EP_LEN){ o.min -= EP_LEN; o.e++; }
  while(o.min<0 && o.e>1){ o.min += EP_LEN; o.e--; }
  if(o.min<0) o.min = 0;
  return o;
}
const quoLabel = q => q && q.label ? q.label+(q.e ? ' · S'+(q.s||1)+' E'+q.e+(q.min ? ', dal minuto '+q.min : '') : '') : '';

if(typeof module!=='undefined') module.exports = {EP_LEN, advanceEp, quoLabel, K, NAMES, TOPICS, nextTopic, ymd, mondayOf, WEEKS, dayPlan, planOf, pickEpIn, epTitle, epLabel, dueOf};
