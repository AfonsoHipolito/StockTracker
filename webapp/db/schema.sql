-- StockTracker — esquema SQLite
-- Substitui os ficheiros JSON em webapp/data/ por uma base de dados única
-- (webapp/data/stocktracker.db). Ver migrate.py para a migração dos dados existentes.

PRAGMA foreign_keys = ON;

-- ── Posições da carteira ─────────────────────────────────────────────────
CREATE TABLE positions (
    isin             TEXT PRIMARY KEY,
    type             TEXT NOT NULL CHECK (type IN ('etf','stock','commodity','crypto','realestate','bonds')),
    name             TEXT NOT NULL,
    ticker           TEXT,
    yf_symbol        TEXT,
    price_currency   TEXT,
    bg               TEXT,
    currency         TEXT,
    reinvest         INTEGER NOT NULL DEFAULT 0,
    units            REAL,             -- ativos "normais"
    avg_buy_price    REAL,
    current_price    REAL,
    cost             REAL,
    invested_amount  REAL,             -- realestate/bonds
    annual_return    REAL,
    investment_months INTEGER,
    start_date       TEXT,
    finalizado       INTEGER DEFAULT 0
);

-- ── Transações (compras, vendas, dividendos unificados) ─────────────────
CREATE TABLE transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kind            TEXT NOT NULL CHECK (kind IN ('buy','sell','dividend')),
    isin            TEXT,             -- sem FK rígida: há transações antigas sem isin
    ticker          TEXT,
    instrument      TEXT,
    date            TEXT NOT NULL,     -- sempre normalizada para YYYY-MM-DD
    volume          REAL,
    unit_price      REAL,             -- valorCompra / valorVenda
    total           REAL,             -- valorTotal (buy/sell) ou dividendo líquido
    commission      REAL,             -- comissao (buy/sell, opcional)
    cost_basis      REAL,             -- custoBase (sell, opcional)
    profit          REAL,             -- lucro (sell)
    dividend_gross  REAL,             -- dividendoBruto (dividend, opcional)
    tax_withheld    REAL,             -- impostoRetido (dividend, opcional)
    broker          TEXT
);
CREATE INDEX idx_tx_date   ON transactions(date);
CREATE INDEX idx_tx_kind   ON transactions(kind);
CREATE INDEX idx_tx_isin   ON transactions(isin);
CREATE INDEX idx_tx_ticker ON transactions(ticker);

-- ── Rendimento mensal ─────────────────────────────────────────────────────
CREATE TABLE income_months (
    month      TEXT PRIMARY KEY,      -- 'YYYY-MM'
    income     REAL NOT NULL DEFAULT 0,
    is_current INTEGER NOT NULL DEFAULT 0   -- 1 = é o mês "corrente" (equivalente ao antigo income.json)
);
-- Garante que só um mês pode estar marcado como corrente de cada vez
CREATE UNIQUE INDEX idx_income_one_current ON income_months(is_current) WHERE is_current = 1;
CREATE TABLE income_items (
    id     TEXT PRIMARY KEY,
    month  TEXT NOT NULL REFERENCES income_months(month) ON DELETE CASCADE,
    kind   TEXT NOT NULL CHECK (kind IN ('mensalidade','category')),
    name   TEXT,
    color  TEXT,
    amount REAL NOT NULL DEFAULT 0,
    since  TEXT                       -- só mensalidades
);
CREATE INDEX idx_income_items_month ON income_items(month);

-- ── Planos de poupança ────────────────────────────────────────────────────
CREATE TABLE plans (
    id         TEXT PRIMARY KEY,
    name       TEXT,
    amount     REAL,
    frequency  TEXT,
    created_at TEXT
);
CREATE TABLE plan_assets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id       TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    position_isin TEXT,
    ticker        TEXT,
    name          TEXT,
    bg            TEXT,
    allocation    REAL
);
CREATE INDEX idx_plan_assets_plan ON plan_assets(plan_id);

-- ── Watchlist ─────────────────────────────────────────────────────────────
CREATE TABLE watchlists (
    id       TEXT PRIMARY KEY,
    name     TEXT,
    position INTEGER
);
CREATE TABLE watchlist_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id        TEXT NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    position       INTEGER,
    name           TEXT,
    ticker         TEXT,
    bg             TEXT,
    price_currency TEXT,
    yf_symbol      TEXT
);
CREATE INDEX idx_wl_items_list ON watchlist_items(list_id);

-- ── Análise de ações ──────────────────────────────────────────────────────
CREATE TABLE analysis_stocks (
    id               TEXT PRIMARY KEY,
    ticker           TEXT,
    name             TEXT,
    price            REAL,
    eps              REAL,
    eps_next_y       REAL,
    sales_per_share  REAL,
    dividend_yield   REAL,
    manual_growth    REAL,
    roe              REAL,
    profit_margin    REAL,
    oper_margin      REAL,
    gross_margin     REAL,
    current_assets      REAL,   -- Total Ativo Corrente (Current Ratio)
    current_liabilities REAL,   -- Total Passivo Corrente (Current Ratio)
    debt_to_equity      REAL,   -- rácio (não %), Dívida/Capital Próprio
    interested       INTEGER DEFAULT 0,  -- marcada como "quero comprar"
    source_currency  TEXT,
    fx_rate          REAL,
    fx_warning       TEXT,
    created_at       TEXT,
    last_fetched_at  TEXT
);
CREATE TABLE analysis_history (
    stock_id        TEXT NOT NULL REFERENCES analysis_stocks(id) ON DELETE CASCADE,
    year            INTEGER NOT NULL,
    eps             REAL,
    sales_per_share REAL,
    free_cash_flow_per_share REAL,   -- FCF/ação, para os checks de saúde financeira
    PRIMARY KEY (stock_id, year)
);

-- ── Snapshots diários (para o gráfico de Desempenho) ─────────────────────
CREATE TABLE history_snapshots (
    date TEXT PRIMARY KEY
);
CREATE TABLE history_prices (
    date            TEXT NOT NULL REFERENCES history_snapshots(date) ON DELETE CASCADE,
    isin            TEXT NOT NULL,
    price           REAL,
    units           REAL,
    avg_buy_price   REAL,
    type            TEXT,
    invested_amount REAL,
    PRIMARY KEY (date, isin)
);

-- ── Configuração (chave/valor — cada valor é um blob JSON) ───────────────
-- Permite adicionar secções de configuração novas no futuro sem alterar o esquema.
CREATE TABLE config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL   -- JSON serializado
);
