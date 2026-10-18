@echo off
cd /d D:\301_Apps\GrowRep\analytics
echo [GrowRep] publish 開始: %date% %time%
call npm run publish
set RC=%ERRORLEVEL%
echo [GrowRep] publish 終了: %date% %time% / ExitCode=%RC%
exit /b %RC%
