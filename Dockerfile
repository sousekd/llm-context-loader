# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Install deps deterministically from the lockfile.
COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3010

# OCI metadata (filled in by CI via --build-arg).
ARG VERSION=dev
ARG VCS_REF=local
ARG BUILD_DATE
LABEL org.opencontainers.image.title="llm-context-loader" \
      org.opencontainers.image.description="Tiny LLM context loader: turns URLs into clean markdown for LLMs. Speaks Open WebUI's external web loader and Jina Reader-style GET /r/<url>; fetches via Firecrawl; optionally cleans via any OpenAI-compatible Chat Completions endpoint." \
      org.opencontainers.image.source="https://github.com/sousekd/llm-context-loader" \
      org.opencontainers.image.url="https://github.com/sousekd/llm-context-loader" \
      org.opencontainers.image.documentation="https://github.com/sousekd/llm-context-loader#readme" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="sousekd" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}"

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY templates ./templates

# Drop the root user.
USER node

EXPOSE 3010

# Healthcheck via the runtime's own node, so the image needs no curl/wget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.SERVER_PORT||3010)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
