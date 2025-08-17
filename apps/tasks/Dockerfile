# Use Node.js 20 Alpine as base image
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/tasks/package.json ./apps/tasks/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build shared package
RUN pnpm --filter @bharat-agents/shared build

# Build tasks app
RUN pnpm --filter @bharat-agents/tasks build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/tasks/package.json ./apps/tasks/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=base --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=base --chown=nodejs:nodejs /app/apps/tasks/dist ./apps/tasks/dist

# Set Node.js memory limit for development
ENV NODE_OPTIONS=--max-old-space-size=512

# Create writable directories
RUN mkdir -p /tmp/artifacts /tmp/logs && \
    chown -R nodejs:nodejs /tmp/artifacts /tmp/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application with read-only filesystem (write only to /tmp)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/tasks/dist/index.js"]
