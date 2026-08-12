// Renders the shared navbar. Call mountNavbar('home'|'portfolio'|'analysis') in each page.

const SETTINGS_ASSET_TYPES = [
    { key: 'etf' }, { key: 'stock' }, { key: 'commodity' },
    { key: 'crypto' }, { key: 'realestate' }, { key: 'bonds' },
];

// Mesmos ISINs fictícios usados em DEMO_POSITIONS no server.py — têm de ficar sincronizados.
const DEMO_ISINS = [
    'googl-demo', 'nvda-demo', 'vuaa-demo', 'vvsm-demo',
    'btc-demo', 'eth-demo', 'gold-demo', 'silver-demo',
];

function mountNavbar(activePage) {
    const el = document.getElementById('navbar');
    if (!el) return;

    el.className = 'navbar';
    el.innerHTML = `
        <div class="nav-logo">
            <a href="portfolio.html" class="nav-home-link" title="${t('nav.home_title')}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M3 10.5L12 3l9 7.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </a>
            <span id="nav-logo-text" class="nav-logo-text"></span>
        </div>

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
                        <span>Coming soon...</span> <!-- ${t('nav.notifications')} -->
                        <button id="bell-clear-all" class="bell-clear-btn">${t('nav.clear')}</button>
                    </div>
                    <ul id="bell-list" class="bell-list"></ul>
                </div>
            </div>
            <div class="nav-profile" id="nav-profile">
                <div class="nav-avatar" id="nav-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2.2"/>
                        <circle cx="12" cy="12" r="2.2"/>
                        <circle cx="12" cy="19" r="2.2"/>
                    </svg>
                </div>
                <div id="profile-dropdown" class="profile-dropdown hidden">
                    <button class="profile-menu-item" id="profile-help-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        ${t('nav.help')}
                    </button>
                    <div class="profile-menu-divider"></div>
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

                    <div class="profile-menu-divider" style="margin:16px 0"></div>
                    <label class="modal-label" style="display:block;margin-bottom:6px">${t('settings.demo_data_label')}</label>
                    <p style="font-size:12px;color:#555;margin:0 0 8px">${t('settings.demo_data_hint')}</p>
                    <button class="btn-secondary" id="settings-clear-demo" type="button">${t('settings.clear_demo_btn')}</button>

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
    typewriteLoop();
}

// ── Logo animado (máquina de escrever, ciclo saudação ↔ StockTracker) ───────────
async function typewriteLoop() {
    const el = document.getElementById('nav-logo-text');
    if (!el) return;

    let name = '';
    try {
        const cfg = await fetch('/api/data/config.json').then(r => r.json());
        name = (cfg.user?.name || '').trim();
    } catch { /* sem nome, usa só a saudação */ }

    const hour = new Date().getHours();
    const key  = hour < 5 ? 'nav.greeting_night'
        : hour < 12 ? 'nav.greeting_morning'
        : hour < 20 ? 'nav.greeting_afternoon'
        : 'nav.greeting_night';
    const greeting = name ? `${t(key)}, ${name}` : t(key);
    const phrases  = [greeting, t('nav.brand')];

    el.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'nav-greeting-cursor';
    cursor.textContent = '|';
    el.appendChild(cursor);

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    while (true) {
        for (const phrase of phrases) {
            for (const ch of phrase) {
                // Velocidade não constante: 30ms + 0–60ms aleatório por caractere.
                await sleep(30 + Math.random() * 60);
                cursor.before(ch);
            }
            await sleep(3000); // pausa a mostrar o texto completo
            while (cursor.previousSibling) {
                await sleep(15 + Math.random() * 30);
                cursor.previousSibling.remove();
            }
            await sleep(300); // pausa antes de começar a escrever a frase seguinte
        }
    }
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

    document.getElementById('profile-help-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        drop.classList.add('hidden');
        openHelpModal();
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

    document.getElementById('settings-clear-demo')?.addEventListener('click', clearDemoData);
}

// Modal de confirmação com o estilo da app (substitui o confirm() nativo do browser).
function showConfirmModal(message, { title, confirmLabel, danger = false } = {}) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box" style="width:340px">
                <div class="modal-header">
                    <span class="modal-title">${title || t('common.confirm_title')}</span>
                    <button class="modal-close" id="confirm-modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <p style="font-size:14px;line-height:1.5;margin:0">${message}</p>
                    <div class="modal-actions" style="margin-top:16px">
                        <button class="btn-secondary" id="confirm-modal-cancel">${t('pf.cancel')}</button>
                        <button class="${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-modal-ok">${confirmLabel || t('common.confirm_btn')}</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const cleanup = result => { overlay.remove(); resolve(result); };
        overlay.querySelector('#confirm-modal-cancel').addEventListener('click', () => cleanup(false));
        overlay.querySelector('#confirm-modal-close').addEventListener('click', () => cleanup(false));
        overlay.querySelector('#confirm-modal-ok').addEventListener('click', () => cleanup(true));
        overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
    });
}

// Guia de utilização, aberto a partir do menu de perfil (⋯) → Ajuda. Mesmo estilo
// visual dos outros modais (modal-overlay/modal-box), mas informativo, sem confirmação.
function openHelpModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-box" style="width:480px">
            <div class="modal-header">
                <span class="modal-title">${t('help.title')}</span>
                <button class="modal-close" id="help-modal-close">✕</button>
            </div>
            <div class="modal-body">
                <p style="font-size:13px;line-height:1.5;color:var(--muted);margin:0">${t('help.intro')}</p>

                <div>
                    <p style="font-size:13px;font-weight:600;margin:0 0 4px">${t('help.section_nav')}</p>
                    <p style="font-size:13px;line-height:1.5;color:var(--muted);margin:0">${t('help.nav_body')}</p>
                </div>

                <div>
                    <p style="font-size:13px;font-weight:600;margin:0 0 4px">${t('help.section_demo')}</p>
                    <p style="font-size:13px;line-height:1.5;color:var(--muted);margin:0">${t('help.demo_body')}</p>
                </div>

                <div>
                    <p style="font-size:13px;font-weight:600;margin:0 0 4px">${t('help.section_import')}</p>
                    <p style="font-size:13px;line-height:1.5;color:var(--muted);margin:0">${t('help.import_body')}</p>
                </div>

                <div>
                    <p style="font-size:13px;font-weight:600;margin:0 0 4px">${t('help.section_settings')}</p>
                    <p style="font-size:13px;line-height:1.5;color:var(--muted);margin:0">${t('help.settings_body')}</p>
                </div>

                <p style="font-size:12px;line-height:1.5;color:#555;margin:4px 0 0">${t('help.footer_note')}</p>

                <div class="modal-actions" style="margin-top:4px">
                    <button class="btn-primary" id="help-modal-ok">${t('help.close_btn')}</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#help-modal-close').addEventListener('click', close);
    overlay.querySelector('#help-modal-ok').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

async function clearDemoData() {
    if (!await showConfirmModal(t('settings.confirm_clear_demo'), { danger: true })) return;
    const btn = document.getElementById('settings-clear-demo');
    const original = btn.textContent;
    btn.disabled = true;
    try {
        const positions = await fetch('/api/data/positions.json?_=' + Date.now()).then(r => r.json());
        const kept = positions.filter(p => !DEMO_ISINS.includes(p.isin));
        const removed = positions.length - kept.length;
        if (removed > 0) {
            const resp = await fetch('/api/data/positions.json', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(kept, null, 2),
            });
            if (!resp.ok) throw new Error();
            btn.textContent = t('settings.demo_cleared', { n: removed });
        } else {
            btn.textContent = t('settings.no_demo_found');
        }
    } catch {
        btn.textContent = t('settings.clear_demo_error');
    } finally {
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2500);
    }
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
