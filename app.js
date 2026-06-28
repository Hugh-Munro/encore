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
  dvds:  { label: 'Films',  file: 'data/dvds.csv',  cols: ['title','director'], headers: ['Title','Director'], filterCol: 'genre', statusLabel: 'Watched'  },
  cds:   { label: 'Music',  file: 'data/cds.csv',   cols: ['title','artist'],   headers: ['Title','Artist'],   filterCol: 'genre', statusLabel: 'Listened' },
  books: { label: 'Books',  file: 'data/books.csv', cols: ['title','author'],   headers: ['Title','Author'],   filterCol: 'genre', statusLabel: 'Read'     },
};

// ── State ────────────────────────────────────────────────────────────────
let cache         = {};
let covers        = {};
let activeTab = 'dvds';
let sortCol       = 0;
let sortDir       = 'asc';
let sortMode      = 'az';   // 'az' | 'za' | 'rating-asc' | 'rating-desc'
let query         = '';
let viewMode      = 'grid';
let activeFilters = new Set();
let statusFilter  = 'all';  // 'all' | 'done' | 'undone'
let filterBarOpen = false;

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

  // Sort section
  const sortOptions = [
    { key: 'az',          label: 'A → Z'      },
    { key: 'za',          label: 'Z → A'      },
    { key: 'rating-desc', label: 'Rating ↓'   },
    { key: 'rating-asc',  label: 'Rating ↑'   },
  ];

  // Genre section
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

  // Sort listeners
  filterBar.querySelectorAll('[data-sort]').forEach(pill => {
    pill.addEventListener('click', () => {
      sortMode = pill.dataset.sort;
      render();
    });
  });

  // Genre listeners
  filterBar.querySelectorAll('[data-genre]').forEach(pill => {
    pill.addEventListener('click', () => {
      const genre = pill.dataset.genre;
      if (genre === '' || activeFilters.has(genre)) activeFilters.clear();
      else { activeFilters.clear(); activeFilters.add(genre); }
      render();
    });
  });

  // Status listeners
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

// ── Master render ─────────────────────────────────────────────────────────
function render() {
  const rows   = getRows();
  const data   = cache[activeTab] ?? [];
  const cfg    = TABS[activeTab];
  const gridEl = document.getElementById('grid-view');
  const listEl = document.getElementById('list-view');

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

  document.getElementById('count-label').textContent =
    rows.length === data.length
      ? `${data.length} ${cfg.label.toLowerCase()}`
      : `${rows.length} of ${data.length} ${cfg.label.toLowerCase()}`;
}

// ── Filter toggle ─────────────────────────────────────────────────────────
document.getElementById('filter-toggle').addEventListener('click', () => {
  filterBarOpen = !filterBarOpen;
  render();
});

// ── View toggle ───────────────────────────────────────────────────────────
document.getElementById('btn-grid').addEventListener('click', () => {
  viewMode = 'grid';
  document.getElementById('btn-grid').classList.add('active');
  document.getElementById('btn-list').classList.remove('active');
  render();
});
document.getElementById('btn-list').addEventListener('click', () => {
  viewMode = 'list';
  document.getElementById('btn-list').classList.add('active');
  document.getElementById('btn-grid').classList.remove('active');
  render();
});

// ── Tabs ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    activeTab     = btn.dataset.tab;
    sortCol       = 0;
    sortDir       = 'asc';
    sortMode      = 'az';
    activeFilters = new Set();
    statusFilter  = 'all';
    filterBarOpen = false;
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

// ── Stats ─────────────────────────────────────────────────────────────────
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