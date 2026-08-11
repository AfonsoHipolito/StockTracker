@echo off
setlocal

cd /d "%~dp0"

if not exist "venv\Scripts\activate.bat" (
    echo Ambiente virtual nao encontrado. A correr setup.bat primeiro...
    call setup.bat
)

call venv\Scripts\activate.bat
python server.py

endlocal
