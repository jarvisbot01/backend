# ==========================================
# Multi-stage Dockerfile for NexusSales Backend
# ==========================================

# 1. Builder Stage
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit || npm install --prefer-offline --no-audit

COPY src/ ./src/
COPY drizzle/ ./drizzle/

# Compile NestJS TypeScript application
RUN npm run build

# 2. Production Runner Stage
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache tini curl

ENV NODE_ENV=production
ENV PORT=4000

# Copy necessary files from builder and project
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Use non-root node user
USER node

EXPOSE 4000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
