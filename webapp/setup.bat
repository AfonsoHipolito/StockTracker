@echo off
setlocal

cd /d "%~dp0"

echo.
echo === Stock Tracker Webapp Setup ===

set "PY="
where python >nul 2>nul
if not errorlevel 1 set "PY=python"
if not defined PY (
    where py >nul 2>nul
    if not errorlevel 1 set "PY=py -3"
)

if not defined PY (
    echo Python nao encontrado no PATH.
    echo Instala o Python 3.10+ em: https://www.python.org/downloads/
    echo IMPORTANTE: marca a opcao "Add python.exe to PATH" no instalador.
    exit /b 1
)

echo Python encontrado:
%PY% --version

if not exist "venv\Scripts\activate.bat" (
    echo.
    echo A criar ambiente virtual...
    %PY% -m venv venv
)

echo.
echo A instalar dependencias Python...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt

echo.
echo Setup concluido! A base de dados (webapp\db\stocktracker.db) e criada
echo automaticamente, vazia, no primeiro arranque. Corre: webapp.bat

endlocal
