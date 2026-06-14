@echo off
cd /d D:\301_Apps\GrowRep\analytics
echo [GrowRep] publish 開始: %date% %time%
call npm run publish
echo [GrowRep] publish 終了: %date% %time% / ExitCode=%ERRORLEVEL%
