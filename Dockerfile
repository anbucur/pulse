# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy server code
COPY server ./server
COPY tsconfig.json ./

# Install tsx for runtime
RUN npm install -g tsx

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["tsx", "server/index.ts"]
