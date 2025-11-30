# Frontend Dockerfile for Vite dev server
FROM conversational-data-engine-base:latest AS base

FROM node:24-alpine

WORKDIR /app

# Copy installed dependencies from base image
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Copy package-specific node_modules if they exist (happens with conflicting dependencies)
RUN --mount=type=bind,from=base,source=/app/packages/frontend,target=/tmp/pkg \
    if [ -d /tmp/pkg/node_modules ]; then \
        mkdir -p ./packages/frontend && \
        cp -r /tmp/pkg/node_modules ./packages/frontend/; \
    fi

# Enable polling for file watching (required for Docker on Windows/Mac)
ENV CHOKIDAR_USEPOLLING=true
ENV NO_COLOR=1
ENV VITE_CLEAR_SCREEN=false

# Copy package files and configs
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/frontend/tsconfig*.json ./packages/frontend/
COPY packages/frontend/vite.config.mts ./packages/frontend/
COPY packages/frontend/index.html ./packages/frontend/

# Source code will be mounted as volume
# node_modules will be from shared volume

# Expose Vite dev server port
EXPOSE 3000

# Run Vite dev server
CMD ["npm", "run", "dev", "--workspace=packages/frontend"]
