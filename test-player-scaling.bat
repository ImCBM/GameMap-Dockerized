@echo off
REM Player-Dedicated Server Test Script (Windows)
REM Tests the single entry point system

echo 🧪 Testing Single Entry Point Player-Dedicated Servers
echo ========================================================

set LOAD_BALANCER_URL=http://localhost

echo.
echo 🔍 Initial status check...
echo 📊 Current Server Status:
curl -s "%LOAD_BALANCER_URL%/api/servers"
echo.
echo 📈 Player Capacity Status:
curl -s "%LOAD_BALANCER_URL%/api/capacity"
echo.

echo 📝 Test Scenario 1: Single Entry Point Access
echo 🌐 Testing main game hub access...
curl -s "%LOAD_BALANCER_URL%/" > hub_response.html
echo ✅ Game hub response saved to hub_response.html

echo.
echo 📝 Test Scenario 2: Automatic server assignment via /game endpoint
echo 🎮 Requesting dedicated server via single entry point...
curl -s -I "%LOAD_BALANCER_URL%/game" > redirect_response.txt
echo ✅ Redirect response saved to redirect_response.txt
echo Response headers:
type redirect_response.txt
echo.

echo � Test Scenario 3: Direct API player join (for testing)
echo 👤 Testing player join API...
curl -s -X POST "%LOAD_BALANCER_URL%/api/player/join" ^
    -H "Content-Type: application/json" ^
    -d "{\"playerId\": \"test-player-single-entry\"}" > join_response.json

echo ✅ Player join response:
type join_response.json
echo.

echo ⏰ Waiting 5 seconds...
timeout /t 5 >nul

echo 📊 Checking servers after player assignment:
curl -s "%LOAD_BALANCER_URL%/api/servers"
echo.

echo 📝 Test Scenario 4: Testing auto-cleanup
echo ⏰ Waiting 15 seconds for server shutdown...
timeout /t 15 >nul

echo 📊 Checking servers after inactivity period:
curl -s "%LOAD_BALANCER_URL%/api/servers"
echo.

echo ⏰ Waiting 35 more seconds for container cleanup...
timeout /t 35 >nul

echo 📊 Final server status:
curl -s "%LOAD_BALANCER_URL%/api/servers"
echo.

echo 📈 Final capacity status:
curl -s "%LOAD_BALANCER_URL%/api/capacity"
echo.

echo 🏁 Single Entry Point Test completed!
echo.
echo 💡 Tips:
echo   - Open http://localhost in your browser to see the game hub
echo   - Click "Play Game" to get your dedicated server automatically
echo   - Check the monitoring dashboard at: http://localhost:3001
echo   - View load balancer logs: docker logs procgen-smart-lb

del join_response.json redirect_response.txt hub_response.html 2>nul
pause