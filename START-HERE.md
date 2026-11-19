# Start here — restructure/skeleton branch

This branch holds the **empty target skeleton** from the cleanup plan. Nothing has moved yet: the live app still runs from `index.js`, `client/`, `models/`, `controllers/` and `routes/` exactly as before.

- Plan and scores: [Cleanup Model & Target Skeleton](https://claude.ai/artifact/AB4veixsuWir1h4VfMu8Nb)
- Roadmap: [docs/VTT-ROADMAP.md](docs/VTT-ROADMAP.md)
- Your decisions to fill in: [docs/DECISIONS.md](docs/DECISIONS.md)

## What's here

| Folder | Becomes | Filled by |
|--------|---------|-----------|
| `apps/server/` | Express + Socket.IO (today's `index.js`, `routes/`, `controllers/`, `models/`, `utils/`) | Path step 1, then C13 |
| `apps/web/` | React + Vite (today's `client/`) | Path step 1, then step 6 |
| `packages/rules/` | Shared game rules for server and web | C6 |
| `packages/content/` | Content pack source + build (today's `db/content/`) | C9 |
| `db/migrations/` | Numbered, tracked schema changes | C7 |
| `assets/` | One source for all images | C4 |
| `tests/` | Smoke + rules tests | C10 |

Each folder's `README.md` says what moves in, from where, and has a **Your notes** section.

## When you're back: first session

1. Fill in the **Wave 0** answers in `docs/DECISIONS.md` (test user, staging target).
2. Write the first smoke test in `tests/e2e/` (login → home).
3. Do Wave 1 (C3, C1, C2, C12) on this branch, one commit per ID.
4. Only then do path step 1 (move `client/` → `apps/web/` and the server → `apps/server/`), and check Docker still builds.

## Your notes

- 
