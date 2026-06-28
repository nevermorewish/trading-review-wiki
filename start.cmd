@echo off
chcp 65001 >nul
title 寰星Agent
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
