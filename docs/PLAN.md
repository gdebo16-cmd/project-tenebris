# Tenebris — plan and decisions

Source of truth for decisions. Change a decision here first. Full step wording is in the Start to Vision Guide (https://claude.ai/artifact/DeNEJVFFtHBc4Jazrg6bD4).

## Decisions

| Decision | Status | Date |
|---|---|---|
| Grid is **hex** | Locked | 2026-11-18 |
| Hex orientation **flat-top**, **5 ft** per hex | Locked | 2026-11-19 |
| Rebuild in a **new repo with fresh history**, done mostly by the owner, in stages | Locked | 2026-11-19 |
| **Rebuild most of the app to be native React, simple, and readable for an early-level programmer** — rework anything | Locked | 2026-11-19 |
| **TypeScript** for the whole repo (server, web, rules); TS 7, `noEmit`, Node runs `.ts` directly (type stripping), no build step for the server | Locked | 2026-11-19 |
| **One unified character form** for create + edit; spec in `docs/specs/character-creator.md` | Locked | 2026-11-19 |
| Maximum character level is **20** (`MAX_LEVEL` in `packages/rules`) | Locked | 2026-11-20 |
| **Sheets as blocks** in Character / Monster / DM layouts; spec in `docs/specs/sheet.md` | Locked | 2026-11-19 |
| Permissions: **DM edits everything; players edit only their own sheet** | Locked | 2026-11-19 |
| Data loading: **TanStack Query** + one `api.ts` (replaces raw fetch / `useFetch` / `sendJson`) | Locked | 2026-11-19 |
| Dice: **only the server rolls** (`POST /api/roll`, `crypto.randomInt`); rules in `@tenebris/rules/dice` take the random source as a parameter so tests are predictable | Locked | 2026-11-19 |
| Rules unit tests: **Node's built-in test runner** (`node --test`, no extra package) | Locked | 2026-11-19 |
| Styling: **CSS Modules** per component (replaces 393 KB legacy page CSS + `usePageStyle`) | Plan | 2026-11-19 |
| Migrations: **node-pg-migrate**, JS migrations; baseline adopted on `rework` | Locked | 2026-11-19 |
| Server is authoritative for rules, rolls, movement and vision | Plan | 2026-11-18 |
| Keep stack: Express + Postgres (Neon) + Socket.IO + React/Vite | Plan | 2026-11-18 |
| Tests: accounts `smoketest` (DM) + `smoketest2` (player), campaign `Smoke Test Campaign`; local + staging, Neon `rework` only | Locked | 2026-11-19 |
| Risky migrations on throwaway child branches of `rework` | Locked | 2026-11-19 |
| AIs (Claude, grokbot, Cursor) share `AGENTS.md` + `docs/`; handoff via `docs/PROGRESS.md`; steps ticked in `docs/CHECKLIST.md` | Locked | 2026-11-20 |
| Parallel AI work: one git worktree + `bot/<name>` branch + own ports per AI; **only the owner merges into `main`** | Locked | 2026-11-20 |
| 3D engine (Unreal / Godot / stay R3F) | Open — decide at Gate 5 | — |
| DM sheet final contents | Open (all suggested blocks for now) | — |
| Final names: Paladin/Templar, Druid/Seer, Rune Weaver/Tome of Inscription | Open | — |
| Spell creator: Discovery first, then Forge | Plan | 2026-11-18 |

## Working rules

- Ask before doing any step or stage; testing and checking is fine without asking.
- Owner hates writing SQL: prefer JS/TS (migrations via `pgm.*`, queries via code); generated SQL is OK if he never has to edit it.

## Environments

| Piece | Details |
|---|---|
| Repo | GitHub `gdebo16-cmd/project-tenebris`; local `C:\Users\gdebo\Projects\project-tenebris` (moved out of `.vscode` on 2026-11-20) |
| Copied from | Umber `restructure/skeleton` at `5e66adc` (split point, see `docs/PORT-LIST.md`) |
| Layout | npm workspaces: `apps/server` (`@tenebris/server`), `apps/web` (`@tenebris/web`), `packages/rules` (`@tenebris/rules`); `packages/content` (JSON pack); one image home `assets/` (Vite `publicDir`); `db/migrate.js` + `db/migrations/` |
| Local ports | server **4000** (port 3000 is taken by another Next.js project), Vite 5173 |
| Database | Neon branch `rework` (`br-raspy-haze-ary5izh5`, endpoint `ep-dark-sky-arpp6wk4`), child of `production`; `DATABASE_URL` only; 17 tables in use, 54 legacy/backup tables left for R7 |
| Staging | Render `tenebris-staging` (`srv-dbvna66c6qcc739vlfug`), https://tenebris-staging.onrender.com, Docker, free, Oregon, auto-deploy `main`, env points at `rework` with its own `SESSION_SECRET` |
| Live (do not touch without asking) | Render `elldridtales` (`srv-db75cmbl550s73aqu4k0`) from Project-Umber `main`; Neon `production` |

## Stage 1 native rebuild (R1–R7, before Gate 1 and Stage 2)

Done in slices, one area per commit, smoke tests green after each.

1. **R1 TypeScript setup** — done. `tsconfig.base.json` + one per workspace (old `.js` allowed, unchecked until rebuilt); `npm run typecheck`.
2. **R2 Data layer** — done (commit `2a331f3`). `apps/web/src/api.ts`, `queryClient.ts`, `queries.ts`. Creator and sheet keep `useFetch`/`sendJson` (routed through `api()`) until R4/R5.
3. **R3 Rules to the server** (guide step 6 / C6) — written, awaiting tests. `packages/rules/src/dice.ts`, `spellLimits.ts`, `runeLimits.ts`; 24 unit tests; server `src/dice.js` is the only random source; every sheet roll asks the server.
4. **R4 Unified character form** — per `docs/specs/character-creator.md`; begins with the server answering "what can this character pick?" so the browser stops computing choices from the full pack.
5. **R5 Sheet blocks** — per `docs/specs/sheet.md`.
6. **R6 CSS Modules** — delete `usePageStyle` and the legacy page CSS.
7. **R7 Server tidy-up** — one router per resource (C13); one naming system (C8); legacy tables retired; content pack as single source + seed data (C9); move `abilityBoosts` + `choiceRules` into `packages/rules` once they no longer need `idMap`.

Gate 1: tests green, server owns rolls, one name per concept, R1–R7 done.

### Carry-forwards

- **Rolls are server-made, but the browser still says what to roll:** the dice text, bonus and crit flag come from the sheet. Real authority is guide step 17, "Resolve actions on the server".
- **Monsters:** fixed in R5.6 — migration `1795400000000_create-campaign-monsters` creates `campaign_monsters`; the monster sheet and the DM page (R5.7) run on the shared sheet blocks.
- Staging needs `NODE_OPTIONS=--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=2000` (Render free has no IPv6). Move into the `Dockerfile` as `ENV` before cutover (0.12).
- Set Render health check path `/health` on staging (dashboard only).
- Adopt the migration baseline on production at cutover with `npm run migrate -- fake` (needs `ALLOW_PRODUCTION=yes`; ask first).
- Fresh databases need seed data (spells, roles, callings, spell lookups) — with R7.
- Register bug: signing up without an email fails (server sends `null`, DB requires email). Fix in R4/R7.
- Login rate limiter is off when `NODE_ENV` isn't `production`; staging test runs will need one shared login per run.
- Web bundle is one 684 KB chunk (167 KB gzipped); code-splitting later.
- PNG→WebP conversion deferred (code references ~200 `.png` names) — not done in R6; still open for asset work.
- Two monster images missing in both repos: `ash_hound.png`, `ochre.png`.

## Target skeleton

```
apps/server     Express + Socket.IO (routes per resource, services, db, realtime)
apps/web        React + Vite (features: characters, campaigns, spells, table, play)
packages/rules  pure game rules, unit-tested, used by server (authority) and web (previews)
packages/content source JSON + build.ts → one minified pack
db/migrations   tracked (node-pg-migrate)
assets/         one image source, WebP outputs
tests/          e2e smoke + rules unit tests
```

## Stages

- **Stage 0 — Fresh project:** done except cutover.
- **Stage 1 — Clean foundation + native rebuild:** steps 1–7 plus R1–R7. Gate: tests green, server owns rolls, one name per concept, new patterns throughout.
- **Stage 2 — 2D hex table (8–13):** table rules/protocol, scenes + tokens, hex math + A*, table shell, hex terrain editor, real tokens. Gate: scenes survive reload.
- **Stage 3 — Live play (14–18):** socket sync, server dice + 3D dice (first R3F), combat tracking, server-resolved actions, line of sight + fog. Gate: full one-shot.
- **Side track — Spell creator (S1–S4):** formula endpoint, mixer + grimoire, forge with DM approval, R3F sigil.
- **Stage 4 — Phones + TV (19–21):** polish, `/play` controller, TV host mode. Gate: session with phones only.
- **Stage 5 — 3D prototypes (22–25):** scene → 3D, terrain test, character standard + gear swap, one attack animation. Gate: decide engine.
- **Stages 6–8 (26–32):** host app, characters at scale, tale setup + realm generation. Gate 8 = the vision.

## Cleanup findings carried into the rebuild

| ID | Correction | Status |
|---|---|---|
| C3 | Compress responses; minify the content pack | Done |
| C6 | One shared rules package; server rolls dice | R3 (dice + spell/rune limits); boosts + choice rules in R7 |
| C5 | `monster_sheet/` duplicate of `sheet/` | Done (deleted; real monster sheet in R5) |
| C4 | Images in three places; JPG + WebP duplicates | Mostly done (one `assets/` home); WebP conversion pending |
| C7 | Hand-run SQL → tracked migrations | Done |
| C9 | Content flows both ways (DB ↔ JSON) → source JSON only | R7 |
| C10 | No real tests → Playwright smoke tests | Done |
| C8 | Legacy races/classes vs species/roles/callings → one naming system | R7 |
| C11 | Pack cached in `localStorage` near its ~5 MB limit | Done in R2 |
| C1, C2, C12 | Dead deps, clutter, DB configured three ways | Done |
| C13 | 81 routes in one file → one router per resource | R7 |
