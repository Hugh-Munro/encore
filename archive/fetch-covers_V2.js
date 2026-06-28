const fs   = require('fs');
const path = require('path');

// ── Paste your TMDB key here ──────────────────────────────────────────────
const TMDB_KEY = 'e6aa66e5b97b5eb1ae04eb212bd954bf';
// ─────────────────────────────────────────────────────────────────────────

const COVERS_PATH = path.join('data', 'covers.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Load existing covers (for incremental save) ───────────────────────────
function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(COVERS_PATH, 'utf8'));
  } catch {
    return { books: {}, dvds: {}, cds: {} };
  }
}

// ── Save progress after every entry ──────────────────────────────────────
function save(covers) {
  fs.writeFileSync(COVERS_PATH, JSON.stringify(covers, null, 2), 'utf8');
}

// ── CSV parser ───────────────────────────────────────────────────────────
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

// ── Clean title ───────────────────────────────────────────────────────────
function cleanTitle(raw) {
  return raw.replace(/\s*\(x\d+\)\s*$/i, '').trim();
}

// ── Books — Google Books (primary) + Open Library (fallback) ─────────────
async function fetchBookCover(title, author) {
  // Try Google Books first
  try {
    const q   = encodeURIComponent(`${title} ${author}`.trim());
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&fields=items(volumeInfo(imageLinks))`);
    if (res.ok) {
      const data = await res.json();
      const img  = data?.items?.[0]?.volumeInfo?.imageLinks;
      if (img) {
        // prefer largest available
        const url = img.extraLarge || img.large || img.medium || img.thumbnail;
        if (url) return url.replace('http://', 'https://').replace('&edge=curl', '').replace('zoom=1', 'zoom=3');
      }
    }
  } catch (e) {
    console.warn(`  Google Books failed: ${title}`, e.message);
  }

  // Fallback: Open Library
  try {
    await sleep(400);
    const q   = encodeURIComponent(`${title} ${author}`.trim());
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i`);
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

// ── Films — TMDB ─────────────────────────────────────────────────────────
async function fetchFilmCover(title) {
  try {
    const q   = encodeURIComponent(title);
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${q}&api_key=${TMDB_KEY}`);
    if (res.ok) {
      const data   = await res.json();
      const poster = data?.results?.[0]?.poster_path;
      if (poster) return `https://image.tmdb.org/t/p/w500${poster}`;
    }
  } catch (e) {
    console.warn(`  TMDB failed: ${title}`, e.message);
  }
  return null;
}

// ── Music — MusicBrainz + Cover Art Archive ───────────────────────────────
async function fetchMusicCover(title, artist) {
  try {
    const q   = encodeURIComponent(`release:"${title}" AND artist:"${artist}"`);
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release/?query=${q}&limit=1&fmt=json`,
      { headers: { 'User-Agent': 'EncoreApp/1.0 (personal)' } }
    );
    if (res.ok) {
      const data = await res.json();
      const mbid = data?.releases?.[0]?.id;
      if (mbid) {
        const artRes = await fetch(`https://coverartarchive.org/release/${mbid}/front`);
        if (artRes.ok) return artRes.url;
      }
    }
  } catch (e) {
    console.warn(`  MusicBrainz failed: ${title}`, e.message);
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  const covers = loadExisting();
  covers.books = covers.books || {};
  covers.dvds  = covers.dvds  || {};
  covers.cds   = covers.cds   || {};

  let found = 0, skipped = 0, failed = 0;

  // ── Books ──────────────────────────────────────────────────────────────
  console.log('\n📚 Fetching book covers...');
  const books = parseCSV(fs.readFileSync(path.join('data', 'books.csv'), 'utf8'));
  for (const row of books) {
    const title  = cleanTitle(row['title'] || '');
    const author = row['author'] || row['author/director/artist'] || '';
    if (!title) continue;

    if (covers.books[title]) {
      process.stdout.write(`  ${title}... skipped\n`);
      skipped++;
      continue;
    }

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
    await sleep(500);
  }

  // ── Films ──────────────────────────────────────────────────────────────
  console.log('\n🎬 Fetching film covers...');
  const dvds = parseCSV(fs.readFileSync(path.join('data', 'dvds.csv'), 'utf8'));
  for (const row of dvds) {
    const title = cleanTitle(row['title'] || '');
    if (!title) continue;

    if (covers.dvds[title]) {
      process.stdout.write(`  ${title}... skipped\n`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${title}... `);
    const url = await fetchFilmCover(title);
    if (url) {
      covers.dvds[title] = url;
      save(covers);
      console.log('✓');
      found++;
    } else {
      console.log('✗ not found');
      failed++;
    }
    await sleep(300);
  }

  // ── Music ──────────────────────────────────────────────────────────────
  console.log('\n🎵 Fetching music covers...');
  const cds = parseCSV(fs.readFileSync(path.join('data', 'cds.csv'), 'utf8'));
  for (const row of cds) {
    const title  = cleanTitle(row['title'] || '');
    const artist = row['artist'] || row['author/director/artist'] || '';
    if (!title) continue;

    if (covers.cds[title]) {
      process.stdout.write(`  ${title}... skipped\n`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${title}... `);
    const url = await fetchMusicCover(title, artist);
    if (url) {
      covers.cds[title] = url;
      save(covers);
      console.log('✓');
      found++;
    } else {
      console.log('✗ not found');
      failed++;
    }
    await sleep(600);
  }

  console.log(`\n✅ Done — ${found} found, ${skipped} skipped, ${failed} not found → data/covers.json\n`);
})();