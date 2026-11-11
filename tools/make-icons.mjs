// Disegna l'icona dell'app (tre livelli del mixer su fondo scuro) come PNG, senza dipendenze.
// Uso: node tools/make-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';

const crcT = Array.from({length:256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };

function png(n){
  const px = Buffer.alloc(n * (n * 3 + 1));
  const bars = [[0x35,0xc9,0xb6, .45], [0xf2,0xa7,0x42, .7], [0x94,0x98,0xf8, .55]];   // semplificato, quotidiano, tecnico: colore e altezza
  const bw = n * .15, gap = n * .07, x0 = (n - 3 * bw - 2 * gap) / 2, base = n * .76, top = n * .22, seg = n * .075, sgap = n * .018;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let c = [0x0c, 0x11, 0x17];
    bars.forEach(([r, g, b, h], i) => {
      const bx = x0 + i * (bw + gap);
      if (x < bx || x >= bx + bw || y >= base || y < top) return;
      const k = Math.floor((base - y) / (seg + sgap));                 // quale tacca, dal basso
      if ((base - y) % (seg + sgap) > seg) return;                     // spazio tra le tacche
      c = (k + 1) * (seg + sgap) <= (base - top) * h + seg ? [r, g, b] : [0x20, 0x2a, 0x36];
    });
    px.set(c, y * (n * 3 + 1) + 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(px)), chunk('IEND', Buffer.alloc(0))]);
}
for (const n of [180, 192, 512]) fs.writeFileSync(new URL(`../icon-${n}.png`, import.meta.url), png(n));
console.log('icone scritte');
