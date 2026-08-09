@echo off
title Build KhataBook Pro
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo Install Node.js from https://nodejs.org then run this file again.
    pause
    exit /b 1
)

echo Stopping any running Electron...
taskkill /IM electron.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo Building portable desktop app...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call node node_modules\electron-builder\cli.js --win dir
if errorlevel 1 (
    echo Build failed. You can still use "Start KhataBook Pro.bat"
    pause
    exit /b 1
)

echo.
echo Done. Open: dist\win-unpacked\
echo Run the .exe there, or use "Install KhataBook Pro.bat"
pause
