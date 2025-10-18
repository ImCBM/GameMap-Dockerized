@echo off
REM Docker Quick Setup Script for Procedural Level Generator (Windows)
REM This script provides easy commands to manage Docker containers

setlocal enabledelayedexpansion

REM Function to check if Docker is running
call :check_docker
if %ERRORLEVEL% neq 0 exit /b 1

REM Main script logic
if "%~1"=="" goto :help
if "%~1"=="prod" goto :run_production
if "%~1"=="production" goto :run_production
if "%~1"=="dev" goto :run_development
if "%~1"=="development" goto :run_development
if "%~1"=="compose" goto :compose_up
if "%~1"=="compose-dev" goto :compose_dev
if "%~1"=="logs" goto :show_logs
if "%~1"=="status" goto :status
if "%~1"=="stop" goto :stop_all
if "%~1"=="cleanup" goto :full_cleanup
if "%~1"=="help" goto :help
if "%~1"=="--help" goto :help
if "%~1"=="-h" goto :help

echo [ERROR] Unknown command: %~1
goto :help

:check_docker
echo [INFO] Checking Docker status...
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    exit /b 1
)
exit /b 0

:cleanup
echo [INFO] Cleaning up existing containers...
docker stop procgen-app procgen-dev 2>nul
docker rm procgen-app procgen-dev 2>nul
exit /b 0

:build_production
echo [INFO] Building production image...
docker build -t procgen-phaser:latest .
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Production image built successfully!
) else (
    echo [ERROR] Failed to build production image!
    exit /b 1
)
exit /b 0

:build_development
echo [INFO] Building development image...
docker build -f Dockerfile.dev -t procgen-phaser:dev .
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Development image built successfully!
) else (
    echo [ERROR] Failed to build development image!
    exit /b 1
)
exit /b 0

:run_production
call :cleanup
call :build_production
if %ERRORLEVEL% neq 0 exit /b 1
echo [INFO] Starting production container...
docker run -d --name procgen-app -p 8080:80 --restart unless-stopped procgen-phaser:latest
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Production container started! Visit: http://localhost:8080
) else (
    echo [ERROR] Failed to start production container!
    exit /b 1
)
exit /b 0

:run_development
call :cleanup
call :build_development
if %ERRORLEVEL% neq 0 exit /b 1
echo [INFO] Starting development container with hot reload...
docker run -d --name procgen-dev -p 3011:3011 -v "%cd%:/app" -v /app/node_modules procgen-phaser:dev
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Development container started! Visit: http://localhost:3011
) else (
    echo [ERROR] Failed to start development container!
    exit /b 1
)
exit /b 0

:compose_up
echo [INFO] Starting services with Docker Compose...
docker-compose up --build -d
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Services started! Visit: http://localhost:8080
) else (
    echo [ERROR] Failed to start services with Docker Compose!
    exit /b 1
)
exit /b 0

:compose_dev
echo [INFO] Starting development services with Docker Compose...
docker-compose --profile dev up --build -d
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Development services started! Visit: http://localhost:3011
) else (
    echo [ERROR] Failed to start development services!
    exit /b 1
)
exit /b 0

:show_logs
set container_name=%~2
if "%container_name%"=="" set container_name=procgen-app
echo [INFO] Showing logs for %container_name%...
docker logs -f %container_name%
exit /b 0

:stop_all
echo [INFO] Stopping all containers...
docker-compose down 2>nul
call :cleanup
echo [SUCCESS] All containers stopped!
exit /b 0

:status
echo [INFO] Container status:
echo.
docker ps -a --filter "name=procgen" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>nul
echo.

docker ps --filter "name=procgen-app" --format "{{.Names}}" 2>nul | find "procgen-app" >nul
if %ERRORLEVEL% equ 0 echo [SUCCESS] Production app is running: http://localhost:8080

docker ps --filter "name=procgen-dev" --format "{{.Names}}" 2>nul | find "procgen-dev" >nul
if %ERRORLEVEL% equ 0 echo [SUCCESS] Development app is running: http://localhost:3011
exit /b 0

:full_cleanup
echo [WARNING] This will remove all containers and images. Continue? (y/N)
set /p response=
if /i "!response!"=="y" (
    call :stop_all
    docker rmi procgen-phaser:latest procgen-phaser:dev 2>nul
    docker system prune -f
    echo [SUCCESS] Full cleanup completed!
) else (
    echo [INFO] Cleanup cancelled.
)
exit /b 0

:help
echo Docker Management Script for Procedural Level Generator
echo.
echo Usage: %~nx0 [command]
echo.
echo Commands:
echo   prod          Build and run production container (port 8080)
echo   dev           Build and run development container with hot reload (port 3011)
echo   compose       Use Docker Compose for production
echo   compose-dev   Use Docker Compose for development
echo   logs [name]   Show logs for container (default: procgen-app)
echo   status        Show container status
echo   stop          Stop all containers
echo   cleanup       Remove all containers and images
echo   help          Show this help message
echo.
echo Examples:
echo   %~nx0 prod                    # Start production version
echo   %~nx0 dev                     # Start development version
echo   %~nx0 logs procgen-dev        # Show dev container logs
echo   %~nx0 status                  # Check what's running
exit /b 0