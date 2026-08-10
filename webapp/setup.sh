#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=== Stock Tracker Webapp Setup ==="

if ! command -v python3 &>/dev/null; then
    echo "A instalar python3..."
    sudo apt update && sudo apt install -y python3 python3-venv
else
    echo "Python: $(python3 --version)"
fi

sudo apt install -y python3-venv

if [ ! -f "venv/bin/activate" ]; then
    echo ""
    echo "A criar ambiente virtual..."
    rm -rf venv
    python3 -m venv venv
fi

echo ""
echo "A instalar dependências Python..."
source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt

echo ""
echo "Setup concluído! A base de dados (webapp/db/stocktracker.db) é criada"
echo "automaticamente, vazia, no primeiro arranque. Corre: ./webapp.sh"
