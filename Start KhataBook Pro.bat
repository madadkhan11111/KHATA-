@echo off
title KhataBook Pro
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
    echo.
    echo  KhataBook Pro - First time setup
    echo  =================================
    echo  Node.js is required. Install from https://nodejs.org
    echo  Then open Command Prompt here and run:  npm install
    echo.
    pause
    exit /b 1
)

start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
