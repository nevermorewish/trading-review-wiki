@echo off
setlocal
cd /d "%~dp0"
set "PROTOC=%CD%\.protoc\bin\protoc.exe"
set "PROTOC_INCLUDE=%CD%\.protoc\include"
npm run tauri -- dev
