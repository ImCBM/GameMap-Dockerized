# 🐳 Docker Setup Guide for Procedural Level Generator

This guide will help you run the TypeScript Phaser.js Procedural Level Generator using Docker.

## 📋 Prerequisites

- **Docker Desktop**: Download and install from [docker.com](https://www.docker.com/products/docker-desktop/)
- **Git**: To clone the repository (if needed)

## 🚀 Quick Start

### Option 1: Production Build (Recommended)

1. **Clone and navigate to the project**:
   ```bash
   git clone <your-repo-url>
   cd TSProcGenTest
   ```

2. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

3. **Open your browser**:
   - Navigate to `http://localhost:8080`
   - The application should load with the procedural generator interface

### Option 2: Development Mode with Hot Reloading

1. **Run the development container**:
   ```bash
   docker-compose --profile dev up --build
   ```

2. **Open your browser**:
   - Navigate to `http://localhost:3011`
   - Changes to source code will automatically reload

## 🛠️ Manual Docker Commands

### Production Build

```bash
# Build the production image
docker build -t procgen-phaser:latest .

# Run the container
docker run -d \
  --name procgen-app \
  -p 8080:80 \
  procgen-phaser:latest
```

### Development Build

```bash
# Build the development image
docker build -f Dockerfile.dev -t procgen-phaser:dev .

# Run with volume mounting for live changes
docker run -d \
  --name procgen-dev \
  -p 3011:3011 \
  -v "$(pwd):/app" \
  -v /app/node_modules \
  procgen-phaser:dev
```

## 📁 Project Structure

```
TSProcGenTest/
├── Dockerfile              # Production build
├── Dockerfile.dev          # Development build with hot reload
├── docker-compose.yml      # Multi-service orchestration
├── docker/
│   └── nginx.conf          # Nginx configuration for production
├── .dockerignore           # Files to exclude from Docker context
└── src/                    # Application source code
```

## 🔧 Configuration Options

### Environment Variables

You can customize the Docker setup using environment variables:

```bash
# Custom port mapping
docker run -p 9000:80 procgen-phaser:latest

# Development with custom port
docker run -p 4000:3011 procgen-phaser:dev
```

### Docker Compose Overrides

Create a `docker-compose.override.yml` for local customizations:

```yaml
version: '3.8'
services:
  procgen-app:
    ports:
      - "9000:80"  # Custom port
    environment:
      - CUSTOM_ENV_VAR=value
```

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Check what's using the port
   netstat -an | findstr :8080
   
   # Use a different port
   docker run -p 9000:80 procgen-phaser:latest
   ```

2. **Permission denied on Linux/Mac**:
   ```bash
   sudo docker-compose up --build
   ```

3. **Hot reload not working in development**:
   - Ensure volume mounting is correct
   - Check if the container can access your source files
   ```bash
   docker-compose --profile dev logs procgen-dev
   ```

### Viewing Logs

```bash
# View container logs
docker logs procgen-app

# Follow logs in real-time
docker logs -f procgen-app

# Docker Compose logs
docker-compose logs -f
```

### Container Management

```bash
# List running containers
docker ps

# Stop containers
docker-compose down

# Remove containers and images
docker-compose down --rmi all

# Clean up everything (use with caution)
docker system prune -a
```

## 🔍 Health Checks

Both production and development containers include health checks:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' procgen-app

# View health check logs
docker inspect procgen-app | grep -A 10 "Health"
```

## 🌐 Accessing the Application

### Production Mode
- **URL**: `http://localhost:8080`
- **Features**: Optimized build, Nginx server, production assets
- **Use case**: Final testing, demonstration, deployment

### Development Mode
- **URL**: `http://localhost:3011`
- **Features**: Hot reloading, source maps, development tools
- **Use case**: Active development, debugging

## 📦 Building for Different Environments

### Multi-stage Build Benefits

The production Dockerfile uses multi-stage builds:
- **Stage 1**: Node.js environment for building TypeScript
- **Stage 2**: Lightweight Nginx for serving static files
- **Result**: Smaller final image size (~25MB vs ~900MB)

### Custom Build Arguments

```bash
# Build with specific Node version
docker build --build-arg NODE_VERSION=16 -t procgen-phaser .

# Build for development
docker build -f Dockerfile.dev -t procgen-phaser:dev .
```

## 🚢 Deployment

### Local Testing
```bash
# Test production build locally
docker-compose up procgen-app
```

### Cloud Deployment
The production Docker image can be deployed to:
- **AWS ECS/Fargate**
- **Google Cloud Run**
- **Azure Container Instances**
- **Heroku**
- **DigitalOcean App Platform**

Example for pushing to a registry:
```bash
# Tag for registry
docker tag procgen-phaser:latest your-registry/procgen-phaser:latest

# Push to registry
docker push your-registry/procgen-phaser:latest
```

## 🎮 Using the Application

Once running, you can:
1. **Generate Levels**: Click "Generate Level" to create new procedural maps
2. **Adjust Parameters**: Use the UI controls to modify:
   - Width/Height (map dimensions)
   - Regions (number of connected areas)
   - Distance (minimum spacing between regions)
3. **Navigate**: Use mouse to pan and zoom around the generated level
4. **Toggle Features**: Enable/disable viewport culling, fog of war, etc.

## 🚀 **NEW: Auto-Scaling Game Server Cluster**

### **Multi-Player Server Setup**

Your project now includes an intelligent auto-scaling system that works like game servers:

```
Player 1 → http://localhost:80 → Load Balancer → Best Available Server
Player 2 → http://localhost:80 → Load Balancer → Best Available Server  
Player 3 → http://localhost:80 → Load Balancer → Best Available Server
```

### **Auto-Scaling Features**

- ✅ **Persistent Server**: Server 1 always runs (port 8080)
- ✅ **Smart Load Balancer**: Routes traffic intelligently
- ✅ **Auto-Scaling**: Creates servers on demand
- ✅ **Inactivity Shutdown**: Stops servers after 10s of no activity
- ✅ **Auto-Cleanup**: Deletes containers after 30s in stopped state
- ✅ **Real-time Monitoring**: Live dashboard showing server status

### **Quick Start - Auto-Scaling Cluster**

**Windows:**
```cmd
cluster-manager.bat start-monitoring
```

**Linux/Mac:**
```bash
chmod +x cluster-manager.sh
./cluster-manager.sh start-monitoring
```

**Access Points:**
- 🎮 **Main Game**: `http://localhost:80` (auto-balanced)
- 🏠 **Server 1**: `http://localhost:8080` (always available)
- 📊 **Monitor**: `http://localhost:3001` (real-time dashboard)

### **Cluster Management Commands**

| Command | Description |
|---------|-------------|
| `start` | Start auto-scaling cluster |
| `start-monitoring` | Start with monitoring dashboard |
| `status` | Show current server status |
| `test` | Test auto-scaling behavior |
| `stop` | Stop all servers |
| `cleanup` | Remove all containers |

### **How Auto-Scaling Works**

1. **Demand Detection**: Load balancer monitors traffic
2. **Server Creation**: Spins up new containers automatically
3. **Load Distribution**: Routes players to optimal servers  
4. **Inactivity Monitoring**: Tracks server usage
5. **Graceful Shutdown**: Stops inactive servers (10s timeout)
6. **Resource Cleanup**: Removes containers (30s after stop)
7. **Persistent Core**: Server 1 always remains available

## 🛡️ Security Notes

The production setup includes:
- **Security headers** in Nginx configuration
- **Gzip compression** for better performance
- **Static file caching** with proper cache headers
- **Health checks** for container monitoring

## 📊 Performance

### Container Resources
- **Production**: ~50MB RAM, minimal CPU
- **Development**: ~200MB RAM, moderate CPU during builds

### Build Times
- **Production build**: ~2-3 minutes (initial), ~30 seconds (cached)
- **Development startup**: ~1 minute

## 🤝 Contributing

When working with Docker in this project:
1. Test both production and development builds
2. Update Docker files when adding new dependencies
3. Ensure `.dockerignore` excludes unnecessary files
4. Document any new environment variables or configuration options

---

**Need help?** Check the container logs or create an issue in the project repository!