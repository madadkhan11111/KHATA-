@echo off
title Install KhataBook Pro
cd /d "%~dp0"

set APP_EXE=%~dp0dist\win-unpacked\KhataBook Pro.exe
if not exist "%APP_EXE%" (
    set APP_EXE=%~dp0dist\win-unpacked\khata-book-pro.exe
)

if exist "%APP_EXE%" (
    echo Opening installer folder...
    explorer /select,"%APP_EXE%"
    echo.
    echo Double-click the .exe above to run KhataBook Pro.
    echo To install on all users, run the Setup file in dist\ if present.
    pause
    exit /b 0
)

echo.
echo  Portable app not built yet.
echo  Run "Build Desktop App.bat" first, or use "Start KhataBook Pro.bat" to run without installing.
echo.
pause
