// ── Watchlist page logic ───────────────────────────────────────────────────────

let watchlists  = [];   // [{id, name, items:[]}]
let alerts      = [];
let activeListId = null; // null = cards view
let dragSrc     = null;

async function initWatchlist() {
    await Promise.all([loadWatchlists(), loadAlerts()]);
    renderView();
    setInterval(checkAlerts, 60_000);
    initAlertModal();
    initNewListModal();
}

// ── Active list helper ────────────────────────────────────────────────────────

function getActiveList() {
    return watchlists.find(l => l.id === activeListId) || null;
}

// ── Data I/O ──────────────────────────────────────────────────────────────────

async function loadWatchlists() {
    try {
        const raw = await fetch('/api/data/watchlist.json?_=' + Date.now()).then(r => r.json());
        // Migrate old flat format
        if (raw.length && !('items' in raw[0])) {
            watchlists = [{ id: 'favoritos', name: t('wl.default_list_name'), items: raw }];
        } else {
            watchlists = raw;
        }
    } catch { watchlists = []; }
}

async function loadAlerts() {
    try {
        alerts = await fetch('data/alerts.json').then(r => r.json());
    } catch { alerts = []; }
}

async function saveWatchlists() {
    const body = JSON.stringify(watchlists, null, 2);
    console.log('[saveWatchlists] posting', watchlists.length, 'lists,', body.length, 'bytes');
    const resp = await fetch('/api/data/watchlist.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    });
    const json = await resp.json().catch(() => ({}));
    console.log('[saveWatchlists] response', resp.status, json);
    if (!resp.ok) throw new Error(`Save failed: ${resp.status} — ${JSON.stringify(json)}`);
}

async function saveAlerts() {
    await fetch('/api/data/alerts.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alerts, null, 2),
    });
}

// ── View router ───────────────────────────────────────────────────────────────

function renderView() {
    if (activeListId === null) {
        renderCards();
    } else {
        renderList();
    }
}

// ── Cards view ────────────────────────────────────────────────────────────────

function renderCards() {
    const wrap = document.getElementById('wl-content');
    if (!wrap) return;

    document.getElementById('wl-header-title').textContent = t('wl.header_title');
    document.getElementById('wl-back-btn').classList.add('hidden');

    const fmt = v => v != null ? v.toFixed(2).replace('.', ',') + ' €' : '—';

    const cards = watchlists.map(lst => {
        const count = lst.items.length;
        const total = lst.items.reduce((s, it) => s + (it.price != null ? it.price : 0), 0);
        return `
        <div class="wl-card" data-list-id="${lst.id}">
            <div class="wl-card-name">${lst.name}</div>
            <div class="wl-card-count dim">${count} ${count !== 1 ? t('pf.assets_word') : t('pf.asset_word')}</div>
            <div class="wl-card-total">${fmt(total > 0 ? total : null)}</div>
        </div>`;
    }).join('');

    const newCard = `
    <div class="wl-card wl-card-new" id="wl-new-list-btn">
        <div class="wl-card-new-icon">+</div>
        <div class="wl-card-name dim">${t('wl.new_list_card_label')}</div>
    </div>`;

    wrap.innerHTML = `<div class="wl-cards-grid">${cards}${newCard}</div>`;

    wrap.querySelectorAll('.wl-card[data-list-id]').forEach(card => {
        card.addEventListener('click', () => {
            activeListId = card.dataset.listId;
            renderView();
        });
    });

    document.getElementById('wl-new-list-btn')?.addEventListener('click', openNewListModal);
}

// ── List view ─────────────────────────────────────────────────────────────────

function renderList() {
    const lst = getActiveList();
    if (!lst) { activeListId = null; renderCards(); return; }

    document.getElementById('wl-header-title').textContent = lst.name;
    document.getElementById('wl-back-btn').classList.remove('hidden');

    const wrap = document.getElementById('wl-content');
    if (!wrap) return;

    if (!lst.items.length) {
        wrap.innerHTML = `<p class="empty">${t('wl.no_assets_in_list')}</p>`;
        return;
    }

    const fmt2 = v => v.toFixed(2).replace('.', ',');

    const rows = lst.items.map((s, i) => {
        const cls    = s.up ? 'up' : 'down';
        const arrow  = s.up ? '▲' : '▼';
        const sign   = s.up ? '+' : '−';
        const price  = s.price != null ? `${fmt2(s.price)} ${s.priceCurrency || 'EUR'}` : '—';
        const change = s.change != null
            ? `<span class="${cls}">${arrow} ${sign}${fmt2(Math.abs(s.change))} ${s.priceCurrency || 'EUR'}</span>`
            : '<span class="dim">—</span>';
        const pct    = s.pct != null
            ? `<span class="${cls}">${arrow} ${sign}${fmt2(Math.abs(s.pct))} %</span>`
            : '<span class="dim">—</span>';
        const hasAlert = alerts.some(a => a.ticker === s.ticker && !a.triggered);
        const ticker6  = (s.ticker || '').slice(0, 6);

        return `
        <tr draggable="true" data-idx="${i}">
            <td>
                <div class="stock-cell">
                    <div class="stock-icon" style="background:${s.bg}">${ticker6}</div>
                    <div class="stock-info">
                        <span class="stock-name">${s.name}</span>
                        <span class="stock-price">${s.ticker}</span>
                    </div>
                </div>
            </td>
            <td><span class="dim">${price}</span></td>
            <td>${change}</td>
            <td>${pct}</td>
            <td>
                <div class="wl-actions">
                    <button class="wl-btn wl-bell ${hasAlert ? 'active' : ''}" data-idx="${i}" title="${t('wl.alert_modal_title')}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="${hasAlert ? 'currentColor' : 'none'}">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="wl-btn wl-hide" data-idx="${i}" title="${t('wl.remove_from_list_title')}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                    <span class="wl-btn wl-drag" title="${t('wl.drag_reorder_title')}">⠿</span>
                </div>
            </td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
    <table class="stocks-table">
        <thead>
            <tr>
                <th>${t('pf.field_name')}</th>
                <th>${t('wl.col_price')}</th>
                <th>${t('wl.col_trend_eur')}</th>
                <th>${t('wl.col_trend_pct')}</th>
                <th></th>
            </tr>
        </thead>
        <tbody id="watchlist-body">${rows}</tbody>
    </table>`;

    const tbody = wrap.querySelector('#watchlist-body');

    tbody.querySelectorAll('.wl-bell').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openAlertModal(+btn.dataset.idx); });
    });
    tbody.querySelectorAll('.wl-hide').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); removeFromActiveList(+btn.dataset.idx); });
    });

    tbody.querySelectorAll('tr[draggable]').forEach(row => {
        row.addEventListener('dragstart', onDragStart);
        row.addEventListener('dragover',  onDragOver);
        row.addEventListener('drop',      onDrop);
        row.addEventListener('dragend',   onDragEnd);
    });
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────

function onDragStart(e) {
    dragSrc = this;
    this.classList.add('drag-source');
    e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('#watchlist-body tr').forEach(r => r.classList.remove('drag-over'));
    this.classList.add('drag-over');
}

function onDrop(e) {
    e.preventDefault();
    if (dragSrc === this) return;
    const lst = getActiveList();
    if (!lst) return;
    const fromIdx = +dragSrc.dataset.idx;
    const toIdx   = +this.dataset.idx;
    const [moved] = lst.items.splice(fromIdx, 1);
    lst.items.splice(toIdx, 0, moved);
    renderList();
    saveWatchlists().catch(console.error);
}

function onDragEnd() {
    document.querySelectorAll('#watchlist-body tr').forEach(r => {
        r.classList.remove('drag-source', 'drag-over');
    });
}

// ── Remove ────────────────────────────────────────────────────────────────────

function removeFromActiveList(idx) {
    const lst = getActiveList();
    if (!lst) return;
    lst.items.splice(idx, 1);
    renderList();
    saveWatchlists().catch(console.error);
}

// ── Alerts ────────────────────────────────────────────────────────────────────

function checkAlerts() {
    let changed = false;
    const allItems = watchlists.flatMap(l => l.items);
    alerts.forEach(a => {
        if (a.triggered) return;
        const item = allItems.find(s => s.ticker === a.ticker);
        if (!item || item.price == null) return;
        const hit = a.direction === 'above' ? item.price >= a.targetPrice : item.price <= a.targetPrice;
        if (hit) {
            a.triggered = true;
            changed = true;
            const dir = a.direction === 'above' ? '≥' : '≤';
            addNotification(
                t('wl.alert_notification_title', { name: item.name }),
                t('wl.alert_notification_body', {
                    dir, target: a.targetPrice.toFixed(2).replace('.', ','),
                    currency: a.currency || 'EUR', current: item.price.toFixed(2).replace('.', ','),
                })
            );
        }
    });
    if (changed) { saveAlerts(); renderView(); }
}

// ── Alert Modal ───────────────────────────────────────────────────────────────

let alertModalIdx = -1;

function initAlertModal() {
    document.getElementById('alert-modal-close')?.addEventListener('click', closeAlertModal);
    document.getElementById('alert-cancel')?.addEventListener('click', closeAlertModal);
    document.getElementById('alert-modal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeAlertModal();
    });
    document.getElementById('alert-save')?.addEventListener('click', saveAlert);
}

function openAlertModal(idx) {
    alertModalIdx = idx;
    const lst = getActiveList();
    const s   = lst?.items[idx];
    if (!s) return;

    document.getElementById('alert-asset-name').textContent = `${s.name} (${s.ticker})`;
    document.getElementById('alert-current-val').textContent =
        s.price != null ? `${s.price.toFixed(2).replace('.', ',')} ${s.priceCurrency || 'EUR'}` : '—';
    document.getElementById('alert-currency').textContent = s.priceCurrency || 'EUR';
    document.getElementById('alert-price-input').value = '';

    const existing = alerts.find(a => a.ticker === s.ticker && !a.triggered);
    if (existing) {
        document.getElementById('alert-dir').value = existing.direction;
        document.getElementById('alert-price-input').value = existing.targetPrice;
    } else {
        document.getElementById('alert-dir').value = 'above';
    }

    document.getElementById('alert-modal').classList.remove('hidden');
    document.getElementById('alert-price-input').focus();
}

function closeAlertModal() {
    document.getElementById('alert-modal').classList.add('hidden');
    alertModalIdx = -1;
}

function saveAlert() {
    const lst = getActiveList();
    const s   = lst?.items[alertModalIdx];
    if (!s) return;
    const price = parseFloat(document.getElementById('alert-price-input').value);
    if (isNaN(price) || price <= 0) {
        document.getElementById('alert-price-input').focus();
        return;
    }
    const dir = document.getElementById('alert-dir').value;

    alerts = alerts.filter(a => !(a.ticker === s.ticker && !a.triggered));
    alerts.push({
        ticker:      s.ticker,
        name:        s.name,
        direction:   dir,
        targetPrice: price,
        currency:    s.priceCurrency || 'EUR',
        triggered:   false,
        createdAt:   new Date().toISOString(),
    });

    saveAlerts();
    renderView();
    closeAlertModal();
}

// ── New list modal ────────────────────────────────────────────────────────────

function initNewListModal() {
    document.getElementById('new-list-modal-close')?.addEventListener('click', closeNewListModal);
    document.getElementById('new-list-cancel')?.addEventListener('click', closeNewListModal);
    document.getElementById('new-list-modal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeNewListModal();
    });
    document.getElementById('new-list-confirm')?.addEventListener('click', createNewList);
    document.getElementById('new-list-name-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') createNewList();
    });
}

function openNewListModal() {
    document.getElementById('new-list-name-input').value = '';
    document.getElementById('new-list-modal').classList.remove('hidden');
    document.getElementById('new-list-name-input').focus();
}

function closeNewListModal() {
    document.getElementById('new-list-modal').classList.add('hidden');
}

async function createNewList() {
    const nameInput = document.getElementById('new-list-name-input');
    const confirmBtn = document.getElementById('new-list-confirm');
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }

    const id = 'list-' + Date.now();
    watchlists.push({ id, name, items: [] });

    confirmBtn.textContent = t('pf.saving');
    confirmBtn.disabled = true;

    try {
        await saveWatchlists();
    } catch (err) {
        console.error('[createNewList] save failed:', err);
        watchlists.pop(); // rollback
        renderCards();    // reset UI to pre-create state
        confirmBtn.textContent = t('plans.save_error');
        setTimeout(() => { confirmBtn.textContent = t('wl.create_btn'); confirmBtn.disabled = false; }, 3000);
        return;
    }

    confirmBtn.textContent = t('wl.create_btn');
    confirmBtn.disabled = false;
    closeNewListModal();
    renderCards();
}

// ── Add from search ───────────────────────────────────────────────────────────

async function addToWatchlistFromSearch(symbol, name, currency, listId) {
    // Always fetch fresh data first — avoids overwriting lists added from other pages
    let lists;
    try {
        const raw = await fetch('/api/data/watchlist.json?_=' + Date.now()).then(r => r.json());
        lists = (raw.length && 'items' in raw[0]) ? raw : [{ id: 'favoritos', name: t('wl.default_list_name'), items: raw }];
    } catch {
        lists = watchlists;
    }

    const targetId = listId || activeListId || null;
    let lst = (targetId && lists.find(l => l.id === targetId)) || lists[0];
    if (!lst) {
        lst = { id: 'favoritos', name: t('wl.default_list_name'), items: [] };
        lists.push(lst);
    }

    if (!lst.items.some(s => s.ticker === symbol)) {
        lst.items.push({
            name, ticker: symbol, yfSymbol: symbol,
            bg: '#1a1a2a', priceCurrency: currency || 'EUR',
            price: null, change: null, pct: null, up: true,
        });
        try {
            const resp = await fetch('/api/data/watchlist.json', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lists, null, 2),
            });
            if (resp.ok) {
                watchlists = lists;
                renderView();
            } else {
                lst.items.pop();
            }
        } catch {
            lst.items.pop();
        }
    }

    const input = document.getElementById('nav-search-input');
    const drop  = document.getElementById('search-dropdown');
    if (input) input.value = '';
    if (drop)  drop.classList.add('hidden');
}
