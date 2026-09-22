@echo off
title Push pe GitHub - SOJava (Serghei-Stefan)
echo ================================================================
echo   Trimitere cod Laborator 1 pe GitHub:
echo   https://github.com/MDSWAT/SOJava/tree/Serghei-Stefan
echo ================================================================
echo.
"C:\Program Files\Git\cmd\git.exe" push origin Serghei-Stefan
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCES] Codul a fost incarcat cu succes pe GitHub!
) else (
    echo [EROARE / ATENTIE] Daca iti cere autentificare, urmeaza pasii din fereastra / browser.
)
echo.
pause
