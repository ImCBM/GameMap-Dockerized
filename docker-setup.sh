#!/bin/bash

# Docker Quick Setup Script for Procedural Level Generator
# This script provides easy commands to manage Docker containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop first."
        exit 1
    fi
}

# Function to clean up containers
cleanup() {
    print_status "Cleaning up existing containers..."
    docker stop procgen-app procgen-dev 2>/dev/null || true
    docker rm procgen-app procgen-dev 2>/dev/null || true
}

# Function to build production image
build_production() {
    print_status "Building production image..."
    docker build -t procgen-phaser:latest .
    print_success "Production image built successfully!"
}

# Function to build development image
build_development() {
    print_status "Building development image..."
    docker build -f Dockerfile.dev -t procgen-phaser:dev .
    print_success "Development image built successfully!"
}

# Function to run production container
run_production() {
    cleanup
    build_production
    print_status "Starting production container..."
    docker run -d \
        --name procgen-app \
        -p 8080:80 \
        --restart unless-stopped \
        procgen-phaser:latest
    print_success "Production container started! Visit: http://localhost:8080"
}

# Function to run development container
run_development() {
    cleanup
    build_development
    print_status "Starting development container with hot reload..."
    docker run -d \
        --name procgen-dev \
        -p 3011:3011 \
        -v "$(pwd):/app" \
        -v /app/node_modules \
        procgen-phaser:dev
    print_success "Development container started! Visit: http://localhost:3011"
}

# Function to use Docker Compose
compose_up() {
    print_status "Starting services with Docker Compose..."
    docker-compose up --build -d
    print_success "Services started! Visit: http://localhost:8080"
}

# Function to use Docker Compose for development
compose_dev() {
    print_status "Starting development services with Docker Compose..."
    docker-compose --profile dev up --build -d
    print_success "Development services started! Visit: http://localhost:3011"
}

# Function to show logs
show_logs() {
    local container_name=${1:-procgen-app}
    print_status "Showing logs for $container_name..."
    docker logs -f "$container_name"
}

# Function to stop all containers
stop_all() {
    print_status "Stopping all containers..."
    docker-compose down 2>/dev/null || true
    cleanup
    print_success "All containers stopped!"
}

# Function to show container status
status() {
    print_status "Container status:"
    echo ""
    docker ps -a --filter "name=procgen" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
    echo ""
    
    if docker ps --filter "name=procgen-app" --format "{{.Names}}" | grep -q procgen-app; then
        print_success "Production app is running: http://localhost:8080"
    fi
    
    if docker ps --filter "name=procgen-dev" --format "{{.Names}}" | grep -q procgen-dev; then
        print_success "Development app is running: http://localhost:3011"
    fi
}

# Function to show help
show_help() {
    echo "Docker Management Script for Procedural Level Generator"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  prod          Build and run production container (port 8080)"
    echo "  dev           Build and run development container with hot reload (port 3011)"
    echo "  compose       Use Docker Compose for production"
    echo "  compose-dev   Use Docker Compose for development"
    echo "  logs [name]   Show logs for container (default: procgen-app)"
    echo "  status        Show container status"
    echo "  stop          Stop all containers"
    echo "  cleanup       Remove all containers and images"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 prod                    # Start production version"
    echo "  $0 dev                     # Start development version"
    echo "  $0 logs procgen-dev        # Show dev container logs"
    echo "  $0 status                  # Check what's running"
}

# Function to cleanup everything
full_cleanup() {
    print_warning "This will remove all containers and images. Continue? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        stop_all
        docker rmi procgen-phaser:latest procgen-phaser:dev 2>/dev/null || true
        docker system prune -f
        print_success "Full cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Main script logic
check_docker

case "${1:-help}" in
    "prod"|"production")
        run_production
        ;;
    "dev"|"development")
        run_development
        ;;
    "compose")
        compose_up
        ;;
    "compose-dev")
        compose_dev
        ;;
    "logs")
        show_logs "$2"
        ;;
    "status")
        status
        ;;
    "stop")
        stop_all
        ;;
    "cleanup")
        full_cleanup
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