# ── Frontend Dockerfile ──────────────────────────────────────────
# Builds the Wandr React/Vite frontend and serves it via nginx.
# Usage:
#   docker build -t wandr-frontend \
#     --build-arg GEMINI_API_KEY=xxx --build-arg EXA_API_KEY=xxx .
#   docker run -p 80:80 wandr-frontend

FROM node:20-alpine AS base
WORKDIR /app

# ── Install dependencies ─────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ── Build ────────────────────────────────────────────────────────
FROM deps AS builder
# API keys are baked into the Vite build bundle (process.env via define)
# Pass them as build args from CI/CD or docker build command
ARG GEMINI_API_KEY=""
ARG EXA_API_KEY=""
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV EXA_API_KEY=$EXA_API_KEY

COPY . .
RUN npm run build

# ── Production: nginx static server ─────────────────────────────
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing: serve index.html for all paths
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
