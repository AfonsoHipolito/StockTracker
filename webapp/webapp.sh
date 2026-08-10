#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "venv/bin/activate" ]; then
    echo "Ambiente virtual não encontrado. A correr setup.sh primeiro..."
    ./setup.sh
fi

source venv/bin/activate
python3 server.py
