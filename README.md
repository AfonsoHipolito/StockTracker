# StockTracker

Aplicação pessoal de gestão de portfólio de investimentos, watchlist, transações e
orçamento mensal — corre localmente, sem dependências externas além do Python.

## Estrutura

Backend em Python puro (`http.server`, sem frameworks) + frontend em HTML/JS/CSS
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
