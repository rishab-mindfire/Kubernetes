# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first
COPY package*.json ./
RUN npm install
COPY . .

# Run the build
RUN npm run build

# Production Build
FROM node:20-alpine AS runner
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

# Copy ONLY the dist folder from the previous stage
COPY --from=builder /app/dist ./dist

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV REDIS_URL=redis://:password@123@redis:6379

EXPOSE 3001
CMD ["npm", "run", "start:api"]
