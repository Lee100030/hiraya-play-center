@echo off
cd /d "%~dp0"
echo Starting HIRAYA website on http://localhost:3000
echo Keep this window open. Press Ctrl+C to stop.
echo.
call npm --prefix apps/web run dev
pause
