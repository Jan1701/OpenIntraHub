# =====================================================
# OpenIntraHub v0.1.1-alpha - Production Dockerfile
# Multi-stage build for optimized image size
# =====================================================

# =====================================================
# Stage 1: Build Frontend
# =====================================================
FROM node:18-alpine AS frontend-builder

WORKDIR /build

# Copy frontend package files
COPY frontend/package*.json ./frontend/
WORKDIR /build/frontend
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend (if needed - adjust if using Vite/React build)
RUN npm run build

# =====================================================
# Stage 2: Backend Runtime
# =====================================================
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl \
    tzdata

# Set timezone to Europe/Berlin
ENV TZ=Europe/Berlin

# Create app user (non-root)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY core/ ./core/
COPY db/ ./db/
COPY locales/ ./locales/

# Copy frontend build from Stage 1 (Vite outputs to dist/)
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["node", "core/app.js"]
