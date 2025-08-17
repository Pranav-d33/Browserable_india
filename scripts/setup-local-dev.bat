@echo off
REM =============================================================================
REM Local Development Setup Script for Bharat Agents (Windows)
REM =============================================================================

echo 🚀 Setting up Bharat Agents for local development...

REM Check if we're in the right directory
if not exist "package.json" (
    echo [ERROR] Please run this script from the root directory of the project
    exit /b 1
)

if not exist "pnpm-workspace.yaml" (
    echo [ERROR] Please run this script from the root directory of the project
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1,2,3 delims=." %%a in ('node --version') do (
    set NODE_VERSION=%%a
    set NODE_VERSION=!NODE_VERSION:~1!
)

if !NODE_VERSION! LSS 20 (
    echo [ERROR] Node.js 20+ is required. Current version: 
    node --version
    echo [ERROR] Please install Node.js 20+ from https://nodejs.org/
    exit /b 1
)

echo [SUCCESS] Node.js version: 
node --version

REM Check pnpm
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pnpm is not installed. Please install it with: npm install -g pnpm
    exit /b 1
)

echo [SUCCESS] pnpm version: 
pnpm --version

REM Install dependencies
echo [INFO] Installing dependencies...
pnpm install

REM Build the project
echo [INFO] Building the project...
pnpm -w build

REM Setup environment files
echo [INFO] Setting up environment files...

REM Copy environment example for tasks app
if not exist "apps\tasks\.env.local" (
    copy "apps\tasks\env.local.example" "apps\tasks\.env.local" >nul
    echo [SUCCESS] Created apps\tasks\.env.local
    echo [WARNING] Please update GEMINI_API_KEY in apps\tasks\.env.local
) else (
    echo [INFO] apps\tasks\.env.local already exists
)

REM Copy environment example for browser app
if not exist "apps\browser\.env.local" (
    copy "apps\browser\env.example" "apps\browser\.env.local" >nul
    echo [SUCCESS] Created apps\browser\.env.local
) else (
    echo [INFO] apps\browser\.env.local already exists
)

REM Install Playwright browsers
echo [INFO] Installing Playwright browsers...
npx playwright install

REM Create uploads directory
echo [INFO] Creating uploads directory...
if not exist "uploads" mkdir uploads
if not exist "uploads\public" mkdir uploads\public
if not exist "uploads\private" mkdir uploads\private

REM Check if Gemini API key is set
if exist "apps\tasks\.env.local" (
    findstr "your_gemini_api_key_here" "apps\tasks\.env.local" >nul
    if not errorlevel 1 (
        echo [WARNING] ⚠️  Please update GEMINI_API_KEY in apps\tasks\.env.local
        echo [INFO] Get a free API key from: https://makersuite.google.com/app/apikey
    ) else (
        echo [SUCCESS] Gemini API key appears to be configured
    )
)

REM Display next steps
echo.
echo [SUCCESS] 🎉 Setup completed successfully!
echo.
echo Next steps:
echo 1. Update GEMINI_API_KEY in apps\tasks\.env.local
echo 2. Start the tasks service: pnpm --filter @bharat-agents/tasks dev
echo 3. Start the browser service: pnpm --filter @bharat-agents/browser dev
echo.
echo API endpoints will be available at:
echo - Tasks API: http://localhost:3001
echo - Browser API: http://localhost:3002
echo.
echo For more information, see the README.md file

pause
