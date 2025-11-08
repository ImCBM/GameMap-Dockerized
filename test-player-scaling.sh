#!/bin/bash

# Player-Dedicated Server Test Script
# This script simulates multiple players joining and leaving to test the auto-scaling

echo "🧪 Testing Player-Dedicated Server Auto-Scaling"
echo "================================================"

LOAD_BALANCER_URL="http://localhost"

# Function to simulate a player joining
simulate_player() {
    local player_id="test-player-$1"
    echo "👤 Player $player_id joining..."
    
    # Join the game
    response=$(curl -s -X POST "${LOAD_BALANCER_URL}/api/player/join" \
        -H "Content-Type: application/json" \
        -d "{\"playerId\": \"${player_id}\"}")
    
    if [[ $? -eq 0 ]]; then
        session_id=$(echo "$response" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
        server_id=$(echo "$response" | grep -o '"serverId":"[^"]*"' | cut -d'"' -f4)
        
        if [[ -n "$session_id" && -n "$server_id" ]]; then
            echo "✅ Player $player_id assigned to server $server_id (session: ${session_id:0:8}...)"
            
            # Send a few heartbeats
            for i in {1..3}; do
                sleep 2
                curl -s -X POST "${LOAD_BALANCER_URL}/api/player/heartbeat" \
                    -H "Content-Type: application/json" \
                    -d "{\"sessionId\": \"${session_id}\"}" > /dev/null
                echo "💓 Heartbeat $i sent for player $player_id"
            done
            
            # Optionally leave (comment out to test inactivity timeout)
            if [[ "$2" == "leave" ]]; then
                echo "👋 Player $player_id leaving..."
                curl -s -X POST "${LOAD_BALANCER_URL}/api/player/leave" \
                    -H "Content-Type: application/json" \
                    -d "{\"sessionId\": \"${session_id}\"}" > /dev/null
                echo "✅ Player $player_id left successfully"
            else
                echo "⏰ Player $player_id going inactive (will trigger auto-cleanup in 10s)"
            fi
        else
            echo "❌ Failed to parse server assignment for player $player_id"
        fi
    else
        echo "❌ Failed to connect player $player_id"
    fi
}

# Function to check server status
check_servers() {
    echo ""
    echo "📊 Current Server Status:"
    response=$(curl -s "${LOAD_BALANCER_URL}/api/servers")
    if [[ $? -eq 0 ]]; then
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        echo "❌ Failed to get server status"
    fi
    echo ""
}

# Function to check capacity
check_capacity() {
    echo "📈 Player Capacity Status:"
    response=$(curl -s "${LOAD_BALANCER_URL}/api/capacity")
    if [[ $? -eq 0 ]]; then
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        echo "❌ Failed to get capacity status"
    fi
    echo ""
}

# Test scenarios
echo ""
echo "🔍 Initial status check..."
check_servers
check_capacity

echo "📝 Test Scenario 1: Single player join and immediate leave"
simulate_player 1 leave
sleep 3
check_servers

echo ""
echo "📝 Test Scenario 2: Multiple players join simultaneously"
for i in {2..4}; do
    simulate_player $i leave &
done
wait
sleep 5
check_servers

echo ""
echo "📝 Test Scenario 3: Player joins and goes inactive (tests auto-cleanup)"
simulate_player 5 # Don't leave, let it timeout
check_servers

echo ""
echo "⏰ Waiting 15 seconds to observe server shutdown..."
sleep 15
check_servers

echo ""
echo "⏰ Waiting another 35 seconds to observe container cleanup..."
sleep 35
check_servers

echo ""
echo "📈 Final capacity check:"
check_capacity

echo "🏁 Test completed!"
echo ""
echo "💡 Tips:"
echo "  - Check the monitoring dashboard at: http://localhost:3001"
echo "  - View load balancer logs: docker logs procgen-smart-lb"
echo "  - Monitor Docker containers: docker ps --filter 'name=procgen'"