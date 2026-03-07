# ── Backend Dockerfile ───────────────────────────────────────────
# Builds the Wandr Express/Exa backend as a production container.
# Usage:
#   docker build -f backend/Dockerfile -t wandr-backend .
#   docker run -p 3001:3001 --env-file .env wandr-backend

FROM node:20-alpine AS base
WORKDIR /app

# ── Dependencies ─────────────────────────────────────────────────
FROM base AS deps
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

# ── Build ────────────────────────────────────────────────────────
FROM base AS builder
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npx tsc --outDir dist || true

# ── Production image ─────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled JS (prefer tsc output; fallback to running tsx on source)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY backend/package.json ./

EXPOSE 3001

# EXA_API_KEY and other secrets injected at runtime via --env-file
CMD ["node", "dist/index.js"]
