# ---- Stage 1: build the website ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/rules/package.json packages/rules/
RUN npm ci
COPY . .
RUN npm run build -w apps/web

# ---- Stage 2: the box that actually runs ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/rules/package.json packages/rules/
RUN npm ci --omit=dev -w apps/server
COPY apps/server apps/server
COPY packages packages
COPY --from=build /app/apps/web/dist apps/web/dist
EXPOSE 4000
CMD ["node", "apps/server/src/index.js"]
