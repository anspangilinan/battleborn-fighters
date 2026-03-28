# Battleborn Fighters

Battleborn Fighters is a browser-based 2D fighting game MVP with:
- `Next.js` on Vercel for the frontend and API routes
- a persistent WebSocket match service for Render
- `Neon Postgres` for match history and simple rating persistence
- a shared TypeScript combat engine used by both the browser practice mode and the match service

## Features

- `A / D` movement, `W` jump, double tap `A` or `D` to dash, and `J / K / L` for attack 1, attack 2, and special attack
- local practice mode against a training bot
- online room creation/join flow with signed room tokens
- deterministic shared fight simulation
- data-first starter roster with two placeholder fighters
- character prompt documentation for generating consistent art references

## Workspace Layout

```text
apps/web        Next.js frontend, Vercel APIs, Neon persistence hooks
apps/match-service   Render-targeted WebSocket match service
packages/game-core  Shared deterministic combat rules
packages/content    Fighter definitions, validation, template metadata
docs/               Prompt docs and character authoring notes
```

## Local Development

1. Copy `.env.example` to `.env.local` for the web app and export the same `SESSION_TOKEN_SECRET` for the match service.
2. Install dependencies:

```bash
npm install
```

3. Start the match service:

```bash
SESSION_TOKEN_SECRET=change-me npm run dev:match-service
```

4. Start the web app in another terminal:

```bash
SESSION_TOKEN_SECRET=change-me NEXT_PUBLIC_MATCH_SERVICE_URL=ws://localhost:8787 npm run dev:web
```

5. Open `http://localhost:42070`.

## Environment Variables

- `SESSION_TOKEN_SECRET`: shared between Vercel and Render so the match service can verify signed session tokens
- `NEXT_PUBLIC_MATCH_SERVICE_URL`: browser WebSocket origin for the Render match service
- `DATABASE_URL`: Neon Postgres connection string used by `/api/match/report`

## Deploying

### Vercel

- Deploy `apps/web`
- Set:
  - `SESSION_TOKEN_SECRET`
  - `NEXT_PUBLIC_MATCH_SERVICE_URL`
  - `DATABASE_URL`

### Render

- Deploy `apps/match-service`
- Start command:

```bash
npm run start --workspace @battleborn/match-service
```

- Set:
  - `SESSION_TOKEN_SECRET`
  - `PORT` (Render usually injects this automatically)

## Docker Compose

For a fully local stack, use [docker-compose.yml](/home/dev/Projects/battleborn/battleborn-fighters/docker-compose.yml). It starts:
- `web` on `http://localhost:42070`
- `match-service` on `ws://localhost:8787`
- `postgres` on `localhost:5432`

Run:

```bash
docker compose up --build
```

The compose file runs `web` with `next dev` and bind-mounts the repo for hot reload. Save a change under `apps/web` or shared packages and the containerized frontend will refresh automatically.

## Adding Fighters

See [docs/character-packs.md](/home/dev/Projects/battleborn/battleborn-fighters/docs/character-packs.md) for the content workflow.

## Verification

```bash
npm run check
npm test
npm run build
```
