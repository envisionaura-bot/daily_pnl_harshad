@echo off
:: Always run from the directory where this script lives
cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════╗
echo ║         TradeDesk — Setup and Run        ║
echo ╚══════════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo Node.js %NODE_VER% found

:: Install dependencies if needed
if not exist "node_modules" (
    echo.
    echo Installing dependencies...
    npm install
    echo Dependencies installed
)

echo.
echo Starting TradeDesk...
echo Open your browser at: http://localhost:3000
echo Press Ctrl+C to stop
echo.

node server.js
pause
