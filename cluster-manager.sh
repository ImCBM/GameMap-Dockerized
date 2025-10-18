#!/bin/bash

# Game Server Auto-Scaling Cluster Management Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ASCII Art Header
show_header() {
    echo -e "${PURPLE}"
    cat << "EOF"
    ╔═══════════════════════════════════════════════╗
    ║           🎮 GAME SERVER CLUSTER              ║
    ║         Auto-Scaling Management Console       ║
    ╚═══════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Start the auto-scaling cluster
start_cluster() {
    print_status "Starting Auto-Scaling Game Server Cluster..."
    
    # Build images first
    print_status "Building Docker images..."
    docker-compose -f docker-compose.cluster.yml build
    
    # Start persistent server and load balancer
    print_status "Starting persistent server and intelligent load balancer..."
    docker-compose -f docker-compose.cluster.yml up -d
    
    print_success "🚀 Cluster started successfully!"
    echo ""
    echo -e "${GREEN}📍 Access Points:${NC}"
    echo "  🎮 Main Game Entry:    http://localhost:80"
    echo "  🏠 Persistent Server:  http://localhost:8080"
    echo "  📊 Load Balancer API:  http://localhost:8090"
    echo ""
    echo -e "${YELLOW}⚙️ Auto-Scaling Rules:${NC}"
    echo "  • Server 1 (port 8080): Always running (persistent)"
    echo "  • Auto servers: Created on demand, shutdown after 10s inactive"
    echo "  • Containers deleted after 30s in shutdown state"
    echo "  • Maximum 10 auto-scaled servers"
}

# Start with monitoring dashboard
start_with_monitoring() {
    print_status "Starting cluster with monitoring dashboard..."
    docker-compose -f docker-compose.cluster.yml --profile monitoring up -d --build
    
    print_success "🚀 Cluster + Monitoring started!"
    echo ""
    echo -e "${GREEN}📍 Access Points:${NC}"
    echo "  🎮 Main Game Entry:    http://localhost:80"
    echo "  🏠 Persistent Server:  http://localhost:8080"
    echo "  📊 Monitoring Dashboard: http://localhost:3001"
    echo "  ⚙️ Load Balancer API:  http://localhost:8090"
}

# Show cluster status
show_status() {
    print_status "Checking cluster status..."
    
    echo -e "${BLUE}📊 Container Status:${NC}"
    docker ps --filter "label=autoscaler.managed=true" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
    docker ps --filter "name=procgen-game-server-1" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
    docker ps --filter "name=procgen-smart-lb" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
    
    echo ""
    echo -e "${BLUE}🎯 Load Balancer Stats:${NC}"
    curl -s http://localhost:80/api/servers 2>/dev/null | python3 -m json.tool || echo "Load balancer not accessible"
}

# Stop all cluster services
stop_cluster() {
    print_status "Stopping auto-scaling cluster..."
    
    # Stop auto-scaled containers
    print_status "Cleaning up auto-scaled servers..."
    docker ps --filter "label=autoscaler.managed=true" -q | xargs -r docker stop
    docker ps -a --filter "label=autoscaler.managed=true" -q | xargs -r docker rm
    
    # Stop main services
    docker-compose -f docker-compose.cluster.yml down
    
    print_success "🛑 Cluster stopped and cleaned up!"
}

# Test auto-scaling by generating load
test_scaling() {
    print_status "Testing auto-scaling behavior..."
    
    echo -e "${YELLOW}🧪 Sending test requests to trigger scaling...${NC}"
    
    for i in {1..5}; do
        print_status "Request $i - Testing load balancer..."
        curl -s http://localhost:80/ > /dev/null || print_warning "Request failed"
        sleep 2
    done
    
    print_status "Waiting for potential server creation..."
    sleep 15
    
    print_status "Checking if new servers were created..."
    docker ps --filter "label=autoscaler.managed=true"
    
    print_status "Waiting for inactivity timeout (10s)..."
    sleep 12
    
    print_status "Final status check..."
    show_status
}

# View logs
view_logs() {
    local service=${1:-smart-loadbalancer}
    print_status "Showing logs for $service..."
    docker-compose -f docker-compose.cluster.yml logs -f $service
}

# Cleanup everything
cleanup_all() {
    print_warning "⚠️  This will remove ALL cluster containers and networks. Continue? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_status "Performing complete cleanup..."
        
        # Stop and remove all related containers
        docker ps -a --filter "name=procgen" -q | xargs -r docker rm -f
        docker ps -a --filter "label=autoscaler.managed=true" -q | xargs -r docker rm -f
        
        # Remove network
        docker network rm tsprocgentest_procgen-cluster 2>/dev/null || true
        
        # Remove images
        docker rmi procgen-phaser:latest 2>/dev/null || true
        
        print_success "🧹 Complete cleanup finished!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Main menu
show_help() {
    show_header
    echo -e "${GREEN}Available Commands:${NC}"
    echo ""
    echo "  🚀 start              Start the auto-scaling cluster"
    echo "  📊 start-monitoring   Start cluster with monitoring dashboard"
    echo "  📋 status            Show current cluster status"
    echo "  🧪 test              Test auto-scaling behavior"
    echo "  📝 logs [service]     View logs (default: smart-loadbalancer)"
    echo "  🛑 stop              Stop the cluster"
    echo "  🧹 cleanup           Remove all containers and networks"
    echo "  📖 help              Show this help message"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./cluster-manager.sh start"
    echo "  ./cluster-manager.sh start-monitoring"
    echo "  ./cluster-manager.sh test"
    echo "  ./cluster-manager.sh logs procgen-server-1"
    echo ""
}

# Main script logic
case "${1:-help}" in
    "start")
        show_header
        start_cluster
        ;;
    "start-monitoring"|"monitor")
        show_header
        start_with_monitoring
        ;;
    "status"|"ps")
        show_status
        ;;
    "test"|"test-scaling")
        test_scaling
        ;;
    "logs"|"log")
        view_logs "$2"
        ;;
    "stop")
        stop_cluster
        ;;
    "cleanup"|"clean")
        cleanup_all
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac