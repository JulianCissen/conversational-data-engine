#!/bin/bash
# Quick start script for Docker setup

set -e

echo "🐳 Setting up Docker environment for Conversational Data Engine..."

# Build base image
echo "🏗️  Building base image with all dependencies..."
docker buildx bake -f docker-bake.hcl base

# Build all service images
echo "🏗️  Building all service images..."
docker buildx bake -f docker-bake.hcl dev

# Start services
echo "🚀 Starting all services..."
docker compose up -d

echo ""
echo "✅ All services started!"
echo ""
echo "📱 Access your applications:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:3100"
echo "   - Blueprint Editor: http://localhost:3010"
echo ""
echo "📊 View logs with: docker compose logs -f"
echo "🛑 Stop services with: docker compose down"
