# Dockerfile for ui-shared watch mode
FROM conversational-data-engine-base:latest AS base

FROM node:24-alpine

WORKDIR /app

# Copy installed dependencies from base image
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Copy package-specific node_modules if they exist (happens with conflicting dependencies)
RUN --mount=type=bind,from=base,source=/app/packages/ui-shared,target=/tmp/pkg \
    if [ -d /tmp/pkg/node_modules ]; then \
        mkdir -p ./packages/ui-shared && \
        cp -r /tmp/pkg/node_modules ./packages/ui-shared/; \
    fi

# Enable polling for file watching (required for Docker on Windows/Mac)
ENV CHOKIDAR_USEPOLLING=true
ENV NO_COLOR=1
ENV VITE_CLEAR_SCREEN=false

# Copy package files and configs
COPY packages/ui-shared/package*.json ./packages/ui-shared/
COPY packages/ui-shared/tsconfig.json ./packages/ui-shared/
COPY packages/ui-shared/vite.config.ts ./packages/ui-shared/

# Source code will be mounted as volume
# Built output will also be in a shared volume

# Run Vite build in watch mode
CMD ["npm", "run", "dev", "--workspace=packages/ui-shared"]
