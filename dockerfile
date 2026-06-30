# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Ensure both package.json and package-lock.json are copied
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy from builder AND set ownership in a single layer
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Switch to the non-root user
USER appuser

