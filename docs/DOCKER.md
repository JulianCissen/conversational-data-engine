# Docker Setup Guide

This project uses Docker and Docker Compose to run all services in containers with hot reloading support.

## Prerequisites

- Docker Desktop (with Docker Compose v2)
- Docker Buildx (for `docker buildx bake`)

## Quick Start

1. **Build and start services**
   ```bash
   ./docker-start.sh
   ```
   
   Or manually:
   
2. **Build the base image first**
   ```bash
   docker buildx bake -f docker-bake.hcl base
   ```

3. **Build all other images**
   ```bash
   docker buildx bake -f docker-bake.hcl dev
   ```

4. **Start all services**
   ```bash
   docker compose up
   ```

5. **Access the applications**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3100
   - Blueprint Editor: http://localhost:3010
   - PostgreSQL: localhost:5432

## Docker Bake Targets

The `docker-bake.hcl` file defines several build targets:

- `base` - Build only the base image with dependencies
- `builders` - Build all library watcher containers
- `services` - Build all service containers
- `dev` - Build everything for development (recommended)
- `all` - Build all targets

**Examples:**
```bash
# Build the base image first (required before building other images)
docker buildx bake -f docker-bake.hcl base

# Build all builder containers
docker buildx bake -f docker-bake.hcl builders

# Build everything (after base is built)
docker buildx bake -f docker-bake.hcl all
```

**Important:** Always build the `base` target first, as all other images depend on it.

## Services

### Library Watchers (Build-Only Containers)

These containers watch for changes in library packages and rebuild them automatically:

- **builder-plugin-builder** - Watches `packages/plugin-builder`
- **builder-types** - Watches `packages/types`
- **builder-ui-shared** - Watches `packages/ui-shared`

These containers don't expose ports - they just build artifacts that other services use.

### Application Services

- **postgres** - PostgreSQL 16 database
- **backend** - NestJS API server (port 3100)
- **frontend** - Vue 3 + Vite frontend (port 3000)
- **blueprint-editor** - Blueprint configuration editor (port 3010)

## Development Workflow

### Hot Reloading

All services support hot reloading:
- Source code is mounted from the host filesystem
- File changes trigger automatic rebuilds via TypeScript watch mode (with polling)
- Vite-based projects (frontend, blueprint-editor) use `CHOKIDAR_USEPOLLING=true`
- TypeScript projects use `watchOptions` with `dynamicPriorityPolling` in their tsconfig.json

### Volume Architecture

The setup uses a simple volume architecture:
- Host directory mounted at `.:/app` for all containers
- Anonymous volume `/app/node_modules` to use container's dependencies
- All containers see the same workspace including built artifacts
- TypeScript builders write to `packages/*/dist` folders
- Application services read from those dist folders

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f builder-types

# Without following
docker compose logs backend
```

### Rebuilding After Dependency Changes

If you modify `package.json` files:

```bash
# Stop all services
docker compose down

# Rebuild base image
docker buildx bake -f docker-bake.hcl base

# Rebuild other images
docker buildx bake -f docker-bake.hcl dev

# Restart
docker compose up
```

### Running Commands in Containers

```bash
# Backend
docker compose exec backend npm run test
docker compose exec backend npm run mikro:schema

# Frontend
docker compose exec frontend npm run build

# Builder containers
docker compose exec builder-types sh
```

## Stopping Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes database data)
docker compose down -v
```

## Troubleshooting

### Port Already in Use

If you get port conflicts, stop any locally running services:
- Backend: Stop any process on port 3100
- Frontend: Stop any process on port 3000
- Blueprint Editor: Stop any process on port 3010
- PostgreSQL: Stop any process on port 5432

### Builder Containers Not Building

Check logs of builder containers:
```bash
docker compose logs builder-plugin-builder
docker compose logs builder-types
docker compose logs builder-ui-shared
```

If stuck, restart the specific builder:
```bash
docker compose restart builder-types
```

### Backend Can't Connect to Database

1. Check PostgreSQL is healthy:
   ```bash
   docker compose ps postgres
   ```

2. Check database logs:
   ```bash
   docker compose logs postgres
   ```

3. Verify environment variables in `docker-compose.yml` match

### Hot Reloading Not Working

File watching is configured to use polling which should work reliably in Docker:

1. **For Vite projects** (frontend, blueprint-editor):
   - Ensure `CHOKIDAR_USEPOLLING=true` is set in docker-compose.yml

2. **For TypeScript projects** (backend, builders):
   - Check `watchOptions` in tsconfig.json uses `dynamicPriorityPolling`
   - Restart the service:
     ```bash
     docker compose restart backend
     ```

3. **If changes still aren't detected**:
   - File watching in Docker can be slow on Windows/Mac
   - Consider touching files inside the container to trigger rebuilds:
     ```bash
     docker compose exec backend touch packages/backend/src/main.ts
     ```

### Clean Slate Rebuild

```bash
# Stop everything
docker compose down -v

# Remove all project images
docker rmi $(docker images 'conversational-data-engine-*' -q)

# Rebuild from scratch
docker buildx bake -f docker-bake.hcl base
docker buildx bake -f docker-bake.hcl dev

# Start fresh
docker compose up
```

## Environment Variables

### Backend Configuration (in `packages/backend/.env`)

Required:
- `LLM_API_KEY` - Your LLM service API key

Optional:
- `LLM_BASE_URL` - API endpoint (default: https://api.openai.com/v1)
- `LLM_MODEL` - Model name (default: gpt-4)
- `LLM_TEMPERATURE` - Response temperature (default: 0)
- `LANG_DEFAULT_MODE` - Language mode (default: adaptive)
- `LANG_DEFAULT_LANGUAGE` - Language code (default: en-GB)
- `CORS_ORIGIN` - Allowed CORS origin (default: http://localhost:3000)

### Backend-Specific (in `docker-compose.yml`)

Database configuration is set via environment variables in docker-compose.yml:
- `DB_HOST=postgres`
- `DB_PORT=5432`
- `DB_NAME=form_engine`
- `DB_USER=admin`
- `DB_PASSWORD=password123`

The backend also loads from `packages/backend/.env` for LLM configuration.

## Architecture Notes

### Monorepo Structure

The Docker setup respects the monorepo structure:
- Base image installs all workspace dependencies
- Individual containers inherit from base
- Build artifacts (dist folders) are shared via the mounted workspace
- Source code is mounted from host for hot reloading
- Each container has its own `/app/node_modules` volume to avoid conflicts

### Build Order

Services have dependencies defined in `docker-compose.yml`:
1. PostgreSQL starts first
2. Library builders start and begin watching
3. Backend waits for database health check + builders
4. Frontend depends on backend
5. Blueprint editor depends on builders

### File Watching with Polling

File watching uses polling because:
- Docker on Windows/Mac uses VM layer
- Native file system events don't propagate reliably from host to container
- TypeScript watch uses `dynamicPriorityPolling` in `watchOptions`
- Vite/Chokidar uses `CHOKIDAR_USEPOLLING=true` environment variable
- Polling adds minimal overhead and works consistently across platforms

## Performance Tips

1. **Use WSL2 on Windows** - Much faster than Hyper-V
2. **Allocate enough resources** - Docker Desktop settings:
   - CPUs: 4+
   - Memory: 8GB+
3. **Exclude from antivirus** - Add Docker volumes to exclusions
4. **Prune regularly**:
   ```bash
   docker system prune -a
   ```
