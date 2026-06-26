@echo off
chcp 65001 >nul
title RELO - Subir para o GitHub (ReloPip)
cd /d "%~dp0"

echo ============================================================
echo   RELO -> github.com/LuanVFrezarin/ReloPip
echo ============================================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [!] O Git nao esta instalado. Instale com:
  echo        winget install Git.Git
  echo     Depois feche e abra este arquivo de novo.
  pause
  exit /b 1
)

if not exist ".git" (
  git init
  git branch -M main
)

git add -A
git commit -m "RELO - site de pre-lancamento" || echo (nada novo para commitar)

git remote remove origin 2>nul
git remote add origin https://github.com/LuanVFrezarin/ReloPip.git

echo.
echo Enviando... (pode pedir login do GitHub na primeira vez)
git push -u origin main

if errorlevel 1 (
  echo.
  echo [!] Se deu erro de "rejected" porque o repo ja tem conteudo,
  echo     rode manualmente: git push -u origin main --force
  echo.
)

echo.
echo Pronto. Confira em: https://github.com/LuanVFrezarin/ReloPip
pause
