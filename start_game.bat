@echo off
chcp 65001 > nul
title Qor Jangi (Snow Clash Online)
echo ====================================================
echo   QOR JANGI - YANGI YIL SHUKUHI ONLINE
echo ====================================================
echo.
echo Server ishga tushirilmoqda...
start http://localhost:8000
python server.py
pause