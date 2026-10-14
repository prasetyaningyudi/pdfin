FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3100
COPY --from=build /app/node_modules ./node_modules
COPY server.js ./
COPY src ./src
COPY public ./public
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3100/ >/dev/null || exit 1
CMD ["node", "server.js"]
