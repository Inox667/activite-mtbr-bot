@echo off
REM Lance le bot MTBR. Garde cette fenetre ouverte tant que tu veux qu'il tourne.
REM Pour l'arreter proprement : Ctrl+C dans cette fenetre.
cd /d "%~dp0"
echo Demarrage du bot MTBR...
node src\index.js
echo.
echo Le bot s'est arrete. Ferme cette fenetre ou relance start.bat.
pause
