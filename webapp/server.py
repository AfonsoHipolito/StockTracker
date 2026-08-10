#!/usr/bin/env python3
"""Servidor: ficheiros estáticos + API de preços via yfinance, com cache em memória."""

import http.server
import json
import re
import socketserver
import sqlite3
import sys
import threading
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

import yfinance as yf

sys.stdout.reconfigure(line_buffering=True)

ROOT    = Path(__file__).parent
DB_PATH = ROOT / 'db' / 'stocktracker.db'

# Ficheiros que aceitam escrita via POST /api/data/<nome> (substituem o antigo ficheiro por
# inteiro, tal como acontecia com os JSON). 'history.json' fica de fora propositadamente —
# só é escrito internamente via /api/snapshot.
ALLOWED  = {'positions.json', 'watchlist.json', 'config.json', 'plans.json', 'income.json', 'transactions.json', 'analysis.json'}
READABLE = ALLOWED | {'history.json'}
REPORT_MONTH_RE = re.compile(r'^\d{4}-(0[1-9]|1[0-2])$')

# ── Base de dados ──────────────────────────────────────────────────────────────
# SQLite: um ficheiro (data/stocktracker.db), sem servidor separado. Uma ligação por
# pedido (é barato); as escritas passam por _db_write_lock para evitar "database is locked"
# quando duas escritas concorrentes acontecem no mesmo instante.
_db_write_lock = threading.Lock()

def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA journal_mode = WAL')
    return conn

def init_db_if_needed():
    """Cria as tabelas a partir de schema.sql se a BD ainda não existir (clone novo)."""
    conn = sqlite3.connect(DB_PATH)
    try:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='positions'"
        ).fetchone()
        if row is None:
            schema = (ROOT / 'db' / 'schema.sql').read_text()
            conn.executescript(schema)
            conn.commit()
            print(f"  BD criada de raiz em {DB_PATH}")
    finally:
        conn.close()

# ── Cache em memória ──────────────────────────────────────────────────────────
# Evita repetir requests à API quando a página recarrega ou dois tabs estão abertos.
CACHE_TTL     = 15 * 60   # 15 minutos em segundos
_cache        = {}         # {key: {'data': ..., 'ts': float}}
_cache_lock   = threading.Lock()

# ── Cache de preços (yfinance) ────────────────────────────────────────────────
# Defaults; data/config.json pode sobrepor cacheTtlSec/freshTtlSec.
PRICE_CACHE_TTL    = 60 * 60  # 1 hora
PRICE_FRESH_TTL    = 15 * 60  # 15 minutos
_price_cache       = {}       # {yfSymbol: {'price': float, 'ts': float}}
_price_error_cache = {}       # {yfSymbol: {'message': str, 'ts': float}}

def cache_get(key):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry['ts']) < CACHE_TTL:
            return entry['data']
    return None

def cache_set(key, data):
    with _cache_lock:
        _cache[key] = {'data': data, 'ts': time.time()}

def cache_age(key):
    """Segundos desde o último fetch, ou None se não existir."""
    with _cache_lock:
        entry = _cache.get(key)
        if entry:
            return int(time.time() - entry['ts'])
    return None

def price_cache_get(symbol, ttl=PRICE_CACHE_TTL):
    entry = _price_cache.get(symbol)
    if entry and (time.time() - entry['ts']) < ttl:
        return entry['price']
    return None

def price_cache_age(symbol):
    entry = _price_cache.get(symbol)
    return int(time.time() - entry['ts']) if entry else None

def price_cache_ts(symbol):
    entry = _price_cache.get(symbol)
    return entry['ts'] if entry else 0

def price_error_get(symbol, ttl=PRICE_CACHE_TTL):
    entry = _price_error_cache.get(symbol)
    if entry and (time.time() - entry['ts']) < ttl:
        return entry['message']
    return None

def price_cache_set(symbol, price):
    _price_cache[symbol] = {'price': price, 'ts': time.time()}
    _price_error_cache.pop(symbol, None)

def price_error_set(symbol, message):
    _price_error_cache[symbol] = {'message': message, 'ts': time.time()}

def yf_symbol_key(position):
    return position.get('yfSymbol', '').strip()

def _safe_num(v):
    """None/NaN-safe float conversion (pandas devolve NaN, não None, para células em falta)."""
    try:
        f = float(v)
        return None if f != f else f  # f != f só é True para NaN
    except (TypeError, ValueError):
        return None

# ── Mercado aberto? ───────────────────────────────────────────────────────────
# Cobre todos os mercados relevantes em horário de Lisboa:
#   Europa (Euronext/Xetra): 08:30–16:30 Lisboa = 07:00–15:30 UTC (verão) / 08:30–16:30 UTC (inverno)
#   EUA (NYSE/NASDAQ):       14:30–21:00 Lisboa = 13:00–19:30 UTC (verão) / 14:30–21:00 UTC (inverno)
# Janela conservadora: 06:30–21:30 UTC Mon–Sex cobre tudo em qualquer época.

def market_open():
    now = datetime.now(timezone.utc)
    day  = now.weekday()              # 0=Mon … 4=Fri
    mins = now.hour * 60 + now.minute
    return day < 5 and 510 <= mins < 1260  # 08:30–21:00 UTC


# ══════════════════════════════════════════════════════════════════════════════
# Tradução SQL ↔ JSON — cada db_get_* reconstrói exatamente a forma do antigo
# ficheiro .json; cada db_save_* recebe esse mesmo formato e substitui os dados
# na BD (equivalente a "reescrever o ficheiro inteiro", tal como antes).
# ══════════════════════════════════════════════════════════════════════════════

# ── positions ────────────────────────────────────────────────────────────────
def db_get_positions(conn):
    rows = conn.execute('SELECT * FROM positions').fetchall()
    return [{
        'isin': r['isin'], 'type': r['type'], 'name': r['name'], 'ticker': r['ticker'],
        'yfSymbol': r['yf_symbol'], 'priceCurrency': r['price_currency'], 'bg': r['bg'],
        'units': r['units'], 'avgBuyPrice': r['avg_buy_price'], 'currentPrice': r['current_price'],
        'currency': r['currency'], 'reinvest': bool(r['reinvest']), 'cost': r['cost'],
        'investedAmount': r['invested_amount'], 'annualReturn': r['annual_return'],
        'investmentMonths': r['investment_months'], 'startDate': r['start_date'],
        'finalizado': bool(r['finalizado']),
    } for r in rows]

def db_save_positions(conn, positions):
    conn.execute('DELETE FROM positions')
    for p in positions:
        conn.execute('''
            INSERT INTO positions (isin, type, name, ticker, yf_symbol, price_currency, bg,
                currency, reinvest, units, avg_buy_price, current_price, cost,
                invested_amount, annual_return, investment_months, start_date, finalizado)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            p.get('isin'), p.get('type'), p.get('name'), p.get('ticker'), p.get('yfSymbol'),
            p.get('priceCurrency'), p.get('bg'), p.get('currency'), int(bool(p.get('reinvest'))),
            p.get('units'), p.get('avgBuyPrice'), p.get('currentPrice'), p.get('cost'),
            p.get('investedAmount'), p.get('annualReturn'), p.get('investmentMonths'),
            p.get('startDate'), int(bool(p.get('finalizado'))),
        ))

# ── transactions ─────────────────────────────────────────────────────────────
def db_get_transactions(conn):
    buy, sell, dividends = [], [], []
    for r in conn.execute('SELECT * FROM transactions ORDER BY id').fetchall():
        base = {}
        if r['isin']:
            base['isin'] = r['isin']
        base['ticker'] = r['ticker']
        base['instrument'] = r['instrument']

        if r['kind'] == 'buy':
            item = {**base, 'valorTotal': r['total'], 'volume': r['volume'],
                     'valorCompra': r['unit_price'], 'dataCompra': r['date'], 'broker': r['broker']}
            if r['commission'] is not None:
                item['comissao'] = r['commission']
            buy.append(item)
        elif r['kind'] == 'sell':
            item = {**base, 'valorTotal': r['total'], 'volume': r['volume'],
                     'valorVenda': r['unit_price'], 'dataVenda': r['date'], 'broker': r['broker']}
            if r['commission'] is not None:
                item['comissao'] = r['commission']
            if r['cost_basis'] is not None:
                item['custoBase'] = r['cost_basis']
            if r['profit'] is not None:
                item['lucro'] = r['profit']
            sell.append(item)
        else:
            item = {**base, 'dividendo': r['total'], 'dataDividendo': r['date'], 'broker': r['broker']}
            if r['dividend_gross'] is not None:
                item['dividendoBruto'] = r['dividend_gross']
            if r['tax_withheld'] is not None:
                item['impostoRetido'] = r['tax_withheld']
            dividends.append(item)

    return {'transactions': {'buy': buy, 'sell': sell, 'dividends': dividends}}

def db_save_transactions(conn, payload):
    tx = payload.get('transactions', {})
    conn.execute('DELETE FROM transactions')
    for b in tx.get('buy', []):
        conn.execute('''
            INSERT INTO transactions (kind, isin, ticker, instrument, date, volume, unit_price, total, commission, broker)
            VALUES ('buy',?,?,?,?,?,?,?,?,?)
        ''', (b.get('isin'), b.get('ticker'), b.get('instrument'), b.get('dataCompra'), b.get('volume'),
              b.get('valorCompra'), b.get('valorTotal'), b.get('comissao'), b.get('broker')))
    for s in tx.get('sell', []):
        conn.execute('''
            INSERT INTO transactions (kind, isin, ticker, instrument, date, volume, unit_price, total, commission, cost_basis, profit, broker)
            VALUES ('sell',?,?,?,?,?,?,?,?,?,?,?)
        ''', (s.get('isin'), s.get('ticker'), s.get('instrument'), s.get('dataVenda'), s.get('volume'),
              s.get('valorVenda'), s.get('valorTotal'), s.get('comissao'), s.get('custoBase'), s.get('lucro'), s.get('broker')))
    for d in tx.get('dividends', []):
        conn.execute('''
            INSERT INTO transactions (kind, isin, ticker, instrument, date, total, dividend_gross, tax_withheld, broker)
            VALUES ('dividend',?,?,?,?,?,?,?,?)
        ''', (d.get('isin'), d.get('ticker'), d.get('instrument'), d.get('dataDividendo'), d.get('dividendo'),
              d.get('dividendoBruto'), d.get('impostoRetido'), d.get('broker')))

# ── income (mês corrente) + reports (meses arquivados) ────────────────────────
def _income_items_for_month(conn, month):
    mensalidades, categories = [], []
    for it in conn.execute('SELECT * FROM income_items WHERE month=? ORDER BY rowid', (month,)).fetchall():
        d = {'id': it['id'], 'name': it['name'], 'color': it['color'], 'amount': it['amount']}
        if it['kind'] == 'mensalidade':
            if it['since']:
                d['since'] = it['since']
            mensalidades.append(d)
        else:
            categories.append(d)
    return mensalidades, categories

def _save_income_items(conn, month, kind_key, payload_key, payload):
    for it in payload.get(payload_key, []):
        if kind_key == 'mensalidade':
            conn.execute('''
                INSERT INTO income_items (id, month, kind, name, color, amount, since)
                VALUES (?,?,'mensalidade',?,?,?,?)
            ''', (it.get('id'), month, it.get('name'), it.get('color'), it.get('amount'), it.get('since')))
        else:
            conn.execute('''
                INSERT INTO income_items (id, month, kind, name, color, amount)
                VALUES (?,?,'category',?,?,?)
            ''', (it.get('id'), month, it.get('name'), it.get('color'), it.get('amount')))

def db_get_income(conn):
    row = conn.execute('SELECT * FROM income_months WHERE is_current=1').fetchone()
    if not row:
        return {'income': 0, 'month': None, 'mensalidades': [], 'categories': []}
    mensalidades, categories = _income_items_for_month(conn, row['month'])
    return {'income': row['income'], 'month': row['month'], 'mensalidades': mensalidades, 'categories': categories}

def db_save_income(conn, payload):
    month = payload.get('month')
    conn.execute('UPDATE income_months SET is_current=0')
    conn.execute('''
        INSERT INTO income_months (month, income, is_current) VALUES (?,?,1)
        ON CONFLICT(month) DO UPDATE SET income=excluded.income, is_current=1
    ''', (month, payload.get('income', 0)))
    conn.execute('DELETE FROM income_items WHERE month=?', (month,))
    _save_income_items(conn, month, 'mensalidade', 'mensalidades', payload)
    _save_income_items(conn, month, 'category', 'categories', payload)

def db_get_report(conn, month):
    row = conn.execute('SELECT * FROM income_months WHERE month=?', (month,)).fetchone()
    if not row:
        return None
    mensalidades, categories = _income_items_for_month(conn, month)
    return {'month': month, 'income': row['income'], 'mensalidades': mensalidades, 'categories': categories}

def db_save_report(conn, month, payload):
    conn.execute('''
        INSERT INTO income_months (month, income, is_current) VALUES (?,?,0)
        ON CONFLICT(month) DO UPDATE SET income=excluded.income, is_current=0
    ''', (month, payload.get('income', 0)))
    conn.execute('DELETE FROM income_items WHERE month=?', (month,))
    _save_income_items(conn, month, 'mensalidade', 'mensalidades', payload)
    _save_income_items(conn, month, 'category', 'categories', payload)

# ── plans ────────────────────────────────────────────────────────────────────
def db_get_plans(conn):
    plans = []
    for pr in conn.execute('SELECT * FROM plans ORDER BY created_at').fetchall():
        assets = [{
            'positionIsin': a['position_isin'], 'name': a['name'], 'ticker': a['ticker'],
            'bg': a['bg'], 'allocation': a['allocation'],
        } for a in conn.execute('SELECT * FROM plan_assets WHERE plan_id=? ORDER BY id', (pr['id'],)).fetchall()]
        plans.append({
            'id': pr['id'], 'name': pr['name'], 'amount': pr['amount'], 'frequency': pr['frequency'],
            'assets': assets, 'createdAt': pr['created_at'],
        })
    return plans

def db_save_plans(conn, plans):
    conn.execute('DELETE FROM plans')  # cascade apaga plan_assets associados
    for p in plans:
        conn.execute('INSERT INTO plans (id, name, amount, frequency, created_at) VALUES (?,?,?,?,?)',
                     (p.get('id'), p.get('name'), p.get('amount'), p.get('frequency'), p.get('createdAt')))
        for a in p.get('assets', []):
            conn.execute('''
                INSERT INTO plan_assets (plan_id, position_isin, ticker, name, bg, allocation)
                VALUES (?,?,?,?,?,?)
            ''', (p.get('id'), a.get('positionIsin'), a.get('ticker'), a.get('name'), a.get('bg'), a.get('allocation')))

# ── watchlists ───────────────────────────────────────────────────────────────
def db_get_watchlists(conn):
    lists = []
    for lr in conn.execute('SELECT * FROM watchlists ORDER BY position').fetchall():
        items = [{
            'name': i['name'], 'ticker': i['ticker'], 'bg': i['bg'], 'priceCurrency': i['price_currency'],
            'price': None, 'change': None, 'pct': None, 'up': True, 'yfSymbol': i['yf_symbol'],
        } for i in conn.execute('SELECT * FROM watchlist_items WHERE list_id=? ORDER BY position', (lr['id'],)).fetchall()]
        lists.append({'id': lr['id'], 'name': lr['name'], 'items': items})
    return lists

def db_save_watchlists(conn, lists):
    conn.execute('DELETE FROM watchlists')  # cascade apaga watchlist_items associados
    for i, lst in enumerate(lists):
        conn.execute('INSERT INTO watchlists (id, name, position) VALUES (?,?,?)',
                     (lst.get('id'), lst.get('name'), i))
        for j, it in enumerate(lst.get('items', [])):
            conn.execute('''
                INSERT INTO watchlist_items (list_id, position, name, ticker, bg, price_currency, yf_symbol)
                VALUES (?,?,?,?,?,?,?)
            ''', (lst.get('id'), j, it.get('name'), it.get('ticker'), it.get('bg'),
                  it.get('priceCurrency'), it.get('yfSymbol')))

# ── analysis ─────────────────────────────────────────────────────────────────
def db_get_analysis(conn):
    stocks = []
    for sr in conn.execute('SELECT * FROM analysis_stocks ORDER BY created_at').fetchall():
        history = [{'year': h['year'], 'eps': h['eps'], 'salesPerShare': h['sales_per_share'],
                    'freeCashFlowPerShare': h['free_cash_flow_per_share']}
                   for h in conn.execute('SELECT * FROM analysis_history WHERE stock_id=? ORDER BY year', (sr['id'],)).fetchall()]
        stock = {
            'id': sr['id'], 'ticker': sr['ticker'], 'name': sr['name'], 'price': sr['price'], 'eps': sr['eps'],
            'epsNextY': sr['eps_next_y'], 'salesPerShare': sr['sales_per_share'], 'dividendYield': sr['dividend_yield'],
            'manualGrowth': sr['manual_growth'], 'roe': sr['roe'], 'profitMargin': sr['profit_margin'],
            'operMargin': sr['oper_margin'], 'grossMargin': sr['gross_margin'],
            'currentAssets': sr['current_assets'], 'currentLiabilities': sr['current_liabilities'],
            'debtToEquity': sr['debt_to_equity'], 'interested': bool(sr['interested']), 'history': history,
            'createdAt': sr['created_at'],
        }
        if sr['source_currency'] is not None:
            stock['sourceCurrency'] = sr['source_currency']
        if sr['fx_rate'] is not None:
            stock['fxRate'] = sr['fx_rate']
        if sr['fx_warning'] is not None:
            stock['fxWarning'] = sr['fx_warning']
        if sr['last_fetched_at'] is not None:
            stock['lastFetchedAt'] = sr['last_fetched_at']
        stocks.append(stock)
    return stocks

def db_save_analysis(conn, stocks):
    conn.execute('DELETE FROM analysis_stocks')  # cascade apaga analysis_history associado
    for s in stocks:
        conn.execute('''
            INSERT INTO analysis_stocks (id, ticker, name, price, eps, eps_next_y, sales_per_share,
                dividend_yield, manual_growth, roe, profit_margin, oper_margin, gross_margin,
                current_assets, current_liabilities, debt_to_equity, interested,
                source_currency, fx_rate, fx_warning, created_at, last_fetched_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            s.get('id'), s.get('ticker'), s.get('name'), s.get('price'), s.get('eps'), s.get('epsNextY'),
            s.get('salesPerShare'), s.get('dividendYield'), s.get('manualGrowth'), s.get('roe'),
            s.get('profitMargin'), s.get('operMargin'), s.get('grossMargin'),
            s.get('currentAssets'), s.get('currentLiabilities'), s.get('debtToEquity'), int(bool(s.get('interested'))),
            s.get('sourceCurrency'), s.get('fxRate'), s.get('fxWarning'), s.get('createdAt'), s.get('lastFetchedAt'),
        ))
        for h in s.get('history', []):
            conn.execute('''INSERT INTO analysis_history (stock_id, year, eps, sales_per_share, free_cash_flow_per_share)
                             VALUES (?,?,?,?,?)''',
                         (s.get('id'), h.get('year'), h.get('eps'), h.get('salesPerShare'), h.get('freeCashFlowPerShare')))

# ── config ───────────────────────────────────────────────────────────────────
def db_get_config(conn):
    return {r['key']: json.loads(r['value']) for r in conn.execute('SELECT key, value FROM config').fetchall()}

def db_save_config(conn, payload):
    conn.execute('DELETE FROM config')
    for key, value in payload.items():
        conn.execute('INSERT INTO config (key, value) VALUES (?,?)', (key, json.dumps(value)))

# ── history (snapshots diários — só leitura pela API; escrita via /api/snapshot) ─
def db_get_history(conn):
    result = []
    for s in conn.execute('SELECT date FROM history_snapshots ORDER BY date').fetchall():
        date = s['date']
        prows = conn.execute('SELECT * FROM history_prices WHERE date=?', (date,)).fetchall()
        prices = {r['isin']: r['price'] for r in prows if r['price'] is not None}
        positions = [{
            'isin': r['isin'], 'units': r['units'], 'avgBuyPrice': r['avg_buy_price'],
            'type': r['type'], 'investedAmount': r['invested_amount'],
        } for r in prows]
        result.append({'date': date, 'prices': prices, 'positions': positions})
    return result


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # Mapeia pedidos "planos" (sem subpasta) para a pasta certa, consoante a extensão.
    # Ex: GET /portfolio.html -> serve views/portfolio.html
    #     GET /app.js         -> serve scripts/app.js
    #     GET /style.css      -> serve styles/style.css
    #     GET /               -> serve views/portfolio.html
    # Pedidos que já incluem uma subpasta (ex: /images/icon.png) passam sem alteração.
    _EXT_FOLDER = {'.html': 'views', '.js': 'scripts', '.css': 'styles'}

    def translate_path(self, path):
        url_path = path.split('?', 1)[0].split('#', 1)[0]
        name = url_path.lstrip('/')
        if name == '':
            name = 'views/portfolio.html'
        elif '/' not in name:
            folder = self._EXT_FOLDER.get(Path(name).suffix)
            if folder:
                name = f'{folder}/{name}'
        return super().translate_path('/' + name)

    def end_headers(self):
        # Disable caching for all responses so CSS/JS changes load immediately
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    # ── GET ───────────────────────────────────────────────────────────────────
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs     = urllib.parse.parse_qs(parsed.query)

        if parsed.path == '/api/prices':
            self._handle_prices()
        elif parsed.path == '/api/watchlist-prices':
            self._handle_watchlist_prices()
        elif parsed.path == '/api/all-prices':
            # Unified endpoint: returns portfolio prices + watchlist quotes in one call
            force = qs.get('force', ['0'])[0] == '1'
            only_isin = qs.get('isin', [''])[0].strip()
            try:
                after_ts = float(qs.get('after', ['0'])[0] or 0)
            except ValueError:
                after_ts = 0
            self._handle_all_prices(force, only_isin=only_isin or None, after_ts=after_ts)
        elif parsed.path == '/api/search':
            q = qs.get('q', [''])[0]
            self._handle_search(q)
        elif parsed.path == '/api/analysis-search':
            q = qs.get('q', [''])[0]
            self._handle_analysis_search(q)
        elif parsed.path == '/api/analysis-fundamentals':
            ticker = qs.get('ticker', [''])[0]
            self._handle_analysis_fundamentals(ticker)
        elif parsed.path == '/api/cache-status':
            self._handle_cache_status()
        elif parsed.path == '/api/snapshot':
            self._handle_snapshot()
        elif parsed.path == '/api/reports':
            self._handle_reports_list()
        elif parsed.path.startswith('/api/reports/'):
            self._handle_report_get(parsed.path[len('/api/reports/'):])
        elif parsed.path.startswith('/api/data/'):
            self._handle_data_get(parsed.path[len('/api/data/'):])
        else:
            super().do_GET()

    # ── GET /api/data/<ficheiro> — lê da BD e devolve no formato JSON de sempre ──
    def _handle_data_get(self, filename):
        if filename not in READABLE:
            self._reply(404, {'error': f'Ficheiro "{filename}" não encontrado'})
            return
        conn = get_conn()
        try:
            getter = {
                'positions.json':    db_get_positions,
                'transactions.json': db_get_transactions,
                'income.json':       db_get_income,
                'plans.json':        db_get_plans,
                'watchlist.json':    db_get_watchlists,
                'analysis.json':     db_get_analysis,
                'config.json':       db_get_config,
                'history.json':      db_get_history,
            }[filename]
            self._reply(200, getter(conn))
        finally:
            conn.close()

    # ── POST ──────────────────────────────────────────────────────────────────
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path.startswith('/api/reports/'):
            self._handle_report_post(parsed.path[len('/api/reports/'):])
            return

        if not parsed.path.startswith('/api/data/'):
            self._reply(404, {'error': 'Rota desconhecida'})
            return

        filename = parsed.path[len('/api/data/'):]
        if filename not in ALLOWED:
            self._reply(403, {'error': f'Ficheiro "{filename}" não permitido'})
            return

        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            print(f"  POST {filename}: {length} bytes recebidos")
            data = json.loads(body)

            saver = {
                'positions.json':    db_save_positions,
                'transactions.json': db_save_transactions,
                'income.json':       db_save_income,
                'plans.json':        db_save_plans,
                'watchlist.json':    db_save_watchlists,
                'analysis.json':     db_save_analysis,
                'config.json':       db_save_config,
            }[filename]

            conn = get_conn()
            try:
                with _db_write_lock:
                    saver(conn, data)
                    conn.commit()
            finally:
                conn.close()

            print(f"  POST {filename}: gravado na BD")
            # Invalidate cache when data files change
            if filename in ('positions.json', 'watchlist.json'):
                with _cache_lock:
                    _cache.clear()
            self._reply(200, {'ok': True})
        except Exception as exc:
            print(f"  POST {filename}: ERROR {exc}")
            self._reply(400, {'error': str(exc)})

    # ── Relatórios mensais (income arquivado) ────────────────────────────────────
    def _handle_reports_list(self):
        conn = get_conn()
        try:
            rows = conn.execute(
                'SELECT month FROM income_months WHERE is_current=0 ORDER BY month DESC'
            ).fetchall()
            self._reply(200, {'months': [r['month'] for r in rows]})
        finally:
            conn.close()

    def _handle_report_get(self, month):
        if not REPORT_MONTH_RE.match(month):
            self._reply(400, {'error': 'Mês inválido'})
            return
        conn = get_conn()
        try:
            report = db_get_report(conn, month)
        finally:
            conn.close()
        if report is None:
            self._reply(404, {'error': 'Relatório não encontrado'})
            return
        self._reply(200, report)

    def _handle_report_post(self, month):
        if not REPORT_MONTH_RE.match(month):
            self._reply(400, {'error': 'Mês inválido'})
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = self.rfile.read(length)
            data   = json.loads(body)
            conn = get_conn()
            try:
                with _db_write_lock:
                    db_save_report(conn, month, data)
                    conn.commit()
            finally:
                conn.close()
            print(f"  POST report {month}: guardado na BD")
            self._reply(200, {'ok': True})
        except Exception as exc:
            print(f"  POST report {month}: ERROR {exc}")
            self._reply(400, {'error': str(exc)})

    # ── Unified all-prices endpoint ───────────────────────────────────────────
    def _handle_all_prices(self, force=False, only_isin=None, after_ts=0):
        """Portfolio prices only. Without force this serves cache only; force fetches live via yfinance."""
        cache_key = 'all_prices'

        try:
            config   = self._load_config()
            settings = self._price_settings(config)
            cache_ttl = settings['priceCacheTtlSec']
            fresh_ttl = settings['priceFreshTtlSec']

            conn = get_conn()
            try:
                positions = db_get_positions(conn)
            finally:
                conn.close()
            priority = {'etf': 0, 'stock': 1, 'commodity': 2, 'crypto': 3}
            tracked = [
                p for p in positions
                if p.get('yfSymbol', '').strip()
                and p.get('isin')
                and p.get('type') not in ('realestate', 'bonds')
                and (only_isin is None or p.get('isin') == only_isin)
            ]
            tracked.sort(key=lambda p: (priority.get(p.get('type'), 9), p.get('name', '')))

            result = {'positions': {}, 'watchlist': {}, '_price_ages': {}}
            stale = []
            cached_errors = {}

            for p in tracked:
                sym = yf_symbol_key(p)
                key = p.get('isin')
                cached_price = price_cache_get(sym, cache_ttl)
                if (
                    not force
                    or (force and after_ts and price_cache_ts(sym) >= after_ts)
                ):
                    if cached_price is not None:
                        result['positions'][key] = cached_price
                        result['_price_ages'][key] = price_cache_age(sym) or 0
                    elif price_error_get(sym, cache_ttl):
                        cached_errors[sym] = price_error_get(sym, cache_ttl)
                    continue
                if price_error_get(sym, cache_ttl) and not force:
                    cached_errors[sym] = price_error_get(sym, cache_ttl)
                else:
                    stale.append(p)

            if not force:
                payload = {
                    **result,
                    '_cached': True,
                    '_manual_required': True,
                    '_updated': 0,
                    '_pending': len(tracked),
                    '_price_cache_ttl_sec': cache_ttl,
                    '_price_fresh_ttl_sec': fresh_ttl,
                    '_market_open': market_open(),
                }
                if cached_errors:
                    payload['_symbol_errors'] = cached_errors
                self._reply(200, payload)
                return

            if not stale:
                payload = {
                    **result,
                    '_cached': True,
                    '_updated': 0,
                    '_pending': 0,
                    '_price_cache_ttl_sec': cache_ttl,
                    '_price_fresh_ttl_sec': fresh_ttl,
                    '_market_open': market_open(),
                }
                if cached_errors:
                    payload['_symbol_errors'] = cached_errors
                cache_set(cache_key, result)
                self._reply(200, payload)
                return

            raw_price = self._yf_fetch_quotes(stale)

            eur_usd = price_cache_get('EUR/USD', cache_ttl)
            needs_usd = any((raw_price.get(yf_symbol_key(p)) or {}).get('currency') == 'USD' for p in stale)
            if needs_usd and eur_usd is None:
                eur_usd = self._yf_fetch_eur_usd()
                if eur_usd:
                    price_cache_set('EUR/USD', eur_usd)
            eur_usd = eur_usd or 1.0

            updated = 0
            errors = {}
            for p in stale:
                sym = yf_symbol_key(p)
                key = p.get('isin')
                entry = raw_price.get(sym)
                if not entry or entry.get('price') is None:
                    message = (entry or {}).get('error') or 'A API não devolveu preço'
                    errors[sym] = message
                    price_error_set(sym, message)
                    continue
                try:
                    price = float(entry['price'])
                    api_currency = (entry.get('currency') or '').upper()
                    price_currency = api_currency or (p.get('priceCurrency') or 'EUR').upper()
                    if price_currency == 'USD' and eur_usd:
                        price = price / eur_usd
                    price = round(price, 4)
                    price_cache_set(sym, price)
                    result['positions'][key] = price
                    result['_price_ages'][key] = 0
                    updated += 1
                except (TypeError, ValueError):
                    errors[sym] = 'Preço inválido'
                    price_error_set(sym, 'Preço inválido')

            pending = sum(
                1 for p in tracked
                if price_cache_ts(yf_symbol_key(p)) < after_ts
                and price_error_get(yf_symbol_key(p), cache_ttl) is None
            )
            payload = {
                **result,
                '_cached': False,
                '_updated': updated,
                '_pending': pending,
                '_retry_after_sec': 30 if pending else 0,
                '_price_cache_ttl_sec': cache_ttl,
                '_price_fresh_ttl_sec': fresh_ttl,
                '_market_open': market_open(),
            }
            all_errors = {**cached_errors, **errors}
            if all_errors:
                payload['_symbol_errors'] = all_errors

            cached_all = cache_get(cache_key) or {'positions': {}, 'watchlist': {}, '_price_ages': {}}
            merged = {
                'positions': {**cached_all.get('positions', {}), **result.get('positions', {})},
                'watchlist': {},
                '_price_ages': {**cached_all.get('_price_ages', {}), **result.get('_price_ages', {})},
            }
            cache_set(cache_key, merged)
            self._reply(200, payload)

        except Exception as exc:
            # On unexpected error, serve stale cache if available
            with _cache_lock:
                stale_payload = _cache.get(cache_key, {}).get('data')
            if stale_payload:
                self._reply(200, {**stale_payload, '_cached': True, '_stale': True})
            else:
                self._reply(500, {'error': str(exc)})

    # ── Legacy /api/prices (portfolio only) ───────────────────────────────────
    def _handle_prices(self):
        cached = cache_get('all_prices')
        if cached and 'positions' in cached:
            self._reply(200, cached['positions'])
            return
        # Fallback: trigger full fetch
        self._handle_all_prices()

    # ── Legacy /api/watchlist-prices ─────────────────────────────────────────
    def _handle_watchlist_prices(self):
        self._reply(503, {'error': 'Preços da watchlist ainda não implementados nesta versão'})

    # ── Daily snapshot ────────────────────────────────────────────────────────
    def _handle_snapshot(self):
        """Grava os preços de fecho de hoje (a partir do cache) em history_*. Zero chamadas extra à API."""
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        conn = get_conn()
        try:
            # Não duplicar o snapshot de hoje
            if conn.execute('SELECT 1 FROM history_snapshots WHERE date=?', (today,)).fetchone():
                self._reply(200, {'ok': True, 'skipped': True, 'date': today})
                return

            # Usa preços já em cache — não faz chamadas novas à API
            cached = cache_get('all_prices')
            if not cached:
                self._reply(503, {'error': 'Sem dados em cache. Carrega os preços primeiro.'})
                return

            prices    = cached.get('positions', {})
            positions = db_get_positions(conn)

            with _db_write_lock:
                conn.execute('INSERT INTO history_snapshots (date) VALUES (?)', (today,))
                for p in positions:
                    conn.execute('''
                        INSERT OR REPLACE INTO history_prices
                            (date, isin, price, units, avg_buy_price, type, invested_amount)
                        VALUES (?,?,?,?,?,?,?)
                    ''', (today, p['isin'], prices.get(p['isin']), p['units'], p['avgBuyPrice'],
                          p['type'], p['investedAmount']))
                # Mantém no máximo 2 anos de snapshots diários
                cutoff_row = conn.execute(
                    'SELECT date FROM history_snapshots ORDER BY date DESC LIMIT 1 OFFSET 730'
                ).fetchone()
                if cutoff_row:
                    conn.execute('DELETE FROM history_snapshots WHERE date <= ?', (cutoff_row['date'],))
                conn.commit()

            print(f"  📸  Snapshot guardado: {today} ({len(prices)} posições)")
            self._reply(200, {'ok': True, 'date': today})
        finally:
            conn.close()

    # ── Cache status ──────────────────────────────────────────────────────────
    def _handle_cache_status(self):
        config = self._load_config()
        settings = self._price_settings(config)
        age  = cache_age('all_prices')
        self._reply(200, {
            'market_open':   market_open(),
            'cache_age_sec': age,
            'cache_ttl_sec': CACHE_TTL,
            'cache_fresh':   age is not None and age < CACHE_TTL,
            'price_cache_ttl_sec': settings['priceCacheTtlSec'],
            'price_fresh_ttl_sec': settings['priceFreshTtlSec'],
        })

    # ── Symbol search (no cache — low frequency) ──────────────────────────────
    def _handle_search(self, q):
        self._reply(503, {
            'error': 'Pesquisa de símbolos ainda não implementada nesta versão'
        })

    # ── Análise: pesquisa de ações via yfinance (sem cache — baixa frequência) ──
    def _handle_analysis_search(self, q):
        q = (q or '').strip()
        if not q:
            self._reply(200, {'results': []})
            return
        try:
            quotes = yf.Search(q).quotes
            results = [
                {
                    'symbol':   r.get('symbol'),
                    'name':     r.get('longname') or r.get('shortname') or r.get('symbol'),
                    'exchange': r.get('exchDisp') or r.get('exchange') or '',
                }
                for r in quotes
                if r.get('quoteType') == 'EQUITY' and r.get('symbol')
            ]
            self._reply(200, {'results': results})
        except Exception as exc:
            print(f"  yfinance search '{q}': ERRO {exc}")
            self._reply(502, {'error': str(exc)})

    # ── Análise: fundamentais de uma ação via yfinance ──────────────────────────
    def _handle_analysis_fundamentals(self, ticker):
        ticker = (ticker or '').strip()
        if not ticker:
            self._reply(400, {'error': 'Ticker em falta'})
            return
        try:
            t    = yf.Ticker(ticker)
            info = t.info
            if not info or not info.get('symbol'):
                self._reply(404, {'error': f'Ticker "{ticker}" não encontrado'})
                return

            currency = (info.get('currency') or 'USD').upper()
            fx_rate, fx_warning = 1.0, None
            if currency != 'EUR':
                fx_rate = self._yf_fetch_fx_to_eur(currency)
                if fx_rate is None:
                    fx_warning = f'Não foi possível converter {currency}→EUR — valores na moeda original ({currency}).'
                    fx_rate = 1.0
                else:
                    fx_warning = f'Dados originais em {currency}, convertidos para EUR à taxa {fx_rate:.6f}.'

            def money(key):
                v = _safe_num(info.get(key))
                return round(v * fx_rate, 4) if v is not None else None

            def pct_direct(key):
                return _safe_num(info.get(key))

            def pct_fraction(key):
                v = _safe_num(info.get(key))
                return round(v * 100, 2) if v is not None else None

            def ratio_direct(key):
                # Yahoo devolve debtToEquity já como "percentagem" (ex: 78.445 = 0.784 de rácio)
                v = _safe_num(info.get(key))
                return round(v / 100, 4) if v is not None else None

            current_assets, current_liabilities = self._yf_fetch_current_ratio_inputs(t, fx_rate)

            stock = {
                'ticker':         info.get('symbol', ticker.upper()),
                'name':           info.get('longName') or info.get('shortName') or '',
                'price':          money('currentPrice') or money('regularMarketPrice'),
                'eps':            money('trailingEps'),
                'epsNextY':       money('forwardEps'),
                'salesPerShare':  money('revenuePerShare'),
                'dividendYield':  pct_direct('dividendYield'),
                'roe':            pct_fraction('returnOnEquity'),
                'profitMargin':   pct_fraction('profitMargins'),
                'operMargin':     pct_fraction('operatingMargins'),
                'grossMargin':    pct_fraction('grossMargins'),
                'currentAssets':      current_assets,
                'currentLiabilities': current_liabilities,
                'debtToEquity':       ratio_direct('debtToEquity'),
                'history':        self._yf_fetch_history(t, fx_rate),
                'sourceCurrency': currency,
                'fxRate':         fx_rate if currency != 'EUR' else None,
                'fxWarning':      fx_warning,
            }
            self._reply(200, stock)
        except Exception as exc:
            print(f"  yfinance fundamentals '{ticker}': ERRO {exc}")
            self._reply(502, {'error': str(exc)})

    def _yf_fetch_fx_to_eur(self, currency):
        try:
            fi   = yf.Ticker(f'{currency}EUR=X').fast_info
            rate = fi.last_price
            return float(rate) if rate else None
        except Exception as exc:
            print(f"  yfinance FX {currency}→EUR: ERRO {exc}")
            return None

    def _yf_fetch_current_ratio_inputs(self, ticker_obj, fx_rate):
        """Total Ativo Corrente / Total Passivo Corrente (balanço mais recente), para o Current Ratio."""
        try:
            bs = ticker_obj.balance_sheet
            if bs is None or bs.empty:
                return None, None
            col = bs.columns[0]  # coluna mais recente
            ca = _safe_num(bs.loc['Current Assets', col])      if 'Current Assets'      in bs.index else None
            cl = _safe_num(bs.loc['Current Liabilities', col]) if 'Current Liabilities' in bs.index else None
            return (
                round(ca * fx_rate, 4) if ca is not None else None,
                round(cl * fx_rate, 4) if cl is not None else None,
            )
        except Exception as exc:
            print(f"  yfinance balance sheet: ERRO {exc}")
            return None, None

    def _yf_fetch_history(self, ticker_obj, fx_rate):
        """Últimos anos fiscais disponíveis (tipicamente 4 — limite do Yahoo Finance grátis)."""
        try:
            inc = ticker_obj.income_stmt
            if inc is None or inc.empty:
                return []

            fcf_by_year = {}
            try:
                cf = ticker_obj.cashflow
                if cf is not None and not cf.empty and 'Free Cash Flow' in cf.index:
                    for col in cf.columns:
                        fcf = _safe_num(cf.loc['Free Cash Flow', col])
                        if fcf is not None:
                            fcf_by_year[int(col.year)] = fcf
            except Exception as exc:
                print(f"  yfinance cashflow: ERRO {exc}")

            rows = []
            for col in inc.columns:
                eps     = _safe_num(inc.loc['Diluted EPS', col])      if 'Diluted EPS' in inc.index else None
                revenue = _safe_num(inc.loc['Total Revenue', col])    if 'Total Revenue' in inc.index else None
                shares  = _safe_num(inc.loc['Diluted Average Shares', col]) if 'Diluted Average Shares' in inc.index else None
                sales_per_share = revenue / shares if revenue is not None and shares else None
                year = int(col.year)
                fcf = fcf_by_year.get(year)
                fcf_per_share = fcf / shares if fcf is not None and shares else None
                rows.append({
                    'year':                 year,
                    'eps':                  round(eps * fx_rate, 4) if eps is not None else None,
                    'salesPerShare':        round(sales_per_share * fx_rate, 4) if sales_per_share is not None else None,
                    'freeCashFlowPerShare': round(fcf_per_share * fx_rate, 4) if fcf_per_share is not None else None,
                })
            return sorted(rows, key=lambda r: r['year'])
        except Exception as exc:
            print(f"  yfinance history: ERRO {exc}")
            return []

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _load_config(self):
        conn = get_conn()
        try:
            return db_get_config(conn)
        finally:
            conn.close()

    def _price_settings(self, config):
        price_cfg = config.get('prices', {})
        return {
            'priceCacheTtlSec': int(price_cfg.get('cacheTtlSec', config.get('priceCacheTtlSec', PRICE_CACHE_TTL))),
            'priceFreshTtlSec': int(price_cfg.get('freshTtlSec', config.get('priceFreshTtlSec', PRICE_FRESH_TTL))),
        }

    def _yf_fetch_quotes(self, positions):
        quotes = {}
        for p in positions:
            symbol = p.get('yfSymbol', '').strip()
            if not symbol:
                continue
            print(f"  yfinance quote: {symbol}")
            try:
                fi = yf.Ticker(symbol).fast_info
                price = fi.last_price
                if price is None:
                    raise ValueError('sem last_price')
                quotes[symbol] = {'price': float(price), 'currency': (fi.currency or '').upper()}
            except Exception as exc:
                print(f"  yfinance quote {symbol}: ERRO {exc}")
                quotes[symbol] = {'price': None, 'error': str(exc)}
        return quotes

    def _yf_fetch_eur_usd(self):
        try:
            fi = yf.Ticker('EURUSD=X').fast_info
            return float(fi.last_price)
        except Exception as exc:
            print(f"  yfinance EUR/USD: ERRO {exc}")
            return None

    def _reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        first = str(args[0]) if args else ''
        marker = '📡' if '/api/' in first else '  '
        print(f"  {marker}  {self.address_string()}  {fmt % args}")


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == '__main__':
    init_db_if_needed()
    port = 8080
    print(f"Stock Tracker — http://localhost:{port}")
    print(f"  Cache TTL: {CACHE_TTL//60} min | Mercado: {'🟢 Aberto' if market_open() else '🔴 Fechado'}")
    ThreadedHTTPServer(('', port), Handler).serve_forever()
