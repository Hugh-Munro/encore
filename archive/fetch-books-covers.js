const fs   = require('fs');
const path = require('path');

const COVERS_PATH = path.join('data', 'covers.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(COVERS_PATH, 'utf8'));
  } catch {
    return { books: {}, dvds: {}, cds: {} };
  }
}

function save(covers) {
  fs.writeFileSync(COVERS_PATH, JSON.stringify(covers, null, 2), 'utf8');
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] ?? '');
    return obj;
  }).filter(r => r[headers[0]]);
}

function cleanTitle(raw) {
  return raw.replace(/\s*\(x\d+\)\s*$/i, '').trim();
}

async function fetchBookCover(title, author) {
  // Google Books — try title + author first, then title only
  const queries = [
    `${title} ${author}`.trim(),
    title,
  ];

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=3&langRestrict=en&fields=items(volumeInfo(imageLinks,language))`
      );
      if (res.ok) {
        const data  = await res.json();
        const items = data?.items || [];
        for (const item of items) {
          const info = item.volumeInfo;
          if (info?.language && info.language !== 'en') continue; // skip non-English
          const img  = info?.imageLinks;
          if (img) {
            const url = img.extraLarge || img.large || img.medium || img.thumbnail;
            if (url) return url.replace('http://', 'https://').replace('&edge=curl', '').replace('zoom=1', 'zoom=3');
          }
        }
      }
    } catch (e) {
      console.warn(`  Google Books failed: ${title}`, e.message);
    }
    await sleep(300);
  }

  // Fallback: Open Library
  try {
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(`${title} ${author}`.trim())}&limit=1&fields=cover_i&lang=eng`);
    if (res.ok) {
      const data = await res.json();
      const id   = data?.docs?.[0]?.cover_i;
      if (id) return `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
    }
  } catch (e) {
    console.warn(`  Open Library failed: ${title}`, e.message);
  }

  return null;
}

(async () => {
  const covers = loadExisting();
  covers.books = {}; // wipe books, keep dvds and cds intact

  let found = 0, failed = 0;

  console.log('\n📚 Re-fetching all book covers (English only)...\n');
  const books = parseCSV(fs.readFileSync(path.join('data', 'books.csv'), 'utf8'));

  for (const row of books) {
    const title  = cleanTitle(row['title'] || '');
    const author = row['author'] || row['author/director/artist'] || '';
    if (!title) continue;

    process.stdout.write(`  ${title}... `);
    const url = await fetchBookCover(title, author);
    if (url) {
      covers.books[title] = url;
      save(covers);
      console.log('✓');
      found++;
    } else {
      console.log('✗ not found');
      failed++;
    }
    await sleep(600);
  }

  console.log(`\n✅ Done — ${found} found, ${failed} not found → data/covers.json\n`);
})();