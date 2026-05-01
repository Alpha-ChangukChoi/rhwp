# ---------- Builder ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

# ---------- Runtime ----------
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER node
EXPOSE 3000

CMD ["node", "dist/main"]
