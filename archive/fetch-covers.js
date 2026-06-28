// ── Paste your TMDB key here ──────────────────────────────────────────────
const TMDB_KEY = 'e6aa66e5b97b5eb1ae04eb212bd954bf';
// ─────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

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

// ── Clean title (strip copy count) ───────────────────────────────────────
function cleanTitle(raw) {
  return raw.replace(/\s*\(x\d+\)\s*$/i, '').trim();
}

// ── Sleep helper (be polite to APIs) ─────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Books — Open Library ─────────────────────────────────────────────────
async function fetchBookCover(title, author) {
  try {
    const q = encodeURIComponent(`${title} ${author}`.trim());
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i`);
    const data = await res.json();
    const id = data?.docs?.[0]?.cover_i;
    if (id) return `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
  } catch (e) {
    console.warn(`  Book lookup failed: ${title}`, e.message);
  }
  return null;
}

// ── Films — TMDB ─────────────────────────────────────────────────────────
async function fetchFilmCover(title) {
  try {
    const q = encodeURIComponent(title);
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${q}&api_key=${TMDB_KEY}&limit=1`
    );
    const data = await res.json();
    const poster = data?.results?.[0]?.poster_path;
    if (poster) return `https://image.tmdb.org/t/p/w500${poster}`;
  } catch (e) {
    console.warn(`  Film lookup failed: ${title}`, e.message);
  }
  return null;
}

// ── Music — MusicBrainz + Cover Art Archive ───────────────────────────────
async function fetchMusicCover(title, artist) {
  try {
    const q = encodeURIComponent(`release:"${title}" AND artist:"${artist}"`);
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release/?query=${q}&limit=1&fmt=json`,
      { headers: { 'User-Agent': 'EncoreCollectionApp/1.0 (personal)' } }
    );
    const data = await res.json();
    const mbid = data?.releases?.[0]?.id;
    if (!mbid) return null;
    // Cover Art Archive
    const artRes = await fetch(`https://coverartarchive.org/release/${mbid}/front`);
    if (artRes.ok) return artRes.url; // follows redirect to actual image
  } catch (e) {
    console.warn(`  Music lookup failed: ${title}`, e.message);
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  const covers = { books: {}, dvds: {}, cds: {} };

  // Books
  console.log('\n📚 Fetching book covers...');
  const books = parseCSV(fs.readFileSync(path.join('data', 'books.csv'), 'utf8'));
  for (const row of books) {
    const title = cleanTitle(row['title'] || '');
    const author = row['author/director/artist'] || row['author'] || '';
    if (!title) continue;
    process.stdout.write(`  ${title}... `);
    const url = await fetchBookCover(title, author);
    if (url) { covers.books[title] = url; console.log('✓'); }
    else console.log('✗ not found');
    await sleep(300);
  }

  // Films
  console.log('\n🎬 Fetching film covers...');
  const dvds = parseCSV(fs.readFileSync(path.join('data', 'dvds.csv'), 'utf8'));
  for (const row of dvds) {
    const title = cleanTitle(row['title'] || '');
    if (!title) continue;
    process.stdout.write(`  ${title}... `);
    const url = await fetchFilmCover(title);
    if (url) { covers.dvds[title] = url; console.log('✓'); }
    else console.log('✗ not found');
    await sleep(300);
  }

  // Music
  console.log('\n🎵 Fetching music covers...');
  const cds = parseCSV(fs.readFileSync(path.join('data', 'cds.csv'), 'utf8'));
  for (const row of cds) {
    const title = cleanTitle(row['title'] || '');
    const artist = row['author/director/artist'] || row['artist'] || '';
    if (!title) continue;
    process.stdout.write(`  ${title}... `);
    const url = await fetchMusicCover(title, artist);
    if (url) { covers.cds[title] = url; console.log('✓'); }
    else console.log('✗ not found');
    await sleep(500); // MusicBrainz is stricter about rate limits
  }

  // Write output
  fs.writeFileSync(
    path.join('data', 'covers.json'),
    JSON.stringify(covers, null, 2),
    'utf8'
  );

  const total = Object.values(covers).reduce((sum, cat) => sum + Object.keys(cat).length, 0);
  const attempted = books.length + dvds.length + cds.length;
  console.log(`\n✅ Done — ${total}/${attempted} covers found → data/covers.json\n`);
})();