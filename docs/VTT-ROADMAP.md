# Eldridia Interactive VTT Roadmap

**Project:** Project Umber / Eldrid Tales  
**Goal:** Build a first-party Virtual Tabletop that runs Eldridia campaigns end-to-end — characters, campaigns, maps, tokens, and live multiplayer sessions — on top of the existing Express + Postgres stack.

This document is the living product roadmap. Pair it with the [Miro VTT Roadmap board](https://miro.com/app/board/uXjVEe15X-c=/) for the visual timeline, and the [Interactive Realm Whiteboard](https://claude.ai/artifact/5HD9ATV5j6ycLFb7KJwvoX) for the long-term 3D vision.

The roadmap has two parts: **Part 1** ships the 2D VTT on eldridtales.com (Phases 0–5). **Part 2** builds the 3D interactive realm on top of the same server (Phases 6–10).

---

## North star

A GM and players can create Eldridia characters, join a campaign, load a map scene, move tokens together in real time, roll dice, and track combat — without leaving Eldrid Tales.

**Out of scope for v1:** full Foundry-style module marketplace, 3D maps, video conferencing (hooks only), automated rules adjudication for every Eldridia ability. 3D maps move to Part 2 once v1 is playable.

**Long-term end goal (Part 2):** a GM describes a tale's setting and adds battle maps; each map becomes realistic 3D terrain that keeps its hex grid. Characters are assembled from race templates plus their armor and weapon models. Players move hex to hex, attacks play real animations, unexplored areas are black and areas out of sight are shaded. Each player's phone is the controller: an action button opens their sheet to roll and act, while a host PC renders the shared table.

---

## Current foundation (already in repo)

| Area | Status | Notes |
|------|--------|-------|
| Auth & sessions | Done | Express session auth, login/register/settings/profile; sessions stored in Postgres (`connect-pg-simple`) |
| Character create | Done | 4-step React creator, persisted; JSON content pack for species, roles, callings |
| Character sheet | Done | Sheet, edit, inventory, spells, runes, item shop |
| Monster sheet | Started | First commit in `client/src/monster_sheet/` |
| Home hub | Done | `/api/home` lists characters, campaigns, drafts |
| Campaign flows | Done | Create, list, join by invite code, roster, `dm`/`player` roles, attach a character |
| Themes & backgrounds | Strong | Per-theme colors, desktop + mobile backgrounds, campaign art |
| Class / race art | Strong | Class, race and mix portraits, glyph sets (classes, elements, states, alignments) |
| Map assets | Seeded | `Public/utils/MapBackground.png`, `mapblack1.png` |
| Rules bible | Locked | Eldridia classes, levels 1–30 (index in `Public/utils/md/`) |
| Realtime | Started | Socket.IO on the Express app; campaign rooms joined from the sheet; `roll` broadcast |
| VTT canvas | Missing | No scenes, map UI, or token sync yet |

Stack today: **Node (ESM) + Express 5 + Postgres + Socket.IO**, with a **React 19 + Vite** client in `client/`. VTT work should extend this unless a deliberate pivot is approved.

**Core principle for both parts:** the server is the source of truth. It validates moves, rolls dice, resolves actions and computes vision; every client (2D table, phone, 3D host) only sends intents and displays results.

---

## Principles

1. **Campaign-first.** The VTT table is a room owned by a campaign, not a free-floating sandbox.
2. **Characters are first-class.** Tokens bind to saved characters; sheets stay reachable from the table.
3. **Eldridia-native.** Art, stats (incl. LUC/SPD), and class kit feed the table — not generic D&D defaults.
4. **Ship playable slices.** Each phase ends with something a table can *use*, not just infrastructure.
5. **Realtime is intentional.** Add sockets when there is a map worth syncing; not before.

---

## Phased roadmap

### Phase 0 — Product locks (planning)

**Outcome:** Shared decisions so build work does not thrash.

- [ ] Confirm v1 target: browser desktop first; tablet OK; phone = companion later
- [x] Lock grid default: **hex** (decided 2026-11-18)
- [ ] Lock unit scale (distance per hex) and hex orientation (pointy-top vs flat-top)
- [ ] Define GM vs player permissions on the table
- [x] Choose realtime transport: Socket.IO on the same Express app (in place)
- [ ] Define the server-authoritative action protocol (client intent → server validates/rolls → broadcast result)
- [ ] Decide map asset pipeline (upload + curated library vs curated-only for MVP)
- [ ] Align character schema with full Eldridia sheet (subclass, level, HP, resources)

**Exit:** Short ADR or checklist signed off by Gabriel / Naman.

---

### Phase 1 — Campaign & character backbone

**Outcome:** Players can finish characters and organize into campaigns. No live table yet.

**Build**
- [x] Complete character creation (stats, subclass, level 1 defaults, persist to `characters`)
- [x] Character list + sheet view/edit
- [x] Campaign CRUD: create, list, invite/join code
- [x] Campaign membership roles: `dm`, `player`
- [x] Attach characters to a campaign (one active char per player per campaign)
- [x] Wire home hub lists to real data (current characters / campaigns / unfinished drafts)

**Data additions (sketch)**
```text
campaigns(id, name, description, owner_id, join_code, created_at)
campaign_members(campaign_id, user_id, role)
campaign_characters(campaign_id, character_id, user_id)
character_drafts(...)  -- optional: replace session-only drafts
```

**Exit criteria:** Two accounts can create characters, join one campaign, and see each other listed.

---

### Phase 2 — Solo table (map + tokens)

**Outcome:** A GM can open a campaign scene, place a map, and move tokens locally (single-client).

**Build**
- [ ] `/campaigns/:id/table` VTT shell (canvas + side panels)
- [ ] Pan / zoom map viewport
- [ ] Load campaign map from library (start with existing `MapBackground` assets)
- [ ] Hex grid overlay + snap (axial/cube coordinates)
- [ ] Hex terrain editor: tag each hex (floor, wall, water, trees, cliff, door) and height; stored with the scene; this grid later drives line of sight and 3D terrain
- [ ] Hex pathfinding (A*) with terrain costs, validated on the server
- [ ] Token entities: image, label, position, size, owner, linked `character_id`
- [ ] Drag tokens; GM can move any; players move owned tokens
- [ ] Persist scene state (map + tokens) to Postgres
- [ ] Basic layers: background → grid → tokens → (later drawings/fog)

**Data additions (sketch)**
```text
scenes(id, campaign_id, name, map_asset_url, grid_size, is_active)
tokens(id, scene_id, character_id?, label, image_url, x, y, scale, owner_user_id)
```

**Exit criteria:** GM prepares a scene with party tokens and reloads the page without losing placements.

---

### Phase 3 — Live multiplayer sync

**Outcome:** Everyone at the table sees the same map state in real time.

**Build**
- [ ] Socket room per campaign/scene
- [ ] Sync: token move, token add/remove, scene switch
- [ ] Presence list (who is connected + role)
- [ ] Shared dice roller (formula + result broadcast); `roll` broadcast exists, move the roll itself onto the server
- [ ] 3D dice (R3F + Rapier) that land on the server's result; replaces `RollOrb`
- [ ] Light chat / GM announce channel
- [ ] Conflict rules: last-write or GM authority for contested moves
- [ ] Reconnect + resync snapshot on join

**Exit criteria:** Two browsers in one campaign move tokens and see dice rolls without refresh.

---

### Phase 4 — Play loop (combat & sheet bridge)

**Outcome:** A full session loop: explore → fight → update character state.

**Build**
- [ ] Initiative / turn order tracker (GM-controlled)
- [ ] Token HUD: HP, conditions (manual for v1)
- [ ] Open character sheet drawer from token
- [ ] Push sheet HP/resources ↔ token display
- [ ] Fog of war from hex line of sight: unexplored = black, explored but out of sight = shaded; GM override brush
- [ ] Simple drawings / measure tool
- [ ] Encounter prep: duplicate scene / reset tokens to start
- [ ] Optional: Eldridia quick-ref panel (class ability stubs)

**Exit criteria:** Run a 3–4 encounter one-shot without leaving the table UI.

---

### Phase 5 — Polish & expand

**Outcome:** Production-ready enough for regular Eldridia games.

**Build**
- [ ] Map / token upload + asset library per campaign
- [ ] Premade campaign → seeded scenes (wire `/premade`)
- [ ] Permissions hardening, abuse limits
- [x] Session store beyond MemoryStore (Postgres via `connect-pg-simple`)
- [ ] Performance: large maps, many tokens, socket backpressure
- [ ] Mobile companion: sheet + dice + chat (read-focused); grows into the Phase 6 phone controller
- [ ] 3D rune-casting circle: element / state / alignment glyphs as an animated sigil when a rune is cast
- [ ] Accessibility: keyboard move tokens, contrast, focus order
- [ ] Observability: table join metrics, error logging

**Exit criteria:** Stable weekly game for a real party; known issues documented.

---

## Side track — Spell creator (rune mixer)

Runs in parallel with Phases 2–5; it needs only the spell pack and the character sheet, not the table. Every catalog spell is already alignment × state × element (`db/content/source/spells.json`): 9 alignments × 16 active states × 17 elements ≈ 2,450 combinations, of which 322 have catalog spells.

### Stage A — Discovery mixer

- [ ] Mixer UI: three rotating rings (alignment outer, state middle, element center) using the existing glyph art; React + SVG + Framer Motion, works on phones
- [ ] `POST /api/spells/formula` → `{alignment, state, element}` returns matching catalog spells; the server decides
- [ ] Live result card: name or "unknown formula", level, dice, save, and the character's band from `spell_bands` (Aligned / Opposed modifiers applied)
- [ ] Learn or prepare a discovered spell through the existing spell-limit rules
- [ ] Grimoire: per-character record of discovered combinations; found combos lit, unknown ones dark

**Exit criteria:** A player discovers a catalog spell in the mixer and adds it to their sheet.

### Stage B — Forge (custom spells)

- [ ] Analyze the 794 catalog spells: how level relates to damage dice, range, area, duration and state/element `difficulty`
- [ ] Power budget from that curve; modifiers (shape, range, duration, dice) spend it and set the spell level
- [ ] `custom_spells` table: character, triple, modifiers, computed stats, `gm_approved`
- [ ] GM approval queue in the campaign; approved spells behave like catalog spells on the sheet
- [ ] Forge only empty combinations, so catalog spells keep their identity

**Exit criteria:** A forged spell is approved by the GM and cast from the sheet with stats in line with catalog spells of its level.

### Stage C — Presentation

- [ ] R3F sigil: the combined glyphs animate and flare on cast (shares code with the rune-casting circle)
- [ ] Mixer available from the phone controller (Phase 6)

---

## Part 2 — 3D interactive realm (after v1)

Everything here reuses Part 1: the hex grid, scene data, server-resolved actions, line of sight and Socket.IO rooms. The whiteboard's stages 5–8 match Phases 7–10.

### Phase 6 — Phone controller + TV host mode

**Outcome:** In-person play with a shared screen and phones as controllers.

- [ ] `/play` route: join a campaign table by QR code or invite code
- [ ] Action button opens the character sheet; roll, act, cast, use items
- [ ] Tap-to-target on a mini-map of the hex grid
- [ ] Host display mode: fullscreen shared table on a TV or monitor
- [ ] Per-player fog view on the phone; party view on the TV

**Exit criteria:** A party plays a session with the TV as the table and only phones in hand.

### Phase 7 — Prototype the 3D risks

**Outcome:** Proof that the two hardest parts work before choosing an engine.

- [ ] Render one scene's hex grid as 3D in R3F: extruded walls, height, water, scattered props
- [ ] Terrain test: turn one battle map's hex tags into realistic-looking terrain
- [ ] Lock a shared character skeleton and art-style guide
- [ ] One race base body + one armor set + one weapon, swapped at runtime
- [ ] One attack animation driven by a server-resolved action (hit and miss)

**Exit criteria:** One 3D scene with one assembled character attacking, fed by real server data.

### Phase 8 — Engine + host app

**Outcome:** A local host app that renders the realm.

- [ ] Choose Unreal (best visuals, Landscape + PCG) or Godot (lighter, faster to build), based on Phase 7
- [ ] Run the Node server locally alongside the host app (same API + sockets; optional sync with eldridtales.com)
- [ ] Load scene JSON → terrain, hex overlay, tokens as 3D characters
- [ ] Hex movement animated cell to cell, following terrain height
- [ ] Fog shader: black unexplored, shaded out of sight

**Exit criteria:** Phase 6 phones drive a full encounter rendered by the host app.

### Phase 9 — Characters at scale

- [ ] Base body for every race on the shared skeleton
- [ ] Gear catalog: item IDs map to armor and weapon models
- [ ] Animation library: weapon type × class style, hit reactions, casting
- [ ] VFX for all 17 elements, combined with animations
- [ ] Web-ready exports (glTF, compressed) so the 2D site can preview 3D characters

**Exit criteria:** Any character a player creates appears fully equipped and animated.

### Phase 10 — Tale setup + realm generation

- [ ] Tale setup: setting description, biome tags, scale, notes
- [ ] Battle map upload → automatic hex classification, editable by the GM
- [ ] Biome-driven realistic terrain generated from the hex grid
- [ ] Performance + polish for long sessions

**Exit criteria:** A GM sets up a new tale and plays it in 3D without hand-building any terrain.

---

## 3D extras (R3F) — when to build them

These are optional polish. Build each one when the feature it improves is being worked on, not before:

| Extra | Build during | Why then |
|-------|--------------|----------|
| 3D physics dice | Phase 3 | Part of the shared dice roller; first R3F + server-authoritative practice |
| Rune-casting circle | Phase 5 / Spell creator Stage C | Once runes are cast at the table; shares the mixer's sigil code |
| Initiative ring | Phase 4–5 | Alongside the initiative tracker |
| Class/race carousel in the creator | Phase 5 or later | Creator already works; this is presentation |
| Campaign diorama select | Phase 5 or later | Presentation only |

---

## Suggested build order (first milestones)

| Milestone | Delivers | Depends on |
|-----------|----------|------------|
| M1 | Finish + save character sheets (done) | Phase 1 |
| M2 | Campaign create/join + roster (done) | M1 |
| M3 | Solo map + token persistence | M2 |
| M4 | Socket sync + dice | M3 |
| M5 | Initiative + fog + sheet bridge | M4 |
| M6 | Phone controller + TV host mode | M5 |
| M7 | 3D prototype: one scene, one character | M5 |
| M8 | Host app plays a full encounter | M6, M7 |
| S1 | Spell creator: Discovery mixer + grimoire | Spell pack (parallel to M3–M5) |
| S2 | Spell creator: Forge + GM approval | S1, M2 |

Do not start M3 until M2 membership and character attachment are solid — orphan tokens are expensive to migrate.

---

## Technical sketch

```text
Browser
  ├─ Static / EJS pages (hub, sheets, campaigns)   [exists]
  └─ VTT client (canvas module + socket client)    [new]

Express app
  ├─ REST: auth, characters, campaigns, scenes    [extend]
  └─ Socket.IO: table sync, dice, presence        [new]

Postgres
  ├─ users / races / classes / characters         [partial]
  └─ campaigns / members / scenes / tokens        [new]
```

**Canvas approach (recommendation):** start with HTML Canvas or a thin PixiJS layer for pan/zoom/hex tokens. Avoid a full game engine until Part 2; R3F is used only for extras (dice, runes) and the Phase 7 prototype.

**Auth for sockets:** reuse session cookie; reject joins if user is not a campaign member.

---

## Risks & open questions

| Risk / question | Impact | Mitigation |
|-----------------|--------|------------|
| Character create incomplete | Blocks campaign play | Finish Phase 1 before any table UI |
| ~~MemoryStore sessions~~ | — | Resolved: sessions are in Postgres |
| Map IP / uploads | Legal + storage cost | Curated maps first; uploads behind GM role |
| Scope creep toward Foundry | Slows MVP | Cap v1 at list in North star |
| ~~Hex vs square undecided~~ | — | Resolved: hex (2026-11-18) |
| Realistic terrain from arbitrary maps | Core of Part 2 | Prototype in Phase 7 before committing to an engine |
| One art style across all races + gear | Visual consistency | Lock a shared skeleton and style guide in Phase 7 |
| Rules logic duplicated in a game engine | Drift between web and 3D | Keep rules in Node; engines are display-only clients |
| Full 1–30 rules automation | Huge | Manual HP/conditions in v1; helpers later |

---

## How to use this roadmap

1. Pick the next unchecked item in the **lowest incomplete phase**.
2. Open a focused PR (one milestone slice).
3. Update checkboxes here when merged.
4. Mirror status on the Miro timeline (Done / Now / Next / Later).

---

## Appendix — UI entry points already hinted in nav

From `Public/home.html`:

- `/create_char`, `/char_list`
- `/create_campaign`, `/campaign_list`, `/premade`
- `/profile`, `/settings`

Recommended new routes:

- `/campaigns/:id` — campaign hub
- `/campaigns/:id/table` — live VTT
- `/characters/:id` — sheet

---

*Started 2026-10-04. Updated 2026-11-18: synced status with the repo, locked hex, added Part 2 (3D realm) and the spell creator side track. Update as phases complete.*
