@echo off
rem Launch Mise: build (picks up any recipe updates), serve, open browser.
rem Once installed as a PWA from the browser, the installed app also works
rem offline -- run this again whenever recipes change to refresh it.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run build
start "" http://localhost:4173/
call npm run preview
