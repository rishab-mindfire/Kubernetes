# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first
COPY package*.json ./
RUN npm install

# Copy everything else (the source code)
COPY . .

# Run the build
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner
WORKDIR /app

# Copy package files and install production-only dependencies
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

# Copy ONLY the dist folder from the previous stage
COPY --from=builder /app/dist ./dist

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["npm", "run", "start:api"]
