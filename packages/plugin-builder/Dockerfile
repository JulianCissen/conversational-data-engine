# Dockerfile for plugin-builder watch mode
FROM conversational-data-engine-base:latest AS base

FROM node:24-alpine

WORKDIR /app

# Copy installed dependencies from base image
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Copy package-specific node_modules if they exist (happens with conflicting dependencies)
RUN --mount=type=bind,from=base,source=/app/packages/plugin-builder,target=/tmp/pkg \
    if [ -d /tmp/pkg/node_modules ]; then \
        mkdir -p ./packages/plugin-builder && \
        cp -r /tmp/pkg/node_modules ./packages/plugin-builder/; \
    fi

# Enable polling for file watching (required for Docker on Windows/Mac)
ENV CHOKIDAR_USEPOLLING=true
ENV NO_COLOR=1

# Copy package files (dependencies already installed in base)
COPY packages/plugin-builder/package*.json ./packages/plugin-builder/
COPY packages/plugin-builder/tsconfig.json ./packages/plugin-builder/

# Source code will be mounted as volume
# Built output will also be in a shared volume

# Run TypeScript in watch mode
CMD ["npm", "run", "watch", "--workspace=packages/plugin-builder", "--", "--preserveWatchOutput"]
