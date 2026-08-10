# StockTracker

Personal app for investment portfolio management, watchlist, transactions and
monthly budgeting — runs locally, no external dependencies beyond Python.

## Structure

Pure Python backend (`http.server`, no frameworks) + vanilla HTML/JS/CSS
frontend, all under `webapp/`.

## Features

- **Portfolio** — positions by asset type (ETFs, stocks, crypto, real estate...),
  real-time prices via [yfinance](https://pypi.org/project/yfinance/), allocation chart.
- **Watchlist** — lists of assets to track.
- **Transactions** — record of buys, sells, and dividends.
- **Performance** — portfolio evolution over time.
- **Income** — monthly budget by category and fixed bills, with month-by-month
  history and automatic calculation of the amount invested (from recorded
  transactions).

## Getting started

```sh
cd webapp
./setup.sh   # creates the venv and installs dependencies
./webapp.sh  # starts the server at http://localhost:8080 (creates an empty DB)
```

## Data

All information (positions, transactions, income, watchlist, plans, history,
and analysis) lives in a local SQLite database,
`webapp/db/stocktracker.db` — **git-ignored** (`.gitignore`), never to be
published. It's created automatically, empty, on the server's first run
(`server.py`). See `webapp/db/examples/` for sample files showing the format
expected by each endpoint.

## Requirements

- Python 3.10+



=== === === === === === === === === === === === === ===


# StockTracker

App pessoal para gestão de portfólio, transações, e estudo de investimentos, e
orçamento mensal.

## Estrutura

Backend em Python (`http.server`, sem frameworks) + frontend em HTML/JS/CSS
vanilla, tudo em `webapp/`.

## Funcionalidades

- **Carteira** — posições por ativo (ETFs, ações, cripto, imobiliário...), preços em
  tempo real via [yfinance](https://pypi.org/project/yfinance/), gráfico de alocação.
- **Watchlist** — listas de ativos a acompanhar.
- **Transações** — registo de compras, vendas e dividendos.
- **Desempenho** — evolução da carteira ao longo do tempo.
- **Rendimento** — orçamento mensal por categorias e mensalidades fixas, com
  histórico mês a mês e cálculo automático do valor investido (a partir das
  transações registadas).

## Arrancar

```sh
cd webapp
./setup.sh   # cria o venv e instala dependências
./webapp.sh  # arranca o servidor em http://localhost:8080 (cria a BD vazia)
```

## Dados

Toda a informação (posições, transações, rendimento, watchlist, planos,
histórico e análises) fica numa base de dados SQLite local,
`webapp/db/stocktracker.db` — **ignorada pelo git** (`.gitignore`), nunca
deve ser publicada. É criada automaticamente, vazia, no primeiro arranque do
servidor (`server.py`). Em `webapp/db/examples/` há ficheiros de exemplo com
dados fictícios que mostram o formato esperado por cada endpoint.

## Requisitos

- Python 3.10+
