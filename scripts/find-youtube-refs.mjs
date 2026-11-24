const queries = [
  ['tujhe-dekha-to', 'Tujhe Dekha To Ye Jana Sanam flute cover bansuri'],
  ['lag-ja-gale', 'Lag Ja Gale flute cover bansuri'],
  ['roop-tera-mastana', 'Roop Tera Mastana flute cover bansuri'],
  ['pal-pal-dil-ke-paas', 'Pal Pal Dil Ke Paas flute cover bansuri'],
  ['pehla-nasha', 'Pehla Nasha flute cover bansuri'],
  ['chura-ke-dil-mera', 'Chura Ke Dil Mera flute cover bansuri'],
  ['tum-hi-ho', 'Tum Hi Ho Aashiqui 2 flute cover bansuri'],
  ['kesariya', 'Kesariya Brahmastra flute cover bansuri'],
  ['agar-tum-saath-ho', 'Agar Tum Saath Ho flute cover bansuri'],
];

async function findEmbeddableVideo(query) {
  const res = await fetch(
    'https://www.youtube.com/results?search_query=' + encodeURIComponent(query),
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }
  );
  const html = await res.text();
  const rx = /"videoId":"([A-Za-z0-9_-]{11})"/g;
  const ids = [...new Set([...html.matchAll(rx)].map((m) => m[1]))].slice(0, 5);

  for (const id of ids) {
    const oe = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
    );
    if (oe.ok) {
      const info = await oe.json();
      if (!/#short/i.test(info.title) && info.width >= info.height) {
        return { id, title: info.title, author: info.author_name };
      }
    }
  }
  return null;
}

async function main() {
  for (const [slug, q] of queries) {
    try {
      const hit = await findEmbeddableVideo(q);
      console.log(slug.padEnd(22), '=>', hit ? `${hit.id} | ${hit.title} (${hit.author})` : 'NONE');
    } catch (e) {
      console.log(slug, 'ERR', e.message);
    }
  }
}

main();
