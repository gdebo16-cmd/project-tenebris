# Decisions — fill these in

Write your answer after each **→**. Leave a question blank until you've decided; nothing in the code depends on these yet.

## Locked

- Grid: **hex** (2026-11-18)
- Sessions: Postgres via `connect-pg-simple` (already in place)

## Wave 0 — needed first

- Test account for smoke tests (username only; put the password in `.env`, not here) → `smoketest` (DM) and `smoketest2` (joining player), same password, in `.env` as `TEST_PASSWORD`
- Test campaign name → `Smoke Test Campaign`
- Where tests run: local only, or also against staging/Neon branch? → local + `tenebris-staging`, both on the Neon `rework` branch, never production
- Neon branch to use for risky migrations → throwaway child branches of `rework`, deleted after testing

## Table (Phase 0)

- Hex orientation: pointy-top or flat-top → **flat-top** (2026-11-19)
- Distance per hex (e.g. 5 ft) → **5 ft** (spell ranges and speeds are all multiples of 5) (2026-11-19)
- What can a player do on the table vs the DM? →
- Who can move a token that isn't theirs? →
- Map assets for v1: curated only, or uploads? →

## Structure

- `packages/rules` in plain JS or TypeScript? →
- Migration tool: `node-pg-migrate` or a small custom runner? →
- Image sizes to generate (desktop width, mobile size) →
- Keep both `main` and `dev`, or merge `ejs-shift` and tidy branches? →

## Spell creator

- Start with Discovery only, or Discovery + Forge together? →
- Can players see undiscovered combinations as dark slots? →
- Who approves forged spells: DM only? →

## Naming (C8)

- One name per concept — confirm the final names:
  - Paladin or Templar →
  - Druid or Seer →
  - Rune Weaver or Tome of Inscription →
  - Any other renames →

## Later (Part 2)

- 3D engine leaning: Unreal / Godot / undecided →

## Your notes

- 
