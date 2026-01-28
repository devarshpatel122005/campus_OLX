@echo off
echo ========================================
echo  CampusOLX - Starting Services
echo ========================================
echo.

echo [1/3] Checking if MongoDB is running...
mongosh --eval "db.version()" > nul 2>&1
if errorlevel 1 (
    echo [!] MongoDB is not running. Please start MongoDB first.
    echo [!] Run 'mongod' in a separate terminal or start MongoDB service.
    pause
    exit /b 1
) else (
    echo [OK] MongoDB is running
)

echo.
echo [2/3] Starting Python AI Service...
start "CampusOLX - AI Service" cmd /k "cd /d %~dp0ai_service && python app.py"

timeout /t 3 /nobreak > nul

echo.
echo [3/3] Starting Node.js Server...
start "CampusOLX - Node Server" cmd /k "cd /d %~dp0backend && npm start"

echo.
echo ========================================
echo  All services started!
echo ========================================
echo.
echo  AI Service:  http://localhost:5000
echo  Web App:     http://localhost:3000
echo.
echo Press any key to open the application in your browser...
pause > nul

start http://localhost:3000

exit
