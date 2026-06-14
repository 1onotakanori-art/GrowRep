@echo off
cd /d D:\301_Apps\GrowRep\analytics
echo [GrowRep] announce 開始: %date% %time%
call npm run announce
echo [GrowRep] announce 終了: %date% %time% / ExitCode=%ERRORLEVEL%
