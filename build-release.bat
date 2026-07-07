@echo off
setlocal enabledelayedexpansion
echo ============================================
echo   FlowCanva Release Build
echo ============================================
echo.

set ROOT=%~dp0
set RELEASE_DIR=%ROOT%release\flowcanva

echo [1/6] Checking Node.js ...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install: https://nodejs.org
    pause
    exit /b 1
)
echo Node.js OK

echo [2/6] Installing frontend dependencies ...
cd /d "%ROOT%frontend-admin"
call npm install
if %errorlevel% neq 0 ( echo [ERROR] frontend-admin install failed && pause && exit /b 1 )
cd /d "%ROOT%frontend-canvas"
call npm install
if %errorlevel% neq 0 ( echo [ERROR] frontend-canvas install failed && pause && exit /b 1 )

echo [3/6] Building frontend ...
cd /d "%ROOT%frontend-admin"
call npm run build
if %errorlevel% neq 0 ( echo [ERROR] frontend-admin build failed && pause && exit /b 1 )
cd /d "%ROOT%frontend-canvas"
call npm run build
if %errorlevel% neq 0 ( echo [ERROR] frontend-canvas build failed && pause && exit /b 1 )

echo [4/6] Copying dist to embed dirs ...
if exist "%ROOT%backend\admin-dist" rd /s /q "%ROOT%backend\admin-dist"
if exist "%ROOT%backend\canvas-dist" rd /s /q "%ROOT%backend\canvas-dist"
xcopy /e /i /q "%ROOT%frontend-admin\dist" "%ROOT%backend\admin-dist" >nul
xcopy /e /i /q "%ROOT%frontend-canvas\dist" "%ROOT%backend\canvas-dist" >nul
echo OK

echo [5/6] Compiling backend (Go 1.23+) ...
where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Go not found. Install: https://go.dev/dl/
    pause
    exit /b 1
)
cd /d "%ROOT%backend"
go build -ldflags "-s -w" -o "%RELEASE_DIR%\flowcanva.exe" .
if %errorlevel% neq 0 ( echo [ERROR] Go build failed && pause && exit /b 1 )

echo [6/7] Packaging release files ...
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"
copy "%ROOT%README.md" "%RELEASE_DIR%\README.md" >nul
copy "%ROOT%LICENSE.md" "%RELEASE_DIR%\LICENSE.md" >nul

echo [7/7] Zipping release ...
powershell -NoProfile -Command "Compress-Archive -Path '%RELEASE_DIR%\*' -DestinationPath '%ROOT%release\flowcanva.zip' -Force"

echo.
echo ============================================
echo   BUILD SUCCESS
echo   Output: release\flowcanva\
echo   Zip:    release\flowcanva.zip
echo.
echo   Double-click flowcanva.exe to start
echo   No Go / Node.js required
echo ============================================
echo.
endlocal
