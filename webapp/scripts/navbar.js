// Renders the shared navbar. Call mountNavbar('home'|'portfolio'|'analysis') in each page.

const SETTINGS_ASSET_TYPES = [
    { key: 'etf' }, { key: 'stock' }, { key: 'commodity' },
    { key: 'crypto' }, { key: 'realestate' }, { key: 'bonds' },
];

function mountNavbar(activePage) {
    const el = document.getElementById('navbar');
    if (!el) return;

    el.className = 'navbar';
    el.innerHTML = `
        <a href="portfolio.html" class="nav-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 5h18M3 12h18M3 19h18" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
            </svg>
            ${t('nav.brand')}
        </a>

        <div class="nav-search" id="nav-search-wrap">
            <svg class="ico-search" width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <input type="text" id="nav-search-input" placeholder="${t('nav.search_placeholder')}">
            <div id="search-dropdown" class="search-dropdown hidden"></div>
        </div>

        <div class="nav-links">
            <a href="portfolio.html"    class="nav-link ${activePage === 'portfolio'    ? 'active' : ''}">${t('nav.link_portfolio')}</a>
            <a href="performance.html" class="nav-link ${activePage === 'performance' ? 'active' : ''}">${t('nav.link_performance')}</a>
            <a href="transactions.html" class="nav-link ${activePage === 'transactions' ? 'active' : ''}">${t('nav.link_transactions')}</a>
            <a href="analysis.html"    class="nav-link ${activePage === 'analysis'    ? 'active' : ''}">${t('nav.link_analysis')}</a>
            <a href="plans.html"       class="nav-link ${activePage === 'plans'       ? 'active' : ''}">${t('nav.link_plans')}</a>
            <a href="income.html"      class="nav-link ${activePage === 'income'      ? 'active' : ''}">${t('nav.link_income')}</a>
            <div class="nav-bell" id="nav-bell">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span id="bell-badge" class="bell-badge hidden">0</span>
                <div id="bell-dropdown" class="bell-dropdown hidden">
                    <div class="bell-dropdown-header">
                        <span>${t('nav.notifications')}</span>
                        <button id="bell-clear-all" class="bell-clear-btn">${t('nav.clear')}</button>
                    </div>
                    <ul id="bell-list" class="bell-list"></ul>
                </div>
            </div>
            <div class="nav-profile" id="nav-profile">
                <div class="nav-avatar" id="nav-avatar">A</div>
                <div id="profile-dropdown" class="profile-dropdown hidden">
                    <button class="profile-menu-item" id="profile-settings-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        ${t('nav.settings')}
                    </button>
                    <div class="profile-menu-divider"></div>
                    <button class="profile-menu-item profile-menu-logout">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <polyline points="16 17 21 12 16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        ${t('nav.logout')}
                    </button>
                </div>
            </div>
        </div>
    `;

    if (!document.getElementById('settings-modal')) {
        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-box">
                <div class="modal-header">
                    <span class="modal-title">${t('settings.title')}</span>
                    <button class="modal-close" id="settings-modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <label class="modal-label" style="display:block;margin-bottom:6px">${t('settings.name_label')}</label>
                    <input class="alert-input-row" id="settings-user-name" type="text"
                           style="width:100%;box-sizing:border-box;background:#111;border:1px solid #333;border-radius:8px;color:#fff;font-size:14px;padding:9px 12px;outline:none"
                           placeholder="${t('settings.name_placeholder')}">

                    <label class="modal-label" style="display:block;margin:16px 0 6px">${t('settings.language_label')}</label>
                    <div class="nav-lang" id="settings-lang">
                        ${Object.entries(I18N_LANGS).map(([code, label]) => `
                            <button type="button" class="nav-lang-btn" data-lang="${code}">${label}</button>
                        `).join('')}
                    </div>

                    <label class="modal-label" style="display:block;margin:16px 0 6px">${t('settings.categories_label')}</label>
                    <p style="font-size:12px;color:#555;margin:0 0 8px">${t('settings.categories_hint')}</p>
                    <div id="settings-categories" style="display:flex;flex-direction:column;gap:6px">
                        ${SETTINGS_ASSET_TYPES.map(at => `
                            <label class="edit-reinvest-label" style="display:flex">
                                <input type="checkbox" id="settings-cat-${at.key}" data-cat="${at.key}"> ${t('type.' + at.key)}
                            </label>`).join('')}
                    </div>

                    <div class="profile-menu-divider" style="margin:16px 0"></div>
                    <label class="edit-reinvest-label" style="display:flex">
                        <input type="checkbox" id="settings-show-total"> ${t('settings.show_total')}
                    </label>

                    <div class="modal-actions" style="margin-top:16px">
                        <button class="btn-secondary" id="settings-cancel">${t('settings.cancel')}</button>
                        <button class="btn-primary" id="settings-save">${t('settings.save')}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    initBell();
    initProfile();
    initNavSearch(activePage);
    initAvatar();
}


// ── Bell / Notifications ──────────────────────────────────────────────────────

function getNotifications() {
    try { return JSON.parse(localStorage.getItem('st_notifications') || '[]'); } catch { return []; }
}

function saveNotifications(list) {
    localStorage.setItem('st_notifications', JSON.stringify(list));
}

function addNotification(title, body) {
    const list = getNotifications();
    list.unshift({ id: Date.now(), title, body, ts: new Date().toISOString(), read: false });
    if (list.length > 50) list.length = 50;
    saveNotifications(list);
    renderBell();
}

function renderBell() {
    const list   = getNotifications();
    const unread = list.filter(n => !n.read).length;
    const badge  = document.getElementById('bell-badge');
    const ul     = document.getElementById('bell-list');
    if (!badge || !ul) return;

    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.classList.toggle('hidden', unread === 0);

    if (!list.length) {
        ul.innerHTML = `<li class="bell-empty">${t('nav.no_notifications')}</li>`;
        return;
    }
    ul.innerHTML = list.map(n => `
        <li class="bell-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
            <span class="bell-item-title">${n.title}</span>
            <span class="bell-item-body">${n.body}</span>
            <span class="bell-item-ts">${formatTs(n.ts)}</span>
        </li>
    `).join('');
}

function formatTs(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) +
           ' · ' + d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

function initBell() {
    renderBell();
    const bell = document.getElementById('nav-bell');
    const drop = document.getElementById('bell-dropdown');
    if (!bell || !drop) return;

    bell.addEventListener('click', e => {
        e.stopPropagation();
        const open = !drop.classList.contains('hidden');
        drop.classList.toggle('hidden', open);
        if (!open) {
            // mark all read
            const list = getNotifications().map(n => ({ ...n, read: true }));
            saveNotifications(list);
            renderBell();
        }
    });

    document.getElementById('bell-clear-all')?.addEventListener('click', e => {
        e.stopPropagation();
        saveNotifications([]);
        renderBell();
    });

    document.addEventListener('click', () => drop.classList.add('hidden'));
}

// ── Profile dropdown & Settings modal ────────────────────────────────────────

async function initAvatar() {
    const avatar = document.getElementById('nav-avatar');
    if (!avatar) return;
    try {
        const cfg  = await fetch('/api/data/config.json').then(r => r.json());
        const name = (cfg.user?.name || '').trim();
        avatar.textContent = name ? name[0].toUpperCase() : 'A';
    } catch { /* mantém 'A' */ }
}

function initProfile() {
    const profile = document.getElementById('nav-profile');
    const drop    = document.getElementById('profile-dropdown');
    if (!profile || !drop) return;

    profile.addEventListener('click', e => {
        e.stopPropagation();
        drop.classList.toggle('hidden');
    });

    document.getElementById('profile-settings-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        drop.classList.add('hidden');
        openSettingsModal();
    });

    document.addEventListener('click', () => drop.classList.add('hidden'));

    document.getElementById('settings-modal-close')?.addEventListener('click', closeSettingsModal);
    document.getElementById('settings-cancel')?.addEventListener('click', closeSettingsModal);
    document.getElementById('settings-modal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeSettingsModal();
    });
    document.getElementById('settings-save')?.addEventListener('click', saveSettings);

    document.getElementById('settings-lang')?.querySelectorAll('.nav-lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingLang = btn.dataset.lang;
            updateSettingsLangButtons();
        });
    });
}

// ── Idioma (aplicado só ao Guardar) ──────────────────────────────────────────
let pendingLang = getLang();

function updateSettingsLangButtons() {
    document.getElementById('settings-lang')?.querySelectorAll('.nav-lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === pendingLang);
    });
}

async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    let cfg = {};
    try { cfg = await fetch('/api/data/config.json?_=' + Date.now()).then(r => r.json()); } catch { /* usa defaults */ }

    document.getElementById('settings-user-name').value = cfg.user?.name || '';

    const defaultCategories = cfg.portfolio?.defaultCategories || [];
    SETTINGS_ASSET_TYPES.forEach(t => {
        const box = document.getElementById(`settings-cat-${t.key}`);
        if (box) box.checked = defaultCategories.length === 0 || defaultCategories.includes(t.key);
    });

    document.getElementById('settings-show-total').checked = cfg.portfolio?.showTotalBalance !== false;

    pendingLang = getLang();
    updateSettingsLangButtons();

    modal.classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settings-modal')?.classList.add('hidden');
}

async function saveSettings() {
    const btn = document.getElementById('settings-save');
    btn.textContent = t('settings.saving');
    btn.disabled = true;
    try {
        const current = await fetch('/api/data/config.json?_=' + Date.now()).then(r => r.json()).catch(() => ({}));

        const checkedCats = SETTINGS_ASSET_TYPES
            .map(t => t.key)
            .filter(key => document.getElementById(`settings-cat-${key}`)?.checked);
        const allChecked = checkedCats.length === SETTINGS_ASSET_TYPES.length;

        current.user = { ...(current.user || {}), name: document.getElementById('settings-user-name').value.trim() };
        current.portfolio = {
            ...(current.portfolio || {}),
            defaultCategories: allChecked ? [] : checkedCats,
            showTotalBalance: document.getElementById('settings-show-total').checked,
        };

        const resp = await fetch('/api/data/config.json', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(current, null, 2),
        });
        if (!resp.ok) throw new Error();
        await initAvatar();

        if (pendingLang !== getLang()) {
            setLang(pendingLang); // persiste em localStorage e recarrega a página
            return;
        }

        btn.textContent = t('settings.saved');
        setTimeout(closeSettingsModal, 800);
    } catch {
        btn.textContent = t('settings.error');
    } finally {
        setTimeout(() => { btn.textContent = t('settings.save'); btn.disabled = false; }, 2000);
    }
}

// ── Search (disabled on watchlist — not implemented yet) ──────────────────────

function initNavSearch(activePage) {
    if (activePage !== 'watchlist') return;
    const input = document.getElementById('nav-search-input');
    const drop  = document.getElementById('search-dropdown');
    if (!input || !drop) return;

    input.addEventListener('input', () => {
        if (!input.value.trim()) drop.classList.add('hidden');
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            showWatchlistSearchDisabled();
        }
        if (e.key === 'Escape') { drop.classList.add('hidden'); input.value = ''; }
    });

    document.addEventListener('click', e => {
        if (!document.getElementById('nav-search-wrap')?.contains(e.target)) {
            drop.classList.add('hidden');
        }
    });
}

function showWatchlistSearchDisabled() {
    const drop = document.getElementById('search-dropdown');
    if (!drop) return;
    drop.innerHTML = `<div class="search-loading">${t('nav.search_not_implemented')}</div>`;
    drop.classList.remove('hidden');
}
