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
  books: { label: 'Books',  file: 'data/books.csv', cols: ['title','author'],   headers: ['Title','Author']   },
  dvds:  { label: 'Films',  file: 'data/dvds.csv',  cols: ['title','director'], headers: ['Title','Director'] },
  cds:   { label: 'Music',  file: 'data/cds.csv',   cols: ['title','artist'],   headers: ['Title','Artist']   },
};

// ── State ────────────────────────────────────────────────────────────────
let cache     = {};
let covers    = {};
let activeTab = 'books';
let sortCol   = 0;
let sortDir   = 'asc';
let query     = '';
let viewMode  = 'grid';

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
  const match = raw.replace(/\s*\(x\d+\)\s*$/i, '').trim();
  const copies = raw.match(/\(x(\d+)\)/i);
  return { display: match, copies: copies ? parseInt(copies[1]) : 1 };
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

// ── Filter + sort ────────────────────────────────────────────────────────
function getRows() {
  const cfg  = TABS[activeTab];
  const data = cache[activeTab] ?? [];
  const q    = query.toLowerCase();
  let rows   = q
    ? data.filter(r => cfg.cols.some(c => (r[c] || '').toLowerCase().includes(q)))
    : data;
  const col  = cfg.cols[sortCol];
  return [...rows].sort((a, b) => {
    const av = (a[col] || '').toLowerCase();
    const bv = (b[col] || '').toLowerCase();
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });
}

// ── Render grid ──────────────────────────────────────────────────────────
function renderGrid(rows) {
  const cfg  = TABS[activeTab];
  const icon = ICONS[activeTab];
  const grid = document.getElementById('grid-view');

  if (!rows.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${
      query ? `No results for "${query}"` : `Nothing here yet — add entries to ${cfg.file}`
    }</div>`;
    return;
  }

  grid.innerHTML = rows.map(r => {
    const { display, copies } = parseTitle(r[cfg.cols[0]] || '');
    const badge       = copies > 1 ? `<span class="card-badge">×${copies}</span>` : '';
    const creator     = r[cfg.cols[1]] || '';
    const creatorHtml = (!creator || creator.toLowerCase() === 'n/a')
      ? '' : `<div class="card-creator">${creator}</div>`;
    const creatorBack = (!creator || creator.toLowerCase() === 'n/a')
      ? '' : `<div class="card-back-divider"></div><div class="card-back-creator">${creator}</div>`;

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
              ${creatorHtml}
            </div>
          </div>
          <div class="card-back">
            <div class="card-back-title">${display}</div>
            ${creatorBack}
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
  const cfg  = TABS[activeTab];
  const head = document.getElementById('table-head');
  const body = document.getElementById('table-body');

  head.innerHTML = '<tr>' + cfg.headers.map((h, i) => `
    <th data-col="${i}" class="${sortCol === i ? 'sort-' + sortDir : ''}">
      ${h}<span class="sort-arrow"></span>
    </th>`).join('') + '</tr>';

  head.querySelectorAll('th').forEach(th => {
    th.addEventListener('click', () => {
      const ci = parseInt(th.dataset.col);
      if (sortCol === ci) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortCol = ci; sortDir = 'asc'; }
      render();
    });
  });

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${cfg.cols.length}" class="empty">${
      query ? `No results for "${query}"` : `Nothing here yet — add entries to ${cfg.file}`
    }</td></tr>`;
  } else {
    body.innerHTML = rows.map(r => {
      const { display, copies } = parseTitle(r[cfg.cols[0]] || '');
      const badge = copies > 1 ? `<span class="badge">×${copies}</span>` : '';
      const creator = r[cfg.cols[1]] || '';
      const creatorCell = (!creator || creator.toLowerCase() === 'n/a')
        ? '<td class="creator">—</td>'
        : `<td class="creator">${creator}</td>`;
      return `<tr><td>${display}${badge}</td>${creatorCell}</tr>`;
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
    activeTab = btn.dataset.tab;
    sortCol = 0; sortDir = 'asc';
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
  await loadTab('books');
  render();
  loadStats();
})();