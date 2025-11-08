@echo off
REM Game Server Auto-Scaling Cluster Management Script (Windows)

setlocal enabledelayedexpansion

REM ASCII Art Header
:show_header
echo.
echo    ╔═══════════════════════════════════════════════╗
echo    ║           🎮 PLAYER-DEDICATED SERVERS         ║
echo    ║         Auto-Scaling Management Console       ║
echo    ╚═══════════════════════════════════════════════╝
echo.
exit /b 0

REM Start the auto-scaling cluster
:start_cluster
echo [INFO] Starting Player-Dedicated Auto-Scaling Cluster...

echo [INFO] Building Docker images...
docker-compose -f docker-compose.cluster.yml build

echo [INFO] Starting persistent lobby server and player-dedicated load balancer...
docker-compose -f docker-compose.cluster.yml up -d

echo [SUCCESS] 🚀 Player-Dedicated Cluster started successfully!
echo.
echo 📍 Single Entry Point:
echo   🎮 MAIN GAME HUB:      http://localhost:80
echo   (Players just visit this one URL!)
echo.
echo 📊 Additional Access Points:
echo   🏠 Persistent Lobby:   http://localhost:8080 (fallback)
echo   📊 Load Balancer API:  http://localhost:8090 (admin)
echo   📈 Monitoring Dashboard: Use --profile monitoring for http://localhost:3001
echo.
echo ⚙️ How it works:
echo   1. Players visit http://localhost:80
echo   2. Click "Play Game" to get dedicated server automatically
echo   3. System creates new container and redirects player
echo   4. Server stays alive while player is active
echo   5. Auto-cleanup after 10s inactive + 30s deletion
echo   6. No complex setup needed - just one URL!
exit /b 0

REM Start with monitoring
:start_monitoring
echo [INFO] Starting cluster with player monitoring dashboard...
docker-compose -f docker-compose.cluster.yml --profile monitoring up -d --build

echo [SUCCESS] 🚀 Player-Dedicated Cluster + Monitoring started!
echo.
echo 📍 Access Points:
echo   🎮 Main Game Entry:    http://localhost:80
echo   🏠 Persistent Lobby:   http://localhost:8080
echo   📊 Player Monitor:     http://localhost:3001
echo   ⚙️ Load Balancer API:  http://localhost:8090
echo.
echo 📈 Monitoring Features:
echo   • Real-time player capacity tracking
echo   • Individual server status and player counts
echo   • Resource utilization graphs
echo   • Server creation/destruction activity
exit /b 0

REM Show status
:show_status
echo [INFO] Checking cluster status...
echo.
echo 📊 Container Status:
docker ps --filter "name=procgen" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
echo 🎯 Load Balancer Stats:
curl -s http://localhost:80/api/servers 2>nul || echo Load balancer not accessible
exit /b 0

REM Stop cluster
:stop_cluster
echo [INFO] Stopping auto-scaling cluster...

echo [INFO] Cleaning up auto-scaled servers...
for /f %%i in ('docker ps --filter "label=autoscaler.managed=true" -q') do docker stop %%i
for /f %%i in ('docker ps -a --filter "label=autoscaler.managed=true" -q') do docker rm %%i

docker-compose -f docker-compose.cluster.yml down

echo [SUCCESS] 🛑 Cluster stopped and cleaned up!
exit /b 0

REM Test auto-scaling
:test_scaling
echo [INFO] Testing auto-scaling behavior...
echo.
echo 🧪 Sending test requests to trigger scaling...

for /l %%i in (1,1,5) do (
    echo [INFO] Request %%i - Testing load balancer...
    curl -s http://localhost:80/ >nul 2>&1 || echo [WARNING] Request failed
    timeout /t 2 >nul
)

echo [INFO] Waiting for potential server creation...
timeout /t 15 >nul

echo [INFO] Checking if new servers were created...
docker ps --filter "label=autoscaler.managed=true"

echo [INFO] Waiting for inactivity timeout (10s)...
timeout /t 12 >nul

echo [INFO] Final status check...
call :show_status
exit /b 0

REM View logs
:view_logs
set service=%1
if "%service%"=="" set service=smart-loadbalancer
echo [INFO] Showing logs for %service%...
docker-compose -f docker-compose.cluster.yml logs -f %service%
exit /b 0

REM Cleanup
:cleanup_all
echo [WARNING] This will remove ALL cluster containers and networks. Continue? (y/N)
set /p response=
if /i "!response!"=="y" (
    echo [INFO] Performing complete cleanup...
    
    for /f %%i in ('docker ps -a --filter "name=procgen" -q') do docker rm -f %%i 2>nul
    for /f %%i in ('docker ps -a --filter "label=autoscaler.managed=true" -q') do docker rm -f %%i 2>nul
    
    docker network rm tsprocgentest_procgen-cluster 2>nul
    docker rmi procgen-phaser:latest 2>nul
    
    echo [SUCCESS] 🧹 Complete cleanup finished!
) else (
    echo [INFO] Cleanup cancelled.
)
exit /b 0

REM Show help
:show_help
call :show_header
echo Available Commands:
echo.
echo   🚀 start              Start the auto-scaling cluster
echo   📊 start-monitoring   Start cluster with monitoring dashboard
echo   📋 status            Show current cluster status
echo   🧪 test              Test auto-scaling behavior
echo   📝 logs [service]     View logs (default: smart-loadbalancer)
echo   🛑 stop              Stop the cluster
echo   🧹 cleanup           Remove all containers and networks
echo   📖 help              Show this help message
echo.
echo Examples:
echo   cluster-manager.bat start
echo   cluster-manager.bat start-monitoring
echo   cluster-manager.bat test
echo   cluster-manager.bat logs procgen-server-1
echo.
exit /b 0

REM Main script logic
if "%~1"=="" goto :show_help
if "%~1"=="start" goto :start_cluster
if "%~1"=="start-monitoring" goto :start_monitoring
if "%~1"=="monitor" goto :start_monitoring
if "%~1"=="status" goto :show_status
if "%~1"=="ps" goto :show_status
if "%~1"=="test" goto :test_scaling
if "%~1"=="test-scaling" goto :test_scaling
if "%~1"=="logs" goto :view_logs
if "%~1"=="log" goto :view_logs
if "%~1"=="stop" goto :stop_cluster
if "%~1"=="cleanup" goto :cleanup_all
if "%~1"=="clean" goto :cleanup_all
if "%~1"=="help" goto :show_help
if "%~1"=="--help" goto :show_help
if "%~1"=="-h" goto :show_help

echo [ERROR] Unknown command: %~1
goto :show_help