FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY config ./config
COPY scripts/build-rag-index.js ./scripts/build-rag-index.js

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3002

CMD ["node", "src/server.js"]
