@echo off
echo Starting Projector Manager in Electron mode...
echo.

:: Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Kill any existing processes on port 5173
echo Cleaning up any existing processes on port 5173...
netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
    echo Found existing process, terminating...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
        taskkill //F //PID %%a >nul 2>&1
    )
    timeout /t 2 >nul
)

:: Start the application
echo Starting development server and Electron app...
echo Please wait for the Electron window to appear...
call npm run electron:dev

pause