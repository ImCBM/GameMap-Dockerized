# Auto-Scaling Load Balancer for Game Servers
FROM node:18-alpine

# Install curl and docker CLI for container management
RUN apk add --no-cache curl docker-cli

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose ports
EXPOSE 3000 8090

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the auto-scaler
CMD ["npm", "start"]