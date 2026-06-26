@echo off
chcp 65001 >nul
title RELO - Converter Bastidores para H.264 (que toca no navegador)
cd /d "%~dp0css\mov"

echo ============================================================
echo   RELO - transcodificando bastidores para H.264 (avc1)
echo   (seus .mp4 atuais estao em HEVC/hvc1 - o Chrome nao toca)
echo ============================================================
echo.

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo [!] O ffmpeg nao esta instalado. Instale com:
  echo.
  echo         winget install Gyan.FFmpeg
  echo.
  echo     FECHE este arquivo, abra um NOVO Prompt/Terminal e rode de novo.
  echo.
  pause
  exit /b 1
)

call :conv "0625 (1).mp4"    bastidor1.mp4
call :conv "0625 (1)(1).mp4" bastidor2.mp4
call :conv "0625 (1)(2).mp4" bastidor3.mp4
call :conv "0625 (1)(3).mp4" bastidor4.mp4
call :conv "0625 (1)(4).mp4" bastidor5.mp4

echo.
echo ============================================================
echo   Pronto! Abra o site e de Ctrl+F5.
echo   Bastidores e clipes de canto vao rodar.
echo ============================================================
echo.
pause
exit /b 0

:conv
set "IN=%~1"
set "OUT=%~2"
if not exist "%IN%" (
  echo  -- "%IN%" nao encontrado, pulando.
  goto :eof
)
echo  -> %IN%  =^>  %OUT%
ffmpeg -y -i "%IN%" -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 23 -preset fast -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -an -movflags +faststart "%OUT%" >nul 2>nul
if exist "%OUT%" ( echo     OK ) else ( echo     FALHOU )
goto :eof
