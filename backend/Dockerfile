FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 fastify

COPY --from=builder --chown=fastify:nodejs /app/dist          ./dist
COPY --from=builder --chown=fastify:nodejs /app/node_modules  ./node_modules
COPY --from=builder --chown=fastify:nodejs /app/prisma        ./prisma
COPY --from=builder --chown=fastify:nodejs /app/package.json  ./package.json
COPY --from=builder --chown=fastify:nodejs /app/prisma.config.ts ./prisma.config.ts

USER fastify
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
