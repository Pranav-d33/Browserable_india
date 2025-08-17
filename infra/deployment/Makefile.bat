@echo off
REM =============================================================================
REM Bharat Agents - Development Infrastructure (Windows Batch)
REM =============================================================================
REM 
REM This batch file provides convenient commands for managing the development
REM infrastructure using Docker Compose on Windows.
REM =============================================================================

setlocal enabledelayedexpansion

REM Configuration
set "COMPOSE_FILE=docker-compose.dev.yml"
set "PROJECT_NAME=bharat-agents"

REM Colors for output (Windows 10+)
set "BLUE=[94m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "NC=[0m"

REM Default action
if "%1"=="" goto help

REM Command routing
if "%1"=="up" goto up
if "%1"=="down" goto down
if "%1"=="logs" goto logs
if "%1"=="nuke" goto nuke
if "%1"=="restart" goto restart
if "%1"=="status" goto status
if "%1"=="help" goto help
if "%1"=="start" goto up
if "%1"=="stop" goto down
if "%1"=="ps" goto status

echo %RED%Unknown command: %1%NC%
echo.
goto help

:help
echo %BLUE%Bharat Agents - Development Infrastructure%NC%
echo.
echo %YELLOW%Available commands:%NC%
echo   up          - Start all services
echo   down        - Stop all services
echo   logs        - Show service logs
echo   nuke        - Stop services and remove volumes
echo   restart     - Restart all services
echo   status      - Show service status
echo   help        - Show this help message
echo.
echo %YELLOW%Usage:%NC%
echo   %COMPOSE_FILE% up          # Start all services
echo   %COMPOSE_FILE% down        # Stop all services
echo   %COMPOSE_FILE% logs        # Show service logs
echo   %COMPOSE_FILE% nuke        # Stop services and remove volumes
echo.
goto end

:up
echo %BLUE%Starting Bharat Agents development infrastructure...%NC%
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% up -d
if %errorlevel% neq 0 (
    echo %RED%Failed to start services!%NC%
    goto end
)
echo %GREEN%✅ Services started successfully!%NC%
echo.
echo %YELLOW%Service URLs:%NC%
echo   PostgreSQL: localhost:5432
echo   Redis:      localhost:6379
echo   MinIO:      localhost:9000
echo   MinIO UI:   localhost:9001
echo   MailHog:    localhost:8025
echo.
echo %YELLOW%Default credentials:%NC%
echo   PostgreSQL: bharat_user/bharat_password
echo   MinIO:      minioadmin/minioadmin
goto end

:down
echo %BLUE%Stopping Bharat Agents development infrastructure...%NC%
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% down
if %errorlevel% neq 0 (
    echo %RED%Failed to stop services!%NC%
    goto end
)
echo %GREEN%✅ Services stopped successfully!%NC%
goto end

:restart
echo %BLUE%Restarting Bharat Agents development infrastructure...%NC%
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% restart
if %errorlevel% neq 0 (
    echo %RED%Failed to restart services!%NC%
    goto end
)
echo %GREEN%✅ Services restarted successfully!%NC%
goto end

:logs
if "%2"=="" (
    echo %BLUE%Showing logs for all services...%NC%
    docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% logs -f
) else (
    echo %BLUE%Showing logs for %2...%NC%
    docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% logs -f %2
)
goto end

:status
echo %BLUE%Service Status:%NC%
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% ps
goto end

:nuke
echo %RED%⚠️  WARNING: This will remove all data!%NC%
echo %RED%This action cannot be undone.%NC%
set /p confirm="Are you sure you want to continue? (y/N): "
if /i not "%confirm%"=="y" goto end

echo %BLUE%Stopping services and removing volumes...%NC%
docker-compose -f %COMPOSE_FILE% -p %PROJECT_NAME% down -v
docker volume rm bharat-agents-pgdata bharat-agents-redis-data bharat-agents-minio-data 2>nul
echo %GREEN%✅ All data removed successfully!%NC%
goto end

:end
endlocal
