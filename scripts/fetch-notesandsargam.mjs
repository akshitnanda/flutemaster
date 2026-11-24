import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://notesandsargam.com/wp-json/wp/v2';
const OUT_DIR = path.resolve('data');
const OUT_FILE = path.join(OUT_DIR, 'notesandsargam-dump.json');

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'FluteMaster-Educational-Reference/1.0',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const totalPages = Number(res.headers.get('x-wp-totalpages') || '1');
  const totalItems = Number(res.headers.get('x-wp-total') || '0');
  const data = await res.json();
  return { data, totalPages, totalItems };
}

async function fetchAllCategories() {
  const all = [];
  let page = 1;
  while (page <= 15) {
    const url = `${BASE}/categories?per_page=100&page=${page}&_fields=id,name,slug,count`;
    const { data, totalPages } = await fetchJson(url);
    all.push(...data);
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

async function fetchPostsByCategory(catId, maxPages = 6) {
  const posts = [];
  let page = 1;
  while (page <= maxPages) {
    const url = `${BASE}/posts?categories=${catId}&per_page=100&page=${page}&_fields=id,slug,date,link,title,content,categories`;
    const { data, totalPages } = await fetchJson(url);
    posts.push(...data);
    console.log(`  cat ${catId} page ${page}/${totalPages}: +${data.length} posts`);
    if (page >= totalPages) break;
    page++;
    await new Promise((r) => setTimeout(r, 250));
  }
  return posts;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log('Fetching categories from notesandsargam.com...');
  const categories = await fetchAllCategories();
  console.log(`Fetched ${categories.length} categories.`);

  const byId = new Map();
  // 56 = Hindi (448), 95 = Popular Tunes (34), 254 = Devotional (46)
  for (const catId of [56, 95, 254]) {
    console.log(`Fetching posts for category ${catId}...`);
    const list = await fetchPostsByCategory(catId, 6);
    for (const p of list) {
      byId.set(p.id, p);
    }
  }

  const dump = {
    source: 'https://notesandsargam.com/',
    fetchedAt: new Date().toISOString(),
    categoryCount: categories.length,
    postCount: byId.size,
    categories,
    posts: Array.from(byId.values()),
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`Saved ${dump.postCount} unique posts to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
