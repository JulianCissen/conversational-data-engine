# Docker Bake configuration for building all images
# Use: docker buildx bake -f docker-bake.hcl [target]

# Base group - build the base image with all dependencies
group "base" {
  targets = ["base-image"]
}

# Builders group - build all library watcher containers
group "builders" {
  targets = [
    "builder-plugin-builder",
    "builder-types",
    "builder-ui-shared"
  ]
}

# Services group - build all service containers
group "services" {
  targets = [
    "backend",
    "frontend",
    "blueprint-editor"
  ]
}

# Dev group - build everything for development
group "dev" {
  targets = [
    "base-image",
    "builder-plugin-builder",
    "builder-types",
    "builder-ui-shared",
    "backend",
    "frontend",
    "blueprint-editor"
  ]
}

# All group - build everything
group "all" {
  targets = [
    "base-image",
    "builder-plugin-builder",
    "builder-types",
    "builder-ui-shared",
    "backend",
    "frontend",
    "blueprint-editor"
  ]
}

# Base image with all monorepo dependencies installed
target "base-image" {
  context       = "."
  dockerfile    = "Dockerfile.base"
  dockerignore  = ".dockerignore.base"
  tags          = ["conversational-data-engine-base:latest"]
  platforms     = ["linux/amd64"]
}

# Plugin Builder watcher
target "builder-plugin-builder" {
  context    = "."
  dockerfile = "packages/plugin-builder/Dockerfile"
  tags       = ["conversational-data-engine-builder-plugin-builder:dev"]
  platforms  = ["linux/amd64"]
}

# Types watcher
target "builder-types" {
  context    = "."
  dockerfile = "packages/types/Dockerfile"
  tags       = ["conversational-data-engine-builder-types:dev"]
  platforms  = ["linux/amd64"]
}

# UI Shared watcher
target "builder-ui-shared" {
  context    = "."
  dockerfile = "packages/ui-shared/Dockerfile"
  tags       = ["conversational-data-engine-builder-ui-shared:dev"]
  platforms  = ["linux/amd64"]
}

# Backend API
target "backend" {
  context    = "."
  dockerfile = "packages/backend/Dockerfile"
  tags       = ["conversational-data-engine-backend:dev"]
  platforms  = ["linux/amd64"]
  target     = "development"
}

# Frontend
target "frontend" {
  context    = "."
  dockerfile = "packages/frontend/Dockerfile"
  tags       = ["conversational-data-engine-frontend:dev"]
  platforms  = ["linux/amd64"]
}

# Blueprint Editor
target "blueprint-editor" {
  context    = "."
  dockerfile = "packages/blueprint-editor/Dockerfile"
  tags       = ["conversational-data-engine-blueprint-editor:dev"]
  platforms  = ["linux/amd64"]
}
