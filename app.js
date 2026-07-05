// ── Icons ────────────────────────────────────────────────────────────────
const ICONS = {
  books: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="6" width="22" height="36" rx="2" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M10 10 C10 10 16 8 24 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="17" x2="28" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="22" x2="28" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="14" y1="27" x2="22" y2="27" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <rect x="8" y="6" width="2" height="36" rx="1" fill="currentColor" opacity="0.4"/>
  </svg>`,
  dvds: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="6" width="32" height="36" rx="2" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <polygon points="19,16 33,24 19,32" fill="currentColor" opacity="0.5"/>
  </svg>`,
  cds: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.4"/>
    <line x1="24" y1="8" x2="24" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="24" y1="36" x2="24" y2="40" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="8" y1="24" x2="12" y2="24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="36" y1="24" x2="40" y2="24" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
};

// ── Config ───────────────────────────────────────────────────────────────
const TABS = {
  dvds:  { label: 'Films',  file: 'data/dvds.csv',  cols: ['title','director'], headers: ['Title','Director'], filterCol: 'genre', statusLabel: 'Watched',  yearCol: 'year', originCol: 'origin_country', timelineMode: 'decade'  },
  cds:   { label: 'Music',  file: 'data/cds.csv',   cols: ['title','artist'],   headers: ['Title','Artist'],   filterCol: 'genre', statusLabel: 'Listened', yearCol: 'year', originCol: 'origin_country', timelineMode: 'decade'  },
  books: { label: 'Books',  file: 'data/books.csv', cols: ['title','author'],   headers: ['Title','Author'],   filterCol: 'genre', statusLabel: 'Read',     yearCol: 'year', originCol: 'origin_country', timelineMode: 'century' },
};

// ── Stats palette (matches Encore's editorial forest/gold identity) ───────
const STATS_PALETTE = ['#c9b97a', '#7a9e7e', '#b5651d', '#5b7c99', '#8e6c88', '#a3a15c', '#c17f7f', '#6b8f71'];
const RATING_COLORS  = { 1: '#b5651d', 2: '#c17f7f', 3: '#c9b97a', 4: '#a3a15c', 5: '#6b8f71' };
const GOLD_RAMP_LIGHT = ['#f7f0dd', '#eadfb4', '#ddc98a', '#c9b97a', '#a89a5e', '#8a723c'];
const GOLD_RAMP_DARK  = ['#4a4020', '#5e5228', '#79683a', '#c9b97a', '#ddc98a', '#eadfb4'];

// ── Country name normalization (world-atlas keys) ─────────────────────────
const COUNTRY_ALIASES = {
  'usa': 'United States of America', 'us': 'United States of America',
  'u.s.a.': 'United States of America', 'u.s.': 'United States of America',
  'united states': 'United States of America', 'america': 'United States of America',
  'uk': 'United Kingdom', 'u.k.': 'United Kingdom', 'england': 'United Kingdom',
  'britain': 'United Kingdom', 'great britain': 'United Kingdom',
  'scotland': 'United Kingdom', 'wales': 'United Kingdom', 'northern ireland': 'United Kingdom',
  'russia': 'Russia', 'russian federation': 'Russia',
  'south korea': 'South Korea', 'korea': 'South Korea', 'republic of korea': 'South Korea',
  'north korea': 'North Korea',
  'czech republic': 'Czechia', 'czechia': 'Czechia',
  'ivory coast': "Côte d'Ivoire", "côte d'ivoire": "Côte d'Ivoire",
  'macedonia': 'North Macedonia', 'the netherlands': 'Netherlands', 'holland': 'Netherlands',
  'burma': 'Myanmar',
};
function normalizeCountry(raw) {
  const key = raw.trim().toLowerCase();
  return COUNTRY_ALIASES[key] || raw.trim();
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function centuryBucket(year) {
  if (year > 0) {
    const c = Math.ceil(year / 100);
    return { key: c, label: `${ordinal(c)} century` };
  }
  if (year < 0) {
    const c = Math.ceil(Math.abs(year) / 100);
    return { key: -c, label: `${ordinal(c)} century BC` };
  }
  return null;
}
function decadeBucket(year) {
  const d = Math.floor(year / 10) * 10;
  return { key: d, label: `${d}s` };
}

// ── State ────────────────────────────────────────────────────────────────
let cache          = {};
let covers         = {};
let activeTab      = 'dvds';
let sortCol        = 0;
let sortDir        = 'asc';
let sortMode       = 'az';   // 'az' | 'za' | 'rating-asc' | 'rating-desc'
let query          = '';
let viewMode       = 'grid'; // 'grid' | 'list' | 'stats'
let activeFilters  = new Set();
let statusFilter   = 'all';  // 'all' | 'done' | 'undone'
let filterBarOpen  = false;
let yearBucketFilter = null; // set when a timeline bar is clicked in stats
let originFilter      = null; // set when a map country is clicked in stats

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

// ── Title cleaner ────────────────────────────────────────────────────────
function parseTitle(raw) {
  const clean  = raw.replace(/\s*\(x\d+\)\s*$/i, '').trim();
  const copies = raw.match(/\(x(\d+)\)/i);
  return { display: clean, copies: copies ? parseInt(copies[1]) : 1 };
}

// ── Fetch + cache ────────────────────────────────────────────────────────
async function loadTab(tab) {
  if (cache[tab]) return;
  try {
    const res = await fetch(TABS[tab].file);
    if (!res.ok) throw new Error(res.status);
    cache[tab] = parseCSV(await res.text());
  } catch (e) {
    cache[tab] = [];
    console.warn(`Could not load ${TABS[tab].file}:`, e);
  }
}

// ── Genre counts ─────────────────────────────────────────────────────────
function getGenreCounts() {
  const cfg = TABS[activeTab];
  if (!cfg.filterCol) return {};
  const data = cache[activeTab] ?? [];
  const counts = {};
  for (const row of data) {
    const g = (row[cfg.filterCol] || '').trim();
    if (g) counts[g] = (counts[g] || 0) + 1;
  }
  return counts;
}

// ── Status counts ─────────────────────────────────────────────────────────
function getStatusCounts() {
  const cfg  = TABS[activeTab];
  const data = cache[activeTab] ?? [];
  const label = cfg.statusLabel.toLowerCase();
  let done = 0, undone = 0;
  for (const row of data) {
    const s = (row['status'] || '').trim().toLowerCase();
    if (s === label) done++; else undone++;
  }
  return { done, undone, total: data.length };
}

// ── Stats data helpers ──────────────────────────────────────────────────
function getAvgRating() {
  const data = cache[activeTab] ?? [];
  const ratings = data.map(r => parseFloat(r['rating'])).filter(v => !isNaN(v) && v > 0);
  if (!ratings.length) return null;
  return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
}
function getRatingDistribution() {
  const data = cache[activeTab] ?? [];
  const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of data) {
    const r = parseFloat(row['rating']);
    if (isNaN(r) || r <= 0) continue;
    const b = Math.min(5, Math.max(1, Math.round(r)));
    buckets[b]++;
  }
  return buckets;
}
function getTimelineData() {
  const cfg  = TABS[activeTab];
  const data = cache[activeTab] ?? [];
  const map  = new Map();
  for (const row of data) {
    const y = parseInt(row[cfg.yearCol], 10);
    if (!y || isNaN(y)) continue;
    const b = cfg.timelineMode === 'century' ? centuryBucket(y) : decadeBucket(y);
    if (!b) continue;
    if (!map.has(b.key)) map.set(b.key, { label: b.label, count: 0 });
    map.get(b.key).count++;
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([key, v]) => ({ key, ...v }));
}
function getOriginData() {
  const cfg  = TABS[activeTab];
  const data = cache[activeTab] ?? [];
  if (!cfg.originCol) return {};
  const counts = {};
  for (const row of data) {
    const raw = (row[cfg.originCol] || '').trim();
    if (!raw) continue;
    const name = normalizeCountry(raw);
    counts[name] = (counts[name] || 0) + 1;
  }
  return counts;
}
function getLatestItems(n = 12) {
  const cfg   = TABS[activeTab];
  const data  = cache[activeTab] ?? [];
  const label = cfg.statusLabel.toLowerCase();
  const done  = data.filter(r => (r['status'] || '').trim().toLowerCase() === label);
  return done.slice(-n).reverse();
}

// ── Filter + sort ────────────────────────────────────────────────────────
function getRows() {
  const cfg   = TABS[activeTab];
  const data  = cache[activeTab] ?? [];
  const q     = query.toLowerCase();
  const label = cfg.statusLabel.toLowerCase();
  let rows = q
    ? data.filter(r => cfg.cols.some(c => (r[c] || '').toLowerCase().includes(q)))
    : data;
  if (cfg.filterCol && activeFilters.size > 0) {
    rows = rows.filter(r => activeFilters.has((r[cfg.filterCol] || '').trim()));
  }
  if (statusFilter === 'done') {
    rows = rows.filter(r => (r['status'] || '').trim().toLowerCase() === label);
  } else if (statusFilter === 'undone') {
    rows = rows.filter(r => (r['status'] || '').trim().toLowerCase() !== label);
  }
  if (yearBucketFilter !== null) {
    rows = rows.filter(r => {
      const y = parseInt(r[cfg.yearCol], 10);
      if (!y || isNaN(y)) return false;
      const b = cfg.timelineMode === 'century' ? centuryBucket(y) : decadeBucket(y);
      return b && b.key === yearBucketFilter;
    });
  }
  if (originFilter) {
    rows = rows.filter(r => normalizeCountry((r[cfg.originCol] || '').trim()) === originFilter);
  }
  return [...rows].sort((a, b) => {
    if (sortMode === 'az' || sortMode === 'za') {
      const col = cfg.cols[0];
      const av  = (a[col] || '').toLowerCase();
      const bv  = (b[col] || '').toLowerCase();
      return sortMode === 'az' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    if (sortMode === 'rating-desc' || sortMode === 'rating-asc') {
      const ar = parseFloat(a['rating']) || 0;
      const br = parseFloat(b['rating']) || 0;
      return sortMode === 'rating-desc' ? br - ar : ar - br;
    }
    return 0;
  });
}

// ── Render stars ──────────────────────────────────────────────────────────
function starsToSVG(val, goldColor, emptyColor, size) {
  const gap = size * 0.2;
  const r = size / 2;
  function starPath(cx, cy) {
    const outer = r * 0.95;
    const inner = r * 0.4;
    let d = '';
    for (let i = 0; i < 5; i++) {
      const outerAngle = (i * 72 - 90) * Math.PI / 180;
      const innerAngle = (i * 72 - 90 + 36) * Math.PI / 180;
      const ox = cx + outer * Math.cos(outerAngle);
      const oy = cy + outer * Math.sin(outerAngle);
      const ix = cx + inner * Math.cos(innerAngle);
      const iy = cy + inner * Math.sin(innerAngle);
      d += i === 0 ? `M${ox},${oy}` : `L${ox},${oy}`;
      d += `L${ix},${iy}`;
    }
    return d + 'Z';
  }
  const totalW = 5 * size + 4 * gap;
  let content = '';
  for (let i = 0; i < 5; i++) {
    const cx = i * (size + gap) + r;
    const cy = r;
    const path = starPath(cx, cy);
    const clipId = `hc${i}${Math.floor(Math.random()*9999)}`;
    if (val >= i + 1) {
      content += `<path d="${path}" fill="${goldColor}"/>`;
    } else if (val >= i + 0.5) {
      content += `<path d="${path}" fill="${emptyColor}"/>`;
      content += `<clipPath id="${clipId}"><rect x="${i*(size+gap)}" y="0" width="${r}" height="${size}"/></clipPath>`;
      content += `<path d="${path}" fill="${goldColor}" clip-path="url(#${clipId})"/>`;
    } else {
      content += `<path d="${path}" fill="${emptyColor}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${size}" viewBox="0 0 ${totalW} ${size}" style="display:block;"><defs>${
    Array.from({length:5},(_,i)=>{
      const cx = i*(size+gap)+r;
      const clipId = `hc${i}`;
      if(val>=i+0.5 && val<i+1) return `<clipPath id="${clipId}"><rect x="${i*(size+gap)}" y="0" width="${r}" height="${size}"/></clipPath>`;
      return '';
    }).join('')
  }</defs>${content}</svg>`;
}
function renderStars(rating) {
  const val = parseFloat(rating);
  if (!val || isNaN(val)) return '';
  return `<div class="card-back-stars">${starsToSVG(val, '#c9b97a', 'rgba(255,255,255,0.2)', 18)}</div>`;
}
function renderTableStars(val) {
  return starsToSVG(val, '#c9b97a', '#ddd6c8', 14);
}

// ── Render filter bar ─────────────────────────────────────────────────────
function renderFilterBar() {
  const cfg       = TABS[activeTab];
  const filterBar = document.getElementById('filter-bar');
  const toggle    = document.getElementById('filter-toggle');
  const label     = document.getElementById('filter-toggle-label');
  const hasActive = activeFilters.size > 0 || statusFilter !== 'all';
  toggle.classList.toggle('active', hasActive || filterBarOpen);
  label.textContent = hasActive ? `Filter · ${activeFilters.size + (statusFilter !== 'all' ? 1 : 0)}` : 'Filter';
  if (!filterBarOpen) {
    filterBar.style.display = 'none';
    filterBar.innerHTML = '';
    return;
  }
  filterBar.style.display = 'flex';
  filterBar.style.flexDirection = 'column';
  filterBar.style.marginTop = '0.75rem';
  filterBar.style.marginBottom = '1.25rem';
  filterBar.classList.add('open');
  const statusCounts = getStatusCounts();
  const statusLabel  = cfg.statusLabel;
  const sortOptions = [
    { key: 'az',          label: 'A → Z'      },
    { key: 'za',          label: 'Z → A'      },
    { key: 'rating-desc', label: 'Rating ↓'   },
    { key: 'rating-asc',  label: 'Rating ↑'   },
  ];
  const counts    = getGenreCounts();
  const genres    = Object.keys(counts).sort();
  const allActive = activeFilters.size === 0;
  const genreHtml = cfg.filterCol ? `
    <div class="filter-section">
      <div class="filter-section-label">Genre</div>
      <div class="filter-pills">
        <span class="filter-pill ${allActive ? 'active' : ''}" data-genre="">
          All <span class="filter-pill-count">${(cache[activeTab] ?? []).length}</span>
        </span>
        ${genres.map(g => `
          <span class="filter-pill ${activeFilters.has(g) ? 'active' : ''}" data-genre="${g}">
            ${g} <span class="filter-pill-count">${counts[g]}</span>
          </span>`).join('')}
      </div>
    </div>` : '';
  filterBar.innerHTML = `
    <div class="filter-section">
      <div class="filter-section-label">Sort</div>
      <div class="filter-pills">
        ${sortOptions.map(o => `
          <span class="filter-pill ${sortMode === o.key ? 'active' : ''}" data-sort="${o.key}">
            ${o.label}
          </span>`).join('')}
      </div>
    </div>
    ${genreHtml}
    <div class="filter-section">
      <div class="filter-section-label">Status</div>
      <div class="filter-pills">
        <span class="filter-pill ${statusFilter === 'all'   ? 'active' : ''}" data-status="all">All <span class="filter-pill-count">${statusCounts.total}</span></span>
        <span class="filter-pill ${statusFilter === 'done'  ? 'active' : ''}" data-status="done">${statusLabel} <span class="filter-pill-count">${statusCounts.done}</span></span>
        <span class="filter-pill ${statusFilter === 'undone'? 'active' : ''}" data-status="undone">Not ${statusLabel} <span class="filter-pill-count">${statusCounts.undone}</span></span>
      </div>
    </div>`;
  filterBar.querySelectorAll('[data-sort]').forEach(pill => {
    pill.addEventListener('click', () => {
      sortMode = pill.dataset.sort;
      render();
    });
  });
  filterBar.querySelectorAll('[data-genre]').forEach(pill => {
    pill.addEventListener('click', () => {
      const genre = pill.dataset.genre;
      yearBucketFilter = null; originFilter = null;
      if (genre === '' || activeFilters.has(genre)) activeFilters.clear();
      else { activeFilters.clear(); activeFilters.add(genre); }
      render();
    });
  });
  filterBar.querySelectorAll('[data-status]').forEach(pill => {
    pill.addEventListener('click', () => {
      statusFilter = pill.dataset.status;
      render();
    });
  });
}

// ── Render grid ──────────────────────────────────────────────────────────
function renderGrid(rows) {
  const cfg  = TABS[activeTab];
  const icon = ICONS[activeTab];
  const grid = document.getElementById('grid-view');
  if (!rows.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${
      query ? `No results for "${query}"` : `Nothing here yet`
    }</div>`;
    return;
  }
  grid.innerHTML = rows.map(r => {
    const { display, copies } = parseTitle(r[cfg.cols[0]] || '');
    const badge       = copies > 1 ? `<span class="card-badge">×${copies}</span>` : '';
    const creator     = r[cfg.cols[1]] || '';
    const rating      = r['rating'] || '';
    const status      = (r['status'] || '').trim().toLowerCase();
    const statusLabel = TABS[activeTab].statusLabel;
    const isDone      = status === statusLabel.toLowerCase();
    const creatorBack = (!creator || creator.toLowerCase() === 'n/a')
      ? '' : `<div class="card-back-divider"></div><div class="card-back-creator">${creator}</div>`;
    const starsHtml   = renderStars(rating);
    const statusHtml  = `<div class="card-back-status ${isDone ? 'done' : 'undone'}">${isDone ? statusLabel : `Not ${statusLabel}`}</div>`;
    const coverUrl = covers[activeTab]?.[display];
    const imgHtml  = coverUrl
      ? `<img src="${coverUrl}" alt="${display}" class="card-cover" loading="lazy">`
      : `<div class="card-img">${icon}</div>`;
    return `
      <div class="card">
        <div class="card-inner">
          <div class="card-front">
            ${imgHtml}
            <div class="card-body">
              <div class="card-title">${display}${badge}</div>
            </div>
          </div>
          <div class="card-back">
            <div class="card-back-title">${display}</div>
            ${creatorBack}
            <div class="card-back-divider"></div>
            ${starsHtml}
            ${statusHtml}
          </div>
        </div>
      </div>`;
  }).join('');
  grid.querySelectorAll('.card').forEach(card => {
    card.querySelector('.card-front').addEventListener('click', () => card.classList.add('flipped'));
    card.querySelector('.card-back').addEventListener('click',  () => card.classList.remove('flipped'));
  });
}

// ── Render table ─────────────────────────────────────────────────────────
function renderTable(rows) {
  const cfg         = TABS[activeTab];
  const head        = document.getElementById('table-head');
  const body        = document.getElementById('table-body');
  const statusLabel = cfg.statusLabel;
  head.innerHTML = `<tr>
    <th data-col="0" class="${sortCol === 0 ? 'sort-' + sortDir : ''}">Title<span class="sort-arrow"></span></th>
    <th data-col="1" class="${sortCol === 1 ? 'sort-' + sortDir : ''}">${cfg.headers[1]}<span class="sort-arrow"></span></th>
    <th>Genre</th>
    <th>Rating</th>
    <th>Status</th>
  </tr>`;
  head.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const ci = parseInt(th.dataset.col);
      if (sortCol === ci) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortCol = ci; sortDir = 'asc'; }
      render();
    });
  });
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty">No results</td></tr>`;
  } else {
    body.innerHTML = rows.map(r => {
      const { display, copies } = parseTitle(r[cfg.cols[0]] || '');
      const badge    = copies > 1 ? `<span class="badge">×${copies}</span>` : '';
      const creator  = r[cfg.cols[1]] || '';
      const genre    = r[cfg.filterCol] || '';
      const rating   = r['rating'] || '';
      const status   = (r['status'] || '').trim().toLowerCase();
      const isDone   = status === statusLabel.toLowerCase();
      const creatorCell = (!creator || creator.toLowerCase() === 'n/a')
        ? '<td class="creator">—</td>'
        : `<td class="creator">${creator}</td>`;
      const genreCell = genre
        ? `<td><span class="table-genre">${genre}</span></td>`
        : `<td class="creator">—</td>`;
      const ratingCell = rating
        ? `<td class="table-stars">${renderTableStars(parseFloat(rating))}</td>`
        : `<td class="creator">—</td>`;
      const statusCell = `<td><span class="table-status ${isDone ? 'done' : 'undone'}">${isDone ? statusLabel : `Not ${statusLabel}`}</span></td>`;
      return `<tr><td>${display}${badge}</td>${creatorCell}${genreCell}${ratingCell}${statusCell}</tr>`;
    }).join('');
  }
}

// ── Stats: lazy library loading ───────────────────────────────────────────
let statsLibsPromise = null;
let worldTopoPromise = null;
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
function loadStatsLibs() {
  if (!statsLibsPromise) {
    statsLibsPromise = Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js'),
    ]);
  }
  return statsLibsPromise;
}
function loadWorldTopo() {
  if (!worldTopoPromise) {
    worldTopoPromise = fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());
  }
  return worldTopoPromise;
}

// ── Stats: chart instance registry (avoid "canvas already in use") ────────
let statsCharts = {};
function destroyStatsCharts() {
  Object.values(statsCharts).forEach(c => c && c.destroy());
  statsCharts = {};
}

// ── Stats: build dashboard HTML skeleton ──────────────────────────────────
function statsSkeleton() {
  const cfg = TABS[activeTab];
  const total = (cache[activeTab] ?? []).length;
  const statusCounts = getStatusCounts();
  const avgRating = getAvgRating();
  const originCounts = getOriginData();
  const countryCount = Object.keys(originCounts).length;

  return `
    <div class="stat-tile">
      <div class="stat-tile-label">Titles</div>
      <div class="stat-tile-value">${total}</div>
    </div>
    <div class="stat-tile" style="border-left-color:#7a9e7e">
      <div class="stat-tile-label">${cfg.statusLabel}</div>
      <div class="stat-tile-value">${statusCounts.done} <small>/ ${statusCounts.total}</small></div>
    </div>
    <div class="stat-tile" style="border-left-color:#b5651d">
      <div class="stat-tile-label">Avg rating</div>
      <div class="stat-tile-value">${avgRating ?? '—'}</div>
    </div>

    <div class="chart-tile map-tile" style="grid-column: span 4; grid-row: span 5;">
      <div class="map-tile-header">
        <div class="chart-tile-title">Where the ${cfg.headers[1].toLowerCase()}s are from</div>
        ${countryCount ? `<div class="map-legend"><span>1</span><div class="map-legend-bar" style="background:linear-gradient(to right, ${GOLD_RAMP_LIGHT[0]}, ${GOLD_RAMP_LIGHT[5]})"></div><span>${Math.max(...Object.values(originCounts))}</span></div>` : ''}
      </div>
      <div class="chart-tile-body" id="map-body"></div>
    </div>

    <div class="chart-tile" style="grid-column: span 2; grid-row: span 5;">
      <div class="chart-tile-title">Genres · click a bar to filter</div>
      <div class="chart-tile-body" id="genre-body"></div>
    </div>

    <div class="chart-tile" style="grid-column: span 3; grid-row: span 3;">
      <div class="chart-tile-title">${cfg.timelineMode === 'century' ? 'When it was written' : 'Decade released'}</div>
      <div class="chart-tile-sub">${cfg.timelineMode === 'century' ? 'Grouped by century' : 'Click a bar to filter'}</div>
      <div class="chart-tile-body" id="timeline-body"></div>
    </div>

    <div class="chart-tile" style="grid-column: span 3; grid-row: span 3;">
      <div class="chart-tile-title">Rating distribution</div>
      <div class="chart-tile-body" id="rating-body"></div>
    </div>

    <div class="chart-tile latest-tile">
      <div class="chart-tile-title">Latest ${cfg.statusLabel.toLowerCase()}</div>
      <div class="latest-scroll" id="latest-body"></div>
    </div>`;
}

// ── Stats: render charts into the skeleton ────────────────────────────────
function renderStatsCharts() {
  const cfg = TABS[activeTab];
  destroyStatsCharts();

  // Genre bar
  const genreCounts = getGenreCounts();
  const genreEntries = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
  const genreBody = document.getElementById('genre-body');
  if (!genreEntries.length) {
    genreBody.innerHTML = `<div class="chart-empty">No genre data yet.</div>`;
  } else {
    genreBody.innerHTML = `<canvas id="genre-canvas" role="img" aria-label="Bar chart of genres"></canvas>`;
    statsCharts.genre = new Chart(document.getElementById('genre-canvas'), {
      type: 'bar',
      data: {
        labels: genreEntries.map(e => e[0]),
        datasets: [{ data: genreEntries.map(e => e[1]), backgroundColor: genreEntries.map((_, i) => STATS_PALETTE[i % STATS_PALETTE.length]), borderRadius: 4, maxBarThickness: 16 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        onClick: (e, els) => {
          if (!els.length) return;
          activeFilters.clear();
          activeFilters.add(genreEntries[els[0].index][0]);
          yearBucketFilter = null; originFilter = null;
          viewMode = 'grid';
          setActiveViewBtn('btn-grid');
          document.getElementById('toolbar').classList.remove('stats-mode');
          render();
        },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        scales: {
          x: { beginAtZero: true, grid: { color: '#ddd6c8' }, ticks: { color: '#aaa', font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { color: '#aaa', font: { size: 10 } } }
        }
      }
    });
  }

  // Timeline
  const timeline = getTimelineData();
  const timelineBody = document.getElementById('timeline-body');
  if (!timeline.length) {
    timelineBody.innerHTML = `<div class="chart-empty">Add a <code>${cfg.yearCol}</code> column to your CSV to see this chart.</div>`;
  } else {
    timelineBody.innerHTML = `<canvas id="timeline-canvas" role="img" aria-label="Bar chart over time"></canvas>`;
    const ramp = timeline.map((_, i) => GOLD_RAMP_DARK[Math.min(5, Math.floor(i / timeline.length * 6))]);
    statsCharts.timeline = new Chart(document.getElementById('timeline-canvas'), {
      type: 'bar',
      data: { labels: timeline.map(t => t.label), datasets: [{ data: timeline.map(t => t.count), backgroundColor: ramp, borderRadius: 3, maxBarThickness: 22 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        onClick: (e, els) => {
          if (!els.length) return;
          yearBucketFilter = timeline[els[0].index].key;
          activeFilters.clear(); originFilter = null;
          viewMode = 'grid';
          setActiveViewBtn('btn-grid');
          document.getElementById('toolbar').classList.remove('stats-mode');
          render();
        },
        onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        scales: {
          y: { display: false, grid: { display: false } },
          x: { grid: { display: false }, ticks: { color: '#aaa', font: { size: 9 }, autoSkip: false, maxRotation: 45 } }
        }
      }
    });
  }

  // Rating distribution
  const ratingDist = getRatingDistribution();
  const ratingTotal = Object.values(ratingDist).reduce((a, b) => a + b, 0);
  const ratingBody = document.getElementById('rating-body');
  if (!ratingTotal) {
    ratingBody.innerHTML = `<div class="chart-empty">No ratings yet.</div>`;
  } else {
    ratingBody.innerHTML = `<canvas id="rating-canvas" role="img" aria-label="Bar chart of rating distribution"></canvas>`;
    statsCharts.rating = new Chart(document.getElementById('rating-canvas'), {
      type: 'bar',
      data: { labels: ['1★','2★','3★','4★','5★'], datasets: [{ data: [1,2,3,4,5].map(k => ratingDist[k]), backgroundColor: [1,2,3,4,5].map(k => RATING_COLORS[k]), borderRadius: 3, maxBarThickness: 24 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { display: false, grid: { display: false } },
          x: { grid: { display: false }, ticks: { color: '#aaa', font: { size: 10 } } }
        }
      }
    });
  }

  // Map
  const originCounts = getOriginData();
  const mapBody = document.getElementById('map-body');
  if (!cfg.originCol || !Object.keys(originCounts).length) {
    mapBody.innerHTML = `<div class="chart-empty">Add an <code>${cfg.originCol}</code> column to your CSV to see this map.</div>`;
  } else {
    mapBody.innerHTML = `<div id="map-svg" style="width:100%;height:100%;"></div>`;
    loadWorldTopo().then(world => {
      const isDark = false; // Encore doesn't currently support a dark theme
      const maxVal = Math.max(...Object.values(originCounts));
      const color = d3.scaleQuantize([0, maxVal], GOLD_RAMP_LIGHT);
      const svg = d3.select('#map-svg').append('svg').attr('viewBox', '0 0 900 500').attr('width', '100%').attr('height', '100%');
      const projection = d3.geoNaturalEarth1().scale(150).translate([450, 250]);
      const path = d3.geoPath(projection);
      const tooltip = d3.select('#map-svg').append('div').attr('class', 'map-tooltip');
      svg.selectAll('path').data(topojson.feature(world, world.objects.countries).features).join('path')
        .attr('d', path)
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .attr('fill', d => {
          const v = originCounts[d.properties.name];
          return v ? color(v) : '#e8e3d8';
        })
        .style('cursor', d => originCounts[d.properties.name] ? 'pointer' : 'default')
        .on('mousemove', (event, d) => {
          const v = originCounts[d.properties.name];
          if (!v) return;
          tooltip.style('opacity', 1).style('left', (event.clientX + 12) + 'px').style('top', (event.clientY - 8) + 'px').text(`${d.properties.name}: ${v}`);
        })
        .on('mouseleave', () => tooltip.style('opacity', 0))
        .on('click', (event, d) => {
          const v = originCounts[d.properties.name];
          if (!v) return;
          originFilter = d.properties.name;
          activeFilters.clear(); yearBucketFilter = null;
          viewMode = 'grid';
          setActiveViewBtn('btn-grid');
          document.getElementById('toolbar').classList.remove('stats-mode');
          render();
        });
    });
  }

  // Latest strip
  const latest = getLatestItems();
  const latestBody = document.getElementById('latest-body');
  if (!latest.length) {
    latestBody.innerHTML = `<div class="chart-empty">Nothing marked ${cfg.statusLabel.toLowerCase()} yet.</div>`;
  } else {
    latestBody.innerHTML = latest.map((r, i) => {
      const { display } = parseTitle(r[cfg.cols[0]] || '');
      const creator = r[cfg.cols[1]] || '';
      const coverUrl = covers[activeTab]?.[display];
      const color = STATS_PALETTE[i % STATS_PALETTE.length];
      const cover = coverUrl
        ? `<img src="${coverUrl}" alt="${display}" class="latest-cover" loading="lazy">`
        : `<div class="latest-cover-placeholder" style="background:${color}">${ICONS[activeTab]}</div>`;
      return `<div class="latest-card">${cover}<div class="latest-card-title">${display}</div><div class="latest-card-sub">${creator}</div></div>`;
    }).join('');
  }
}

function renderStats() {
  const statsEl = document.getElementById('stats-view');
  statsEl.innerHTML = statsSkeleton();
  loadStatsLibs().then(renderStatsCharts).catch(err => {
    console.warn('Could not load stats libraries', err);
    statsEl.innerHTML += `<div class="chart-empty" style="grid-column:1/-1">Could not load charts — check your connection.</div>`;
  });
}

// ── Master render ─────────────────────────────────────────────────────────
function render() {
  const cfg    = TABS[activeTab];
  const gridEl = document.getElementById('grid-view');
  const listEl = document.getElementById('list-view');
  const statsEl = document.getElementById('stats-view');

  if (viewMode === 'stats') {
    gridEl.classList.add('hidden');
    listEl.classList.add('hidden');
    statsEl.classList.remove('hidden');
    document.getElementById('filter-bar').style.display = 'none';
    document.getElementById('count-label').textContent = `${(cache[activeTab] ?? []).length} ${cfg.label.toLowerCase()}`;
    renderStats();
    return;
  }

  statsEl.classList.add('hidden');
  const rows = getRows();
  const data = cache[activeTab] ?? [];
  renderFilterBar();

  if (viewMode === 'grid') {
    gridEl.classList.remove('hidden');
    listEl.classList.add('hidden');
    renderGrid(rows);
  } else {
    listEl.classList.remove('hidden');
    gridEl.classList.add('hidden');
    renderTable(rows);
  }

  const filterNote = (yearBucketFilter !== null || originFilter)
    ? ` <span class="stats-clear" id="stats-clear">clear stats filter</span>`
    : '';
  document.getElementById('count-label').innerHTML =
    (rows.length === data.length
      ? `${data.length} ${cfg.label.toLowerCase()}`
      : `${rows.length} of ${data.length} ${cfg.label.toLowerCase()}`) + filterNote;
  const clearBtn = document.getElementById('stats-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    yearBucketFilter = null; originFilter = null;
    render();
  });
}

// ── View toggle helpers ────────────────────────────────────────────────────
function setActiveViewBtn(id) {
  ['btn-grid', 'btn-list', 'btn-stats'].forEach(b => document.getElementById(b).classList.toggle('active', b === id));
}

// ── Filter toggle ─────────────────────────────────────────────────────────
document.getElementById('filter-toggle').addEventListener('click', () => {
  filterBarOpen = !filterBarOpen;
  render();
});

// ── View toggle ───────────────────────────────────────────────────────────
document.getElementById('btn-grid').addEventListener('click', () => {
  viewMode = 'grid';
  setActiveViewBtn('btn-grid');
  document.getElementById('toolbar').classList.remove('stats-mode');
  render();
});
document.getElementById('btn-list').addEventListener('click', () => {
  viewMode = 'list';
  setActiveViewBtn('btn-list');
  document.getElementById('toolbar').classList.remove('stats-mode');
  render();
});
document.getElementById('btn-stats').addEventListener('click', () => {
  viewMode = 'stats';
  setActiveViewBtn('btn-stats');
  filterBarOpen = false;
  document.getElementById('toolbar').classList.add('stats-mode');
  render();
});

// ── Tabs ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    activeTab        = btn.dataset.tab;
    sortCol          = 0;
    sortDir          = 'asc';
    sortMode         = 'az';
    activeFilters    = new Set();
    statusFilter     = 'all';
    filterBarOpen    = false;
    yearBucketFilter = null;
    originFilter     = null;
    document.getElementById('search').value = '';
    query = '';
    await loadTab(activeTab);
    render();
  });
});

// ── Search ────────────────────────────────────────────────────────────────
document.getElementById('search').addEventListener('input', e => {
  query = e.target.value;
  render();
});

// ── Header stats ────────────────────────────────────────────────────────────
async function loadStats() {
  for (const [key] of Object.entries(TABS)) {
    await loadTab(key);
    document.getElementById('stat-' + key).textContent = cache[key].length;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    const res = await fetch('data/covers.json');
    covers = await res.json();
  } catch(e) {
    console.warn('Could not load covers.json', e);
  }
  await loadTab('dvds');
  render();
  loadStats();
})();