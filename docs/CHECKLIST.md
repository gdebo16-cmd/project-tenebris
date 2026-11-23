# Tenebris — step checklist

One box per step of the Start to Vision Guide (same numbers). Full step wording: https://claude.ai/artifact/DeNEJVFFtHBc4Jazrg6bD4

## How to tick a box

- Tick a step only when its **Done when** is true **and** `npm test` + `npm run typecheck` pass (smoke tests too, if the step touches the app).
- Whoever finished it ticks it — the owner or the AI that did the work — and adds: `✓ YYYY-MM-DD · who · commit <sha>`.
Example: `- [x] **R1** TypeScript setup — ✓ 2026-11-19 · owner + Claude · commit efbc2a4`
- Work is **committed** before the box is ticked (no sha, no tick).
- **Gates are ticked by the owner only.** An AI can say a gate looks ready; it never ticks one.
- Never untick someone else's box. If something you think is done isn't, add a note under it and tell the owner.
- Partly done? Leave it unticked and add a   `- note:` line saying what's left.
- Also add a line to the Log in `docs/PROGRESS.md`.

---

## Stage 0 — A fresh project

- [x] **0.1** Create the repo
- [x] **0.2** Copy in the skeleton
- [x] **0.3** Add the root files
- [x] **0.4** Give it its own database branch (`rework`)
- [x] **0.5** Server
- [x] **0.6** Web app
- [x] **0.7** Content and images
- [x] **0.8** Dockerfile — Done when: `docker build` succeeds and the container serves the site locally
- [x] **0.9** Make a staging service — Done when: the `onrender.com` URL logs in and opens a sheet
- [x] **0.10** Keep a port list (`docs/PORT-LIST.md`)

Switch over — **only after Gate 1, and ask the owner before each one (touches production):**

- [x] **0.11** Back up first (Neon branch `pre-cutover-<date>` from `production`) — ✓ 2026-11-22 · Claude · Neon branch `pre-cutover-20261122` (no commit: a database copy)

> > > > > > > b460d628ef2e657b088eefd084acb6c6b0af54b4

- [ ] **0.12** Point the new service at production
  - note: move the `NODE_OPTIONS` IPv4 fix into the Dockerfile first; adopt migration baseline with `npm run migrate -- fake`
- [ ] **0.13** Move the domain — Done when: the live domain runs the new code and smoke tests pass against it
- [ ] **0.14** Retire the old project (suspend old Render service a week, then delete; archive Project-Umber)

## Stage 1 — Clean foundation

- [x] **1** Answer the Wave 0 questions  — ✓ 2026-11-22 · Gabe
- [x] **2** Build the safety net (C10) — Done when: smoke tests pass three runs in a row — ✓ 2026-11-22 · Gabe
- [x] **3** Take the quick wins (Wave 1: C3, C1, C2, C12) — Done when: content request under 600 KB and tests pass — ✓ 2026-11-22 · Gabe
- [x] **4** Move into the skeleton — — ✓ 2026-11-22 · Gabe
- [x] **5** Consolidate (Wave 2) — Done when: monster sheet runs on shared code and `migrate up` rebuilds a fresh database — ✓ 2026-11-22 · Claude · commit 75cad48 (monster sheet on the shared blocks; fresh-database rebuild checked in R7.5, 9d5b760)
  - note: C5 and C7 done; C11 done in R2; C4 WebP conversion → asset work (not done in R6); real monster sheet → R5; fresh-database seed data → R7
- [x] **6** Share the rules (C6) — done as **R3** — ✓ 2026-11-20 · Gabe + Claude · commit 2d5c775
- [x] **7** Retire the legacy names (C8, C9) — done as **R7** — ✓ 2026-11-22 · Claude · commit 9d5b760

### Native rebuild (before Gate 1)

- [x] **R1** TypeScript setup — Done when: `npm run typecheck` and smoke tests pass — ✓ 2026-11-19 · Gabe · commit efbc2a4
- [x] **R2** Data layer — Done when: no component calls `fetch` directly — ✓ 2026-11-19 · Gabe · commit 2a331f3
- [x] **R3** Rules to the server — Done when: the browser no longer rolls game dice or computes choices from the full pack — ✓ 2026-11-20 · Gabe + Claude · commit 2d5c775
  - note: the "what can this character pick?" endpoint moved to the start of R4 (agreed 2026-11-19).
- [x] **R4** Unified character form — Done when: create and edit use the same components and one save per section (spec: `docs/specs/character-creator.md`) — ✓ 2026-11-20 · Gabe + Cursor · commit 974afbf
- [x] **R5** Sheet blocks — Done when: Character, Monster and DM layouts render from the same blocks (spec: `docs/specs/sheet.md`) — ✓ 2026-11-22 · Gabe + Claude · commit 75cad48
  - note: e2e 17/17, three runs in a row, on a fresh local database; worth one run against staging from My computer.
- [x] **R6** CSS Modules — Done when: no legacy page stylesheet is left — ✓ 2026-11-21 · Gabe + grokbot · commit 20a862c
- [x] **R7** Server tidy-up — Done when: `grep -r idMap` finds nothing and a fresh database seeds from the pack — ✓ 2026-11-22 · Claude · commit 9d5b760

- [x] **Gate 1** (owner ticks) — tests green, server owns every roll, one name per concept, R1–R7 done  — ✓ 2026-11-22 · Gabe

## Stage 2 — The 2D hex table

- [x] **8** Write the table rules — Done when: every table action has an owner and an intent name  — ✓ 2026-11-22 · Gabe ab3164c
- [x] **9** Add scenes and tokens — Done when: the migration runs locally and on a Neon branch  — ✓ 2026-11-22 · Gabe 95a7bd9
- [x] **10** Write the hex math in `packages/rules` — Done when: tests cover distance, neighbors and a path around a wall — ✓ 2026-11-23 · Gabe · commit b90c064
- [x] **11** Build the table shell — Done when: map and hexes line up at every zoom level — ✓ 2026-11-23 · Gabe + Claude · commit 7759a59 (grid filled out in cfcc3a1)
- [x] **12** Build the hex terrain editor — Done when: a painted map reloads exactly as painted — ✓ 2026-11-23 · Gabe + Claude · commit cfcc3a1
- [x] **13** Make tokens real — Done when: a move through a wall is refused by the server — ✓ 2026-11-23 · Claude · commit fd557c0

- [ ] **Gate 2** (owner ticks) — a DM prepares a scene with party tokens, reloads, nothing is lost

## Stage 3 — Live play

- [x] **14** Sync the table — Done when: two browsers see the same moves without refreshing — ✓ 2026-11-23 · Claude · commit f181885
- [ ] **15** Roll on the server, then show 3D dice — Done when: every player sees the same dice land on the same faces
- [ ] **16** Add combat tracking — Done when: damage on the sheet shows on the token at once
- [ ] **17** Resolve actions on the server — Done when: a hit and a miss both resolve with no manual math
- [ ] **18** Add line of sight and fog — Done when: walking around a corner reveals the room beyond it

- [ ] **Gate 3** (owner ticks) — a one-shot of three or four encounters without leaving the table

## Side track — Spell creator (any time after step 6)

- [ ] **S1** Formula endpoint — Done when: a known combination returns its spells and an empty one returns "unknown formula"
- [ ] **S2** Mixer and grimoire — Done when: a player discovers a spell and learns it through the normal limits
- [ ] **S3** Forge — Done when: an approved forged spell matches catalog spells of its level
- [ ] **S4** Sigil — Done when: the sigil plays on the sheet and, after Stage 4, on the phone

## Stage 4 — Phones and the TV

- [ ] **19** Polish for regular games — Done when: a real party plays weekly with a short written list of known issues
- [ ] **20** Build the phone controller (`/play`) — Done when: a player takes a full turn using only their phone
- [ ] **21** Add TV host mode — Done when: the TV never needs a mouse during a session

- [ ] **Gate 4** (owner ticks) — a whole session with the TV as the table and only phones in hand

## Stage 5 — 3D prototypes

- [ ] **22** Turn a scene into 3D — Done when: the 3D scene matches its 2D table hex for hex
- [ ] **23** Test realistic terrain — Done when: someone who hasn't seen the map calls it terrain, not a board
- [ ] **24** Lock the character standard — Done when: changing gear on the sheet changes the model
- [ ] **25** Animate one attack — Done when: the same action looks right for both a hit and a miss

- [ ] **Gate 5** (owner ticks) — one 3D scene, one assembled character attacking, live server data; engine decided

## Stage 6 — Host app

- [ ] **26** Choose the engine — Done when: the choice and reason are in `docs/DECISIONS.md`
- [ ] **27** Connect the host to the server — Done when: a token moved from a phone moves in the host app
- [ ] **28** Rebuild the table in the engine — Done when: Gate 4's session runs in the host app

## Stage 7 — Characters at scale

- [ ] **29** Cover every race and gear item — Done when: any character a player creates appears fully equipped
- [ ] **30** Build the animation library — Done when: every class can attack and cast with an animation

## Stage 8 — Tale setup

- [ ] **31** Add tale setup — Done when: a new map needs only touch-ups, not hand-painting
- [ ] **32** Generate the realm — Done when: a DM sets up a new tale and plays it in 3D without building terrain by hand

- [ ] **Gate 8 — the vision** (owner ticks)
