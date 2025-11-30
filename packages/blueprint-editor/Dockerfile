# Blueprint Editor Dockerfile for Vite dev server
FROM conversational-data-engine-base:latest AS base

FROM node:24-alpine

WORKDIR /app

# Copy installed dependencies from base image
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Copy package-specific node_modules if they exist (happens with conflicting dependencies)
# Also copy built library packages that blueprint-editor depends on
RUN --mount=type=bind,from=base,source=/app/packages,target=/tmp/packages \
    if [ -d /tmp/packages/blueprint-editor/node_modules ]; then \
        mkdir -p ./packages/blueprint-editor && \
        cp -r /tmp/packages/blueprint-editor/node_modules ./packages/blueprint-editor/; \
    fi && \
    if [ -d /tmp/packages/types ]; then \
        mkdir -p ./packages && \
        cp -r /tmp/packages/types ./packages/; \
    fi && \
    if [ -d /tmp/packages/ui-shared ]; then \
        cp -r /tmp/packages/ui-shared ./packages/; \
    fi

# Enable polling for file watching (required for Docker on Windows/Mac)
ENV CHOKIDAR_USEPOLLING=true
ENV NO_COLOR=1
ENV VITE_CLEAR_SCREEN=false

# Copy package files and configs
COPY packages/blueprint-editor/package*.json ./packages/blueprint-editor/
COPY packages/blueprint-editor/tsconfig*.json ./packages/blueprint-editor/
COPY packages/blueprint-editor/vite.config.mts ./packages/blueprint-editor/
COPY packages/blueprint-editor/index.html ./packages/blueprint-editor/

# Source code will be mounted as volume
# node_modules will be from shared volume
# Built dependencies (types, ui-shared) will be from shared volumes

# Expose Vite dev server port
EXPOSE 3010

# Run Vite dev server
CMD ["npm", "run", "dev", "--workspace=packages/blueprint-editor"]
