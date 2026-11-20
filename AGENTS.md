# Project Tenebris — rules for every AI working here

This file is read by every AI assistant on this repo (Claude and grokbot).
Both follow the same plan. If anything here conflicts with a chat, **this file wins**.

## Start of every session

1. Read `docs/PROGRESS.md` — what was done last, by whom, and what's next — and `docs/CHECKLIST.md` for which steps are done.
2. Read `docs/PLAN.md` (decisions table, stages, carry-forwards) when a decision or stage matters.
   `docs/DECISIONS.md` holds the owner's open questions — never fill in an answer for him.
3. Read the spec in `docs/specs/` for the area you're touching.

## When you finish a step

Tick its box in `docs/CHECKLIST.md`, following the rules at the top of that file:
only when its "Done when" is met, checks pass and the work is committed; add `✓ date · who · commit`.
**Never tick a Gate** — only the owner does.

## End of every session

Add an entry to the top of the **Log** in `docs/PROGRESS.md`:
date, which AI, what changed (files/commits), what's left, anything the other AI must know.
Update **Now** and **Next** if they moved.

## How to work with the owner

- The owner is building most of this himself, in stages, and is learning.
  **Guide step by step and explain why.** Don't do whole steps or stages for him unless he asks.
- **Ask before doing any step or stage.** Testing and checking are fine without asking.
- Use the **Start to Vision Guide's step numbers** (Stage 0–8, steps 1–32, R1–R7, S1–S4) when talking about progress.
- Keep code simple and readable for an early-level programmer; native React patterns.
- He hates writing SQL: use JS/TS (`pgm.*` migrations, queries in code). Generated SQL is OK if he never edits it.

## Several AIs, one repo (working in parallel)

Each AI works in **its own folder and branch** (a git worktree). Nobody but the owner works in the main folder.

| Who | Folder (in `C:\Users\gdebo\Projects\`) | Branch | Server `PORT` | Web `WEB_PORT` |
|---|---|---|---|---|
| Owner | `project-tenebris` | `main` | 4000 | 5173 |
| Claude | `tenebris-claude` | `bot/claude` | 4001 | 5174 |
| grokbot | `tenebris-grokbot` | `bot/grokbot` | 4002 | 5175 |
| Cursor AI | `tenebris-cursor` | `bot/cursor` | 4003 | 5176 |

Make a missing one from the main folder: `.\scripts\new-worktree.ps1 -Name grokbot -Port 4002 -WebPort 5175`

- **Stay in your own folder and branch.** Never edit another AI's folder, and never commit to `main` or push `main` (staging auto-deploys from `main`).
- **Claim before you start:** set the **In progress** line in `docs/PROGRESS.md` (who + step + area). If another AI already holds that area, pick something else or ask the owner.
- **Start fresh:** before a new step, bring in the latest main (`git merge main` on your branch).
- **Finish:** commit on your branch, tick the checklist there, then tell the owner it's ready. **The owner merges into `main`.**
- **One shared database (`rework`).** Only one migration at a time, and only with the owner's OK; experiments go on a throwaway child branch of `rework`. Don't delete or rename data other AIs may be using.
- **Smoke tests share the test accounts** — run them one AI at a time.
- Commit small and often, one area per commit. Never rewrite history (`push --force`, rebasing shared branches) unless the owner says so.
- If you disagree with something another AI did, tell the owner — don't silently undo it.

## Hard rules (never break)

- **Server is authoritative** for rules, rolls, movement and vision. Clients send intents and show results.
- **Only the server rolls dice** (`POST /api/roll`, `crypto.randomInt` in `apps/server/src/dice.js`). Rules in `@tenebris/rules` take the random source as a parameter.
- **Grid is hex, flat-top, 5 ft per hex.**
- **Never touch** the Neon `production` branch or the live Render service `elldridtales` without asking first.
  Work on Neon branch `rework` and Render `tenebris-staging`. Risky migrations go on a throwaway child branch of `rework`.
- Never commit secrets (`.env`, connection strings, `SESSION_SECRET`).

## Stack and layout

- TypeScript everywhere (TS 7, `noEmit`; Node runs `.ts` directly, no server build step).
- npm workspaces: `apps/server` (Express 5 + Socket.IO + `pg`), `apps/web` (React 19 + Vite), `packages/rules` (pure rules, unit-tested), `packages/content` (JSON pack), `assets/` (one image home), `db/migrations/` (node-pg-migrate).
- Web data loading: TanStack Query through the one `apps/web/src/api.ts`.
- Styling: CSS Modules per component.
- Local ports come from `.env` (`PORT` for the server, `WEB_PORT` for Vite): see the table above for whose is whose.

## Checks before calling anything done

- `npm run typecheck`
- `npm test` (rules unit tests, `node --test`)
- Smoke tests (accounts `smoketest` DM + `smoketest2` player, campaign `Smoke Test Campaign`) — local or staging, Neon `rework` only.
