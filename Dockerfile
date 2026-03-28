FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/match-service/package.json apps/match-service/package.json
COPY packages/game-core/package.json packages/game-core/package.json
COPY packages/content/package.json packages/content/package.json

RUN npm install

COPY . .
