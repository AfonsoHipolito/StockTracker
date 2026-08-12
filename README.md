# StockTracker

Personal app for portfolio management, transactions, investment research, and
monthly budgeting.

## Structure

Backend in Python (`http.server`, no frameworks) + frontend in vanilla
HTML/JS/CSS, all under `webapp/`.

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

**Linux / macOS:**

```sh
cd webapp
./setup.sh   # creates the venv and installs dependencies
./webapp.sh  # starts the server at http://localhost:8080 (creates an empty DB)
```

**Windows:**

```bat
cd webapp
setup.bat
webapp.bat
```

If `setup.bat` can't find Python on your PATH, install it from
[python.org/downloads](https://www.python.org/downloads/) and make sure to
check "Add python.exe to PATH" in the installer.

## Data

All information (positions, transactions, income, watchlist, plans, history,
and analysis) lives in a local SQLite database, `webapp/db/stocktracker.db`
— **git-ignored** (`.gitignore`), never to be published. It's created
automatically, empty, on the server's first run (`server.py`). See
`webapp/db/examples/` for sample files showing the format expected by each
endpoint.

## Requirements

- Python 3.10+
