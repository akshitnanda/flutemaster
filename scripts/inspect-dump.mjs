import fs from 'node:fs';

const dump = JSON.parse(fs.readFileSync('data/notesandsargam-dump.json', 'utf8'));

function htmlToLines(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|pre)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8217;|&rsquo;|&#8216;|&lsquo;/gi, "'")
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
    .replace(/&#8230;/gi, '...')
    .replace(/&amp;/gi, '&')
    .replace(/&#038;/gi, '&')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const targets = [
  'lag ja gale',
  'roop tera',
  'pal pal dil',
  'tujhe dekha',
  'pehla nasha',
  'chura ke dil',
  'tum hi ho',
  'kesariya',
  'agar tum saath',
  'kal ho',
  'chura liya',
  'ek pyar ka nagma',
  'mere mehboob qayamat',
  'ajeeb dastan',
  'hothon se',
  'neele neele',
  'tu mile dil',
  'channa mereya',
  'baharon phool',
];

console.log('=== TARGET MATCHES ===');
for (const q of targets) {
  const m = dump.posts.find((p) => p.title.rendered.toLowerCase().includes(q));
  console.log(q.padEnd(22), '=>', m ? `${m.title.rendered} [${m.slug}]` : 'NOT FOUND');
}

let hasTable = 0;
let hasPipe = 0;
let hasPre = 0;
let hasMHash = 0;
let hasLowerM = 0;
let hasUppercaseM = 0;
let hasDotOctave = 0;
let hasCommaOctave = 0;

for (const p of dump.posts) {
  const c = p.content.rendered;
  if (/<table/i.test(c)) hasTable++;
  if (c.includes('|')) hasPipe++;
  if (/<pre/i.test(c)) hasPre++;
  const lines = htmlToLines(c).join('\n');
  if (/M[#\^\*]/.test(lines)) hasMHash++;
  if (/[\s\|,.'(\{~]m[\s\|,.'\)\}~]/.test(lines)) hasLowerM++;
  if (/[\s\|,.'(\{~]M[\s\|,.'\)\}~]/.test(lines)) hasUppercaseM++;
  if (/\.[SRGMPDNrgdn]/.test(lines)) hasDotOctave++;
  if (/,[SRGMPDNrgdn]/.test(lines)) hasCommaOctave++;
}

console.log('\n=== FORMAT STATS ===');
console.log({
  total: dump.posts.length,
  hasTable,
  hasPipe,
  hasPre,
  hasMHash,
  hasLowerM,
  hasUppercaseM,
  hasDotOctave,
  hasCommaOctave,
});

console.log('\n=== SAMPLE SNIPPETS (Lag Ja Gale, Roop Tera, Pehla Nasha, Tum Hi Ho) ===');
for (const q of ['lag ja gale', 'roop tera', 'pehla nasha', 'tum hi ho']) {
  const m = dump.posts.find((p) => p.title.rendered.toLowerCase().includes(q));
  if (!m) continue;
  console.log(`\n--- ${m.title.rendered} (${m.link}) ---`);
  const lines = htmlToLines(m.content.rendered);
  console.log(lines.slice(0, 28).join('\n'));
}
