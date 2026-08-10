#!/usr/bin/env python3
"""
Migração única: lê os ficheiros JSON em data/ e popula data/stocktracker.db.

Uso:
    cd webapp
    python3 migrate.py

Não apaga os ficheiros JSON originais — ficam intactos em data/ como backup.
Se stocktracker.db já existir, o script recusa-se a correr (para não sobrepor
dados) a menos que passes --force.
"""

import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).parent           # webapp/db/  (era a antiga pasta data/, com os JSON já lá dentro)
DATA = ROOT                            # os JSON antigos vivem na mesma pasta que este script
DB_PATH = ROOT / 'stocktracker.db'
SCHEMA_PATH = ROOT / 'schema.sql'

DATE_DMY = re.compile(r'^(\d{2})-(\d{2})-(\d{4})$')
DATE_ISO = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def normalize_date(d):
    """Normaliza datas para YYYY-MM-DD. Aceita já-ISO ou DD-MM-YYYY."""
    if not d:
        return d
    if DATE_ISO.match(d):
        return d
    m = DATE_DMY.match(d)
    if m:
        dd, mm, yyyy = m.groups()
        return f'{yyyy}-{mm}-{dd}'
    print(f'  ⚠ data em formato desconhecido, mantida como está: {d!r}')
    return d


def load_json(name, default):
    p = DATA / name
    if not p.exists():
        print(f'  (sem {name}, a saltar)')
        return default
    return json.loads(p.read_text('utf-8'))


def main():
    force = '--force' in sys.argv

    if DB_PATH.exists() and not force:
        print(f'❌ {DB_PATH} já existe. Corre com --force para sobrepor.')
        sys.exit(1)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_PATH.read_text('utf-8'))
    cur = conn.cursor()

    # ── positions ────────────────────────────────────────────────────────
    positions = load_json('positions.json', [])
    for p in positions:
        if p.get('type') == 'juros':
            print(f'  ⏭  posição "{p.get("name")}" é do tipo juros — ignorada (funcionalidade removida)')
            continue
        cur.execute('''
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
    print(f'✔ positions: {len(positions)} lidas')

    # ── transactions ─────────────────────────────────────────────────────
    tx = load_json('transactions.json', {'transactions': {}}).get('transactions', {})
    n = 0
    for b in tx.get('buy', []):
        cur.execute('''
            INSERT INTO transactions (kind, isin, ticker, instrument, date, volume,
                unit_price, total, commission, broker)
            VALUES ('buy',?,?,?,?,?,?,?,?,?)
        ''', (
            b.get('isin'), b.get('ticker'), b.get('instrument'),
            normalize_date(b.get('dataCompra')), b.get('volume'), b.get('valorCompra'),
            b.get('valorTotal'), b.get('comissao'), b.get('broker'),
        ))
        n += 1
    for s in tx.get('sell', []):
        cur.execute('''
            INSERT INTO transactions (kind, isin, ticker, instrument, date, volume,
                unit_price, total, commission, cost_basis, profit, broker)
            VALUES ('sell',?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            s.get('isin'), s.get('ticker'), s.get('instrument'),
            normalize_date(s.get('dataVenda')), s.get('volume'), s.get('valorVenda'),
            s.get('valorTotal'), s.get('comissao'), s.get('custoBase'), s.get('lucro'),
            s.get('broker'),
        ))
        n += 1
    for d in tx.get('dividends', []):
        cur.execute('''
            INSERT INTO transactions (kind, isin, ticker, instrument, date, total,
                dividend_gross, tax_withheld, broker)
            VALUES ('dividend',?,?,?,?,?,?,?,?)
        ''', (
            d.get('isin'), d.get('ticker'), d.get('instrument'),
            normalize_date(d.get('dataDividendo')), d.get('dividendo'),
            d.get('dividendoBruto'), d.get('impostoRetido'), d.get('broker'),
        ))
        n += 1
    print(f'✔ transactions: {n} lidas (buy={len(tx.get("buy",[]))}, '
          f'sell={len(tx.get("sell",[]))}, dividends={len(tx.get("dividends",[]))})')

    # ── income ───────────────────────────────────────────────────────────
    income = load_json('income.json', {})
    if income:
        month = income.get('month')
        cur.execute('INSERT INTO income_months (month, income, is_current) VALUES (?,?,1)',
                    (month, income.get('income', 0)))
        for m in income.get('mensalidades', []):
            cur.execute('''
                INSERT INTO income_items (id, month, kind, name, color, amount, since)
                VALUES (?,?,'mensalidade',?,?,?,?)
            ''', (m.get('id'), month, m.get('name'), m.get('color'), m.get('amount'), m.get('since')))
        for c in income.get('categories', []):
            cur.execute('''
                INSERT INTO income_items (id, month, kind, name, color, amount)
                VALUES (?,?,'category',?,?,?)
            ''', (c.get('id'), month, c.get('name'), c.get('color'), c.get('amount')))
        print(f'✔ income: mês corrente {month} migrado')

    # ── reports/ (meses arquivados) ─────────────────────────────────────
    reports_dir = DATA / 'reports'
    if reports_dir.exists():
        rn = 0
        for rp in sorted(reports_dir.glob('*.json')):
            rmonth = rp.stem
            rdata = json.loads(rp.read_text('utf-8'))
            cur.execute('INSERT OR IGNORE INTO income_months (month, income) VALUES (?,?)',
                        (rmonth, rdata.get('income', 0)))
            for m in rdata.get('mensalidades', []):
                cur.execute('''
                    INSERT INTO income_items (id, month, kind, name, color, amount, since)
                    VALUES (?,?,'mensalidade',?,?,?,?)
                ''', (f'{rmonth}-{m.get("id")}', rmonth, m.get('name'), m.get('color'),
                      m.get('amount'), m.get('since')))
            for c in rdata.get('categories', []):
                cur.execute('''
                    INSERT INTO income_items (id, month, kind, name, color, amount)
                    VALUES (?,?,'category',?,?,?)
                ''', (f'{rmonth}-{c.get("id")}', rmonth, c.get('name'), c.get('color'), c.get('amount')))
            rn += 1
        print(f'✔ income reports arquivados: {rn} meses')

    # ── plans ────────────────────────────────────────────────────────────
    plans = load_json('plans.json', [])
    for p in plans:
        cur.execute('INSERT INTO plans (id, name, amount, frequency, created_at) VALUES (?,?,?,?,?)',
                    (p.get('id'), p.get('name'), p.get('amount'), p.get('frequency'), p.get('createdAt')))
        for a in p.get('assets', []):
            cur.execute('''
                INSERT INTO plan_assets (plan_id, position_isin, ticker, name, bg, allocation)
                VALUES (?,?,?,?,?,?)
            ''', (p.get('id'), a.get('positionIsin'), a.get('ticker'), a.get('name'),
                  a.get('bg'), a.get('allocation')))
    print(f'✔ plans: {len(plans)} lidos')

    # ── watchlists ───────────────────────────────────────────────────────
    watchlists = load_json('watchlist.json', [])
    for i, lst in enumerate(watchlists):
        cur.execute('INSERT INTO watchlists (id, name, position) VALUES (?,?,?)',
                    (lst.get('id'), lst.get('name'), i))
        for j, it in enumerate(lst.get('items', [])):
            cur.execute('''
                INSERT INTO watchlist_items (list_id, position, name, ticker, bg, price_currency, yf_symbol)
                VALUES (?,?,?,?,?,?,?)
            ''', (lst.get('id'), j, it.get('name'), it.get('ticker'), it.get('bg'),
                  it.get('priceCurrency'), it.get('yfSymbol')))
    print(f'✔ watchlists: {len(watchlists)} listas lidas')

    # ── analysis ─────────────────────────────────────────────────────────
    analysis = load_json('analysis.json', [])
    for a in analysis:
        cur.execute('''
            INSERT INTO analysis_stocks (id, ticker, name, price, eps, eps_next_y,
                sales_per_share, dividend_yield, manual_growth, roe, profit_margin,
                oper_margin, gross_margin, source_currency, fx_rate, fx_warning,
                created_at, last_fetched_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            a.get('id'), a.get('ticker'), a.get('name'), a.get('price'), a.get('eps'),
            a.get('epsNextY'), a.get('salesPerShare'), a.get('dividendYield'),
            a.get('manualGrowth'), a.get('roe'), a.get('profitMargin'), a.get('operMargin'),
            a.get('grossMargin'), a.get('sourceCurrency'), a.get('fxRate'), a.get('fxWarning'),
            a.get('createdAt'), a.get('lastFetchedAt'),
        ))
        for h in a.get('history', []):
            cur.execute('INSERT INTO analysis_history (stock_id, year, eps, sales_per_share) VALUES (?,?,?,?)',
                        (a.get('id'), h.get('year'), h.get('eps'), h.get('salesPerShare')))
    print(f'✔ analysis: {len(analysis)} ações lidas')

    # ── history (snapshots diários) ─────────────────────────────────────
    history = load_json('history.json', [])
    for snap in history:
        date = snap.get('date')
        cur.execute('INSERT OR IGNORE INTO history_snapshots (date) VALUES (?)', (date,))
        prices = snap.get('prices', {})
        for pmeta in snap.get('positions', []):
            isin = pmeta.get('isin')
            cur.execute('''
                INSERT OR REPLACE INTO history_prices (date, isin, price, units, avg_buy_price, type, invested_amount)
                VALUES (?,?,?,?,?,?,?)
            ''', (date, isin, prices.get(isin), pmeta.get('units'), pmeta.get('avgBuyPrice'),
                  pmeta.get('type'), pmeta.get('investedAmount')))
    print(f'✔ history: {len(history)} snapshots diários lidos')

    # ── config ───────────────────────────────────────────────────────────
    config = load_json('config.json', {})
    for key, value in config.items():
        cur.execute('INSERT INTO config (key, value) VALUES (?,?)', (key, json.dumps(value)))
    print(f'✔ config: {len(config)} secções lidas')

    conn.commit()
    conn.close()
    print(f'\n✅ Migração concluída → {DB_PATH}')


if __name__ == '__main__':
    main()
