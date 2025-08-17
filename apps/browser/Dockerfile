# Use Node.js 20 Alpine as base image
FROM node:20-alpine AS base

# Install pnpm and Playwright dependencies
RUN apk add --no-cache \
    pnpm \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/browser/package.json ./apps/browser/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build shared package
RUN pnpm --filter @bharat-agents/shared build

# Build browser app
RUN pnpm --filter @bharat-agents/browser build

# Install Playwright browsers
RUN npx playwright install chromium

# Production stage
FROM node:20-alpine AS production

# Install dumb-init and Playwright dependencies
RUN apk add --no-cache \
    dumb-init \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/browser/package.json ./apps/browser/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=base --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=base --chown=nodejs:nodejs /app/apps/browser/dist ./apps/browser/dist

# Copy Playwright browsers
COPY --from=base --chown=nodejs:nodejs /root/.cache/ms-playwright /home/nodejs/.cache/ms-playwright

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/home/nodejs/.cache/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Set Node.js memory limit for development
ENV NODE_OPTIONS=--max-old-space-size=512

# Create writable directories
RUN mkdir -p /tmp/browser-sessions /tmp/downloads && \
    chown -R nodejs:nodejs /tmp/browser-sessions /tmp/downloads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application with read-only filesystem (write only to /tmp)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/browser/dist/index.js"]
