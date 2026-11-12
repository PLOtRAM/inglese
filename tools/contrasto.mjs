// Contrasto dei colori del testo nei due temi (WCAG: almeno 4,5 : 1 per il testo piccolo). Si lancia con: node tools/contrasto.mjs
// Questi valori sono quelli di index.html (tema chiaro corretto il 12/11; prima: sem #0b8f80, quo #c0660f, gold #a87700, ok #27823f, warn #b4541a). Eccezione voluta: il tasto −5′ resta sbiadito (opacità .45) perché lo ha chiesto Pavel.
const L = {bg:'#f1f3f8',surface:'#ffffff',surface2:'#e7ebf2',fg:'#121a26',muted:'#566273',line:'#d9dfe9',sem:'#09766a',quo:'#a0550d',tec:'#4f52cc',gold:'#8b6200',ok:'#24783a',warn:'#a94f18',on:'#ffffff'};
const D = {bg:'#0c1117',surface:'#151c25',surface2:'#202a36',fg:'#e8eef5',muted:'#94a2b3',line:'#2a3543',sem:'#35c9b6',quo:'#f2a742',tec:'#9498f8',gold:'#f0c24a',ok:'#5cc274',warn:'#ef8b4f',on:'#0c1117'};
const rgb = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
const hex = a => '#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const mix = (a,b,p) => hex(rgb(a).map((v,i)=>v*p+rgb(b)[i]*(1-p)));       // color-mix(a p%, b)
const lum = h => { const [r,g,b] = rgb(h).map(v => { v/=255; return v<=.03928 ? v/12.92 : ((v+.055)/1.055)**2.4; }); return .2126*r+.7152*g+.0722*b; };
const cr = (a,b) => { const x=lum(a), y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
for (const [nome,T] of [['CHIARO',L],['SCURO',D]]) {
  console.log('== '+nome);
  const rows = [];
  const add = (what, fg, bg, min) => rows.push([cr(fg,bg), min, what]);
  add('testo su sfondo', T.fg, T.bg, 4.5); add('testo su scheda', T.fg, T.surface, 4.5);
  add('grigio (muted) su sfondo', T.muted, T.bg, 4.5); add('grigio su scheda', T.muted, T.surface, 4.5); add('grigio su surface2 (barre, pillole)', T.muted, T.surface2, 4.5);
  for (const k of ['sem','quo','tec','gold','ok','warn']) { add(k+' (testo) su scheda', T[k], T.surface, 4.5); add(k+' (testo) su sfondo', T[k], T.bg, 4.5); add('scritta su '+k+' (tasti +5′, scala)', T.on, T[k], 4.5); add(k+' su pillola (accent 14%)', T[k], mix(T[k], T.surface, .14), 4.5); }
  add('avviso: testo su banner', T.fg, mix(T.warn, T.surface, .16), 4.5);
  add('ora grigio su linea (bordi)', T.line, T.bg, 1.0);
  add('dock: grigio su scheda', T.muted, T.surface, 4.5);
  rows.sort((a,b)=>a[0]-b[0]).forEach(([r,m,w]) => console.log((r<m?'DA VEDERE ':'ok        ')+r.toFixed(2).padStart(6)+'  (min '+m+')  '+w));
}
