# Backend Dockerfile with dev target
FROM conversational-data-engine-base:latest AS base

FROM node:24-alpine AS development

WORKDIR /app

# Copy installed dependencies from base image
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Copy package-specific node_modules if they exist (happens with conflicting dependencies)
# Also copy built library packages that backend depends on
RUN --mount=type=bind,from=base,source=/app/packages,target=/tmp/packages \
    if [ -d /tmp/packages/backend/node_modules ]; then \
        mkdir -p ./packages/backend && \
        cp -r /tmp/packages/backend/node_modules ./packages/backend/; \
    fi && \
    if [ -d /tmp/packages/plugin-builder ]; then \
        mkdir -p ./packages && \
        cp -r /tmp/packages/plugin-builder ./packages/; \
    fi && \
    if [ -d /tmp/packages/types ]; then \
        cp -r /tmp/packages/types ./packages/; \
    fi

# Enable polling for file watching (required for Docker on Windows/Mac)
ENV CHOKIDAR_USEPOLLING=true
ENV NO_COLOR=1

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files and configs
COPY packages/backend/package*.json ./packages/backend/
COPY packages/backend/tsconfig*.json ./packages/backend/
COPY packages/backend/nest-cli.json ./packages/backend/

# Copy plugin configurations
COPY packages/backend/plugins/ ./packages/backend/plugins/

# Source code will be mounted as volumes
# node_modules will be from shared volume
# Built library dependencies (plugin-builder, types) will be from shared volumes

# Healthcheck to ensure backend is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3100/ || exit 1

# Run NestJS in watch mode
CMD ["npm", "run", "start:debug", "--workspace=packages/backend"]
