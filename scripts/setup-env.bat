@echo off
REM =============================================================================
REM Bharat Agents - Environment Setup Script (Windows)
REM =============================================================================
REM 
REM This script helps developers set up their environment configuration files.
REM It copies example files and provides guidance for configuration.
REM =============================================================================

setlocal enabledelayedexpansion

REM Colors for output (Windows 10+)
set "BLUE=[94m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "NC=[0m"

REM Function to print colored output
:print_status
echo %BLUE%[INFO]%NC% %~1
goto :eof

:print_success
echo %GREEN%[SUCCESS]%NC% %~1
goto :eof

:print_warning
echo %YELLOW%[WARNING]%NC% %~1
goto :eof

:print_error
echo %RED%[ERROR]%NC% %~1
goto :eof

REM Function to check if file exists
:file_exists
if exist "%~1" (
    exit /b 0
) else (
    exit /b 1
)

REM Function to backup existing file
:backup_file
set "file=%~1"
call :file_exists "!file!"
if %errorlevel% equ 0 (
    set "backup=!file!.backup.%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
    set "backup=!backup: =0!"
    copy "!file!" "!backup!" >nul
    call :print_warning "Backed up existing !file! to !backup!"
)
goto :eof

REM Function to copy example file
:copy_example
set "example=%~1"
set "target=%~2"

call :file_exists "!example!"
if %errorlevel% equ 0 (
    call :backup_file "!target!"
    copy "!example!" "!target!" >nul
    call :print_success "Created !target! from !example!"
) else (
    call :print_error "Example file !example! not found"
    exit /b 1
)
goto :eof

REM Main setup function
:main
call :print_status "Setting up Bharat Agents environment configuration..."

REM Check if we're in the right directory
if not exist "package.json" (
    call :print_error "Please run this script from the project root directory"
    exit /b 1
)

REM Create .env files from examples
call :print_status "Creating environment configuration files..."

REM Root level
call :copy_example "env.example" ".env"
if %errorlevel% equ 0 (
    call :print_warning "Please update .env with your actual values"
)

REM Tasks service
if exist "apps\tasks" (
    call :copy_example "apps\tasks\env.example" "apps\tasks\.env.development.local"
    if %errorlevel% equ 0 (
        call :print_warning "Please update apps\tasks\.env.development.local with your actual values"
    )
)

REM Browser service
if exist "apps\browser" (
    call :copy_example "apps\browser\env.example" "apps\browser\.env.development.local"
    if %errorlevel% equ 0 (
        call :print_warning "Please update apps\browser\.env.development.local with your actual values"
    )
)

REM Deployment
if exist "infra\deployment" (
    call :copy_example "infra\deployment\env.example" "infra\deployment\.env"
    if %errorlevel% equ 0 (
        call :print_warning "Please update infra\deployment\.env with your actual values"
    )
)

call :print_success "Environment setup complete!"

REM Provide next steps
echo.
call :print_status "Next steps:"
echo 1. Update the .env files with your actual values
echo 2. Start the infrastructure: cd infra\deployment ^&^& make up
echo 3. Start the services: pnpm dev
echo.
call :print_status "Infrastructure management:"
echo   make up          # Start all services
echo   make down        # Stop all services
echo   make logs        # Show service logs
echo   make nuke        # Stop services and remove volumes
echo   make status      # Show service status
echo.
call :print_status "For production, consider using secret management tools:"
echo - Doppler (recommended): https://docs.doppler.com/
echo - 1Password CLI: https://developer.1password.com/docs/cli/
echo - AWS SSM Parameter Store: https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html
echo.
call :print_status "See docs\SECRET_MANAGEMENT.md for detailed instructions"

goto :eof

REM Run main function
call :main
pause
