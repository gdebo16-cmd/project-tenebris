# Progress — handoff between AIs

Every AI reads this first and adds a Log entry last. Newest entry on top.

## Now

- **Stage 1, native rebuild:** R1–R3 done (R3 = commit `2d5c775`). Parallel worktrees set up in `AGENTS.md`.
- **In progress:** nobody

## Next

- R4 Unified character form, starting with the server endpoint "what can this character pick?" (spec: `docs/specs/character-creator.md`).

## Status by step

See `docs/CHECKLIST.md` — the one place steps get ticked off.

## Log

### 2026-11-20 — Claude (R4.2, in the main folder at the owner's request, left uncommitted for him)
- Rules: `packages/rules/src/characterForm.ts` (checkHeader, checkSpeciesTab, missingForFinish, startingHp) + `test/characterForm.test.ts` — 40/40 tests, typecheck clean.
- Server: `models/formPack.js` (pack + looks, shared), `models/characterFormModel.js`, `controllers/characterFormController.js`; routes in `routes/characterForm.js`: POST /characters, GET /characters/:id/form, PUT /characters/:id/form/:tab (header + species so far), POST /characters/:id/finish. Home hides drafts.
- Migration `1795226573999_character-form` is applied on `rework` (checked). SQL checked with EXPLAIN on rework; endpoints NOT run end-to-end (this shell can't reach Neon) — the owner tests them in the browser.
- Finish can't succeed yet: it needs a role and stats, which come with R4.5/R4.6.

### 2026-11-20 — Claude (setup commit)
- Committed R3 (`2d5c775`) with the owner's OK; ticked R3 and Stage 1 step 6.
- Parallel work: one worktree + branch + ports per AI (table in `AGENTS.md`), `scripts/new-worktree.ps1` to make them, Vite reads `PORT`/`WEB_PORT` from `.env`, `.gitattributes` merges this log without conflicts.
- Worktrees not created yet — the owner (or grokbot) runs the script on Windows.

### 2026-11-20 — Claude (later)
- Added `docs/CHECKLIST.md`: one box per guide step and gate, with tick rules. AGENTS.md now tells every AI to use it.

### 2026-11-20 — Claude
- Added `AGENTS.md`, `CLAUDE.md`, `docs/PROGRESS.md`, `docs/PLAN.md`, `docs/specs/` so Claude and grokbot share one plan.
- Repo moved to `C:\Users\gdebo\Projects\project-tenebris` (by grokbot). Checked after the move: git history and uncommitted R3 work intact, `.env` on `rework`, 24/24 tests, typecheck clean.
- No code changed.
