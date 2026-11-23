# Progress — handoff between AIs

Every AI reads this first and adds a Log entry last. Newest entry on top.

## Now

- **Stage 1, native rebuild:** R1–R7 all done and ticked (R5, R7, steps 5 and 7 on 2026-11-22). **Gate 1 is ready for Gabriel to check and tick.**
- **Paused by Gabriel:** nothing.
- **In progress:** nothing claimed.

## Next

- Gabriel: Gate 1. Then either the cutover (Stage 0, 0.11–0.14: backup, rehearsal on a copy of production, then the switch) or Stage 2 (2D hex table, steps 8–13).
- Small: turn staging's auto-deploy back on in Render; delete Neon branch `scratch-r7-drop-test`; layout decisions into DECISIONS.md (Gabriel's). PNG→WebP still open.

## Status by step

See `docs/CHECKLIST.md` — the one place steps get ticked off.

## Log

### 2026-11-22 — Claude (step 8: table spec written from Gabriel's answers; DM page layout; cutover prep)
- `docs/specs/table.md`: every table action with who can do it and its intent name (scenes, maps, tokens, measuring, overlays with turn counters). Decisions are Gabriel's (2026-11-22); undecided items listed under **Open**. Step 8 left unticked for Gabriel's review.
- PR #14 (merged, on staging): the DM page is an editable layout (`dm` kind) with current-monster / current-player blocks.
- Cutover prep (asked by Gabriel): **0.11 done** — Neon branch `pre-cutover-20261122` (copy of production). Rehearsal on `scratch-cutover-rehearsal` (a copy of production): baseline marked as run, the other 7 migrations applied cleanly; resulting schema identical to `rework`. Production itself untouched. **Not done:** Gate 1 (Gabriel), Dockerfile `NODE_OPTIONS` fix, new Render service, migrating production, moving the domain. Note: migrating production breaks the old site at once (it drops the old content tables), so migrate and move the domain together.
- Delete `scratch-cutover-rehearsal` and `scratch-r7-drop-test` when Gabriel says.

### 2026-11-22 — Claude (roll speed: fewer database waits per roll, bot/claude; Gabriel asked for fixes 1–3)
- `apps/server/src/timing.js` + `index.js`: every response carries `Server-Timing: total;dur=…` (DevTools → Network → a request → Timing). Mounted before the session middleware so the session read counts.
- `sheetController.js` `loadSheetData`: after the character loads, armor, weapons, items, learned spells, slots and action features load together (`Promise.all`). Used by the sheet, `/act`, feature/rune/rest/cast/conditions and the DM page.
- `index.js` PgStore `disableTouch: true`: no session `UPDATE` at the end of every request. No change for players: `rolling` is off, so the cookie's expiry was already fixed at the last save; touch only moved the database row's date.
- Measured with Postgres statement logging on one `/act` roll: before = 9 database waits in a row (session read, access, character, armor, weapons, items, 2 spell queries, session touch); after = 5 (session read, access, character, one parallel wave, the second spell query). Each wait is a full trip to Neon, so this roughly halves the database part of a roll.
- Checked: typecheck, 125 unit tests, e2e 17/17 three runs in a row on a fresh local Postgres 16 (all migrations from nothing; smoketest + smoketest2 each with a finished warrior with a weapon).
- Not done (by design): actions over the socket (fits step 14) and an in-memory sheet cache (after the write paths settle).

### 2026-11-22 — Claude (sheet polish PRs #2–#4, e2e tests updated and green, R5/R7 ticked)
- PR #2: `Fit` (SheetLayout.tsx) stops scaling a block up when anything inside would spill sideways, not only at its height (Rest in a narrow column, Health buttons, stat labels).
- PR #3: Skills as a 5×3 tile grid (name over bonus); solid phone tab bar; stat / core-stat / skill tile labels size to their tile (`container-type` + `cqi`).
- PR #4: Afflictions as a 4×3 tile grid, exhaustion as one wide tile (− n / 10 +); every block's corners 1.5rem (block modules, Sheet.module.css, the layout grid's clip); Health buttons wrap instead of being cut. All three merged by Gabriel and deployed to staging.
- This commit: e2e tests caught up with Gabriel's form and sheet redesign — role cards are named with their hit die (`/^Warrior\b/`), callings and skills are buttons (`aria-pressed`), the traits step in character.spec goes through the server like form-traits.spec does, the sheet title is `heading level 1` (the sidebar also lists the name), a player's rolls show in the roll orb, and the Features region is matched exactly (the action panel's name contains "features"). App fix: the exhaustion tile reads "Exhaustion 1 / 10" (a space between label and number).
- Checked: typecheck, 125 unit tests; e2e 17/17 three runs in a row on a fresh local database (PGlite; smoketest + smoketest2 each with a finished character, smoketest's with a weapon). Staging couldn't be reached from Claude's machines, so one run there from Gabriel's computer is still worth doing.
- Ticked R5, R7 and steps 5 and 7. Gate 1 left for Gabriel.

### 2026-11-22 — Claude (Gabriel's main-folder work + phone layouts, committed on bot/claude at his request)
- Gabriel worked in the main folder with Claude; this commit carries all of it over to bot/claude (he merges to main).
- Site menu: `Sidebar.jsx` (hamburger + panel) replaces SiteNav; Settings live in it (`components/settings/`); Profile/Settings pages removed. Sidebar sections: `SidebarCharacter` (edit links), `SidebarCampaign` (tale page, DM page), `SidebarSheetLayout` (Edit sheet layout, wide screens).
- Sheet layout (L1–L6, grid v2): `packages/rules/src/layout.ts` (12×16 grid, checkLayout, place/nudge/add/remove; tests, 125 total), `blocks/registry.tsx`, `SheetLayout.tsx` (Fit zoom, drag/resize/keyboard editor), `LayoutEditor.tsx`, `layouts.ts` (defaults + saved per user). Server: `/api/layouts` (GET/PUT/DELETE). Migration `1795400000200_add-user-sheet-layouts` — already run on rework with Gabriel's OK.
- Every sheet block has its own CSS module; ActionPanel is a real component; DetailsPanel (side panel / bottom sheet) back for weapons, armor, items, spells.
- Phones: sheet header fixed with the status bar in the header color (`hooks/useHeaderStatusBar.ts`, base.css), only the sheet area scrolls, no footer. Phone tabs on character and monster sheets (Stats/Combat/Condition), DM page (Initiative/Party/Encounter/Notes/Rolls) and campaign page (tab classes fixed + restyled panels). Monster sheet and DM page got the sheet header/footer.
- Checked: typecheck, 125 tests, build; browser run on a fresh PGlite database at 390×844 and 1366×900 (no page errors).
- Left: Gabriel merges bot/claude → main (staging deploys); e2e on staging, then tick R5/R7. Layout decisions (12×16, phones follow one layout, drag + keyboard) are Gabriel's, not yet written in DECISIONS.md. Scratch Neon branch `scratch-r7-drop-test` still to delete.

### 2026-11-22 — Claude (staging deploy + migrations on rework, with Gabriel's OK)
- Staging hadn't deployed since 2026-11-19 (auto-deploy not firing); deployed `6b47f10` by hand, live.
- Ran the four new migrations on `rework` (same SQL node-pg-migrate generates, recorded in pgmigrations in file order): old id columns, 61 old tables, `campaign_monsters`, `campaigns.dm_notes`/`initiative`. `rework` now has the 11 app tables + pgmigrations; `npm run migrate` has nothing left to run. Backup of the old tables: Neon branch `rework-backup-pre-r7`.

### 2026-11-22 — Claude (R5.6 monsters + R5.7 DM page, bot/claude; Gabriel unpaused both)
- Rules: `monster.ts` (`monsterToCreature` → the same Creature the sheet blocks read; `healthWord`, `monsterGlimpse` for players, monster HP/ward rules) and `initiative.ts` (server rolls d20 + initiative, sorts, next turn / round). 12 new tests (113 total).
- Migrations (NOT run on rework yet — run after R7's): `1795400000000_create-campaign-monsters` (HP, ward, conditions, exhaustion, notes; cascades with the campaign) and `1795400000100_add-campaign-dm-page` (`campaigns.dm_notes`, `campaigns.initiative`).
- Server: `/api/sheets/monster/:id` (+ /act, /hp, /temp-hp, /conditions, /notes, DELETE). DM sees everything; other members get a glimpse (name, type, health word, conditions). Monster rolls go to a DM-only socket room `campaign:<id>:dm`. DM page: `/api/campaigns/:id/dm`, `/initiative`, `/dm-notes` (DM only).
- Web: `/monsters/:id` (MonsterSheetPage + TraitsBlock, same blocks as the character sheet), `/campaign/:id/dm` (Initiative, Notes, Rolls | Party, Encounter with quick ±, add/remove monster). DM page link on the campaign page.
- Checked on a brand-new empty database (PGlite): every migration up from nothing (= R7.5 fresh-database check, 11 tables + pgmigrations), then an API run as DM and player (permissions, rolls, HP, conditions, notes, initiative, cascade delete), migrations down and up again, and screenshots of both pages on desktop and phone (no page errors).

### 2026-11-22 — Claude (R7.5 content single source, bot/claude; Gabriel chose option A)
- `packages/content/source/` now holds one file per section of `content.json` / `spells.json`, exactly as the server reads it (added `roles.json`, `scaling_rules.json`; four files refreshed from the built pack). `build.ts` just merges them and fails on a file it doesn't know. Rebuilt pack is byte-for-byte identical.
- `npm run content:build` added. Deleted `export.ts`, `type.ts`, `roles_info.json` (old DB-export pipeline). `docs/CONTENT_GUIDE.md` rewritten for the new layout.

### 2026-11-22 — Claude (R7.1, R7.3, R7.4 on bot/claude; Gabriel's names and OKs given in chat)
- R7.1 `cd475a2`: names recorded in DECISIONS.md (Templar, Seer, Tome of Inscription). `RUNE_CALLING = 'Tome of Inscription'` replaces the Rune Weaver aliases (rules, rune model, sheet) — fixes the block sheet never giving Tome of Inscription characters their runed-weapon bonuses.
- R7.3a `9ad1d05`: removed the old creator/editor server code nothing called (~1,300 lines: magicModel, raceModel, classModel, choiceRules, old create/edit functions, notes files).
- R7.3 `8c5aec6`: server reads/writes species_id/role_id/calling_id only; idMap.js deleted; migration `1795360000000_drop-legacy-character-ids` drops race_id, subrace_id, class_id, subclass_id. Every finished character already had species_id/role_id.
- R7.4: `docs/LEGACY-TABLES.md` lists the 61 tables nothing reads (server SQL touches only users, session, characters, character_*, item_runes, campaigns, campaign_members); migration `1795360000100_drop-legacy-tables` drops them (irreversible: `down = false`).
- Neon: backup branch `rework-backup-pre-r7` (br-weathered-fire-ar6nblk0, no compute) made from rework before any migration. Both migrations' SQL tested on throwaway branch `scratch-r7-drop-test` (br-misty-field-arh1pph5): 11 tables left, character/sheet queries work. Delete the scratch branch when done.
- RUN ORDER: merge bot/claude to main and let staging deploy FIRST, then `npm run migrate` on rework (old code still reads class_id).
- Left in R7: R7.5 content single source + fresh-database check (needs a decision on how source/ and content.json relate). Other unused character columns (armor_id, shield_id, spell_slot_level, spell_slots, spell_slots_used, save_proficiencies, rest_locks, boost_*) could go in a later migration.

### 2026-11-22 — Claude (R7.2 one router per resource, bot/claude)
- `routes/api.js` now only mounts one router per resource: auth, account, rolls, characterForm, sheets, characters, inventory, campaigns, content, monsters (+ the JSON error handler). Routes moved, not changed: checked old vs new route lists, 67 = 67, none missing. 101/101 rules tests, typecheck clean.
- Controllers stay `.js` for now (converting them needs `@types/express`).
- R7 next: R7.1 needs Gabriel's names in DECISIONS.md (Paladin/Templar, Druid/Seer, Rune Weaver/Tome of Inscription); R7.3 idMap, R7.4 legacy tables and R7.5 seed involve migrations — ask first.

### 2026-11-21 - grokbot (R6.1 local class names, main `f1f54db`..`c4e2b2a`, not pushed)
- Class and id names in the page modules are local now (camelCase, `styles.x` in the JSX). Page modules no longer use `:global` except `:global(.fixed-bg)` (that div is in index.html). Rules that name a local class need no page check; rules that only name elements keep `:where(html:has(.page))`, and html/body rules use `html:where(:has(.page))` / `body:where(:has(.page))`. Styled ids stay ids (`id={styles.siteTitle}`) so specificity is unchanged; unstyled class names and ids nothing refers to were removed from the JSX (ids used by labels, aria or tests stay). Each page's dead rules (old nav copies, old sheet leftovers) are gone; the stale char_create.css comment is gone.
- Shared components have their own modules: `SiteNav.module.css` (the nav rules the 6 nav pages used to copy), `TabList.module.css`, `features/inventory/ItemShop.module.css`. SiteNav, TabList and LogoutLink take `className`; WeaponFilter and ArmorFilter take `className` / `selectClassName` (ItemShop passes its `.filterContainer` / `.field`). The nav drift between pages is kept through `<SiteNav className={styles.nav} />` and a few rules at the end of the page module: Home (desktop width 85vw, no padding, `margin: 1em 0`), CampaignPage (mobile text colour), Profile (mobile dropdown border, no desktop hover colour on dropdown links). Unifying those is Gabriel's call.
- campaign.spec finds the invite code by its "Invite code" label (the class is hashed now).
- Checks: typecheck + build after every commit; rules 101/101; Playwright 17/17. The SiteNav and TabList commits were checked with computed-style dumps and screenshots (no differences); per Gabriel, the later commits were not screenshot-checked because the layout is going to change.

### 2026-11-21 - grokbot (R6 CSS Modules, main `bf2b641`..`20a862c`, not pushed)
- Every page that used `usePageStyle` now imports its own `pages/<Page>.module.css` (CampaignList, CampaignPage, CreateCampaign, HomePage, InventoryPage, JoinCampaign, LoginPage, ProfilePage, RegisterPage, SettingsPage). One commit per page; `usePageStyle.js` is deleted.
- How the page sheets are scoped: each page puts `styles.page` on its `<main>` (and on its error `<p>` and `<Loader>`), and every rule is written `:global :where(html:has(:local(.page))) <old selector>`. `html` / `body` / `*` rules hang the check on that element instead (`body:where(:has(.page))`), and `body.subpage` became `body:has(.page)`. `:where()` adds no specificity, so every rule weighs what it did, and a page's rules only apply while it is on screen, as before. Class and id names stay global because SiteNav, TabList, ItemShop and the filters are styled by whichever page shows them. Turning those into local names is follow-up work, page by page.
- Shared CSS: `components.css` split into `styles/base.css` (global input/select rules, still imported in main.jsx) and `features/inventory/ItemDetails.module.css` (the details popup, local class names). `loader.css` became `components/Loader.module.css`; Loader takes an optional `className`. `themes.css` stays global. Dead rules dropped: `.tile-icon`, `.spell-build-box`.
- `charSheet.css` + `sheet-subpage.css` became `InventoryPage.module.css`: the 340 of 452 rules that name a class or id used nowhere in `src/` or `index.html` were dropped (old sheet leftovers). `char_create.css` was imported by nothing and is deleted.
- Checks: before/after Playwright screenshots of all 10 pages at 1440×900 and 390×844 (plus the inventory tabs and details popup, the block sheet and the character form), in dev and in production builds: identical apart from 2–72 px of anti-aliasing noise that also shows up between two runs of the same build. Typecheck and build clean after every commit; rules 101/101; Playwright 17/17.
- Bundle: the CSS moved out of the JS (JS 621 → 451 KB, CSS 55 → 214 KB; about the same in total).

### 2026-11-21 - grokbot (R5.5 money, conditions, sheet swap; bot/claude `e7fd9ae`, `f94cf65`, `46ec4b5`)
- Money: owner's migration `1795282460378_add-character-money` (copper, silver, gold, crowns, oracles). Rules `money.ts` (purse, checks, presets). POST `/api/sheets/character/:id/money` (owner or DM, one atomic UPDATE, "Not enough silver."). Character form Gear tab: three default money buttons (Impoverished 10 cp, Average +10 sp, Wealthy +10 gp), drafts only; a finished character's money changes on the sheet. PurseBlock on the sheet's Gear tab.
- Conditions: POST `/api/sheets/character/:id/conditions` { conditions?, exhaustion? } (owner or DM; rules `checkConditionsRequest` / `applyConditions`). PATCH `/api/characters/:id/state` is gone. The Sigil hit button no longer spends embers.
- Swap: `/characters/:id` is the block sheet (`?new=1` is ignored). Deleted `apps/web/src/sheet/`, SheetSwitch, `apps/web/src/dice.ts`, the web utils only the old sheet used (background, glyphs, runes, stats) and the old spell book routes. ItemShop / ItemDetails moved to `features/inventory` (inventory page).
- Kept, though the web no longer calls them: `/api/roll`, GET `/api/characters/:id` (e2e tests read it), equip/unequip, dual-wield / two-hands / soul-brand / sigil-mark and the rune routes. The block sheet has no equip or rune controls yet. The old sheet's rules in `charSheet.css` stay (the inventory page loads that file).
- Checks: 91/91 rules tests, typecheck, build, e2e 13/13 on 4001/5174.
- Next: equip and rune controls on the block sheet (or drop those routes); R5.6/R5.7 need the owner's OK for their migrations.

### 2026-11-21 - grokbot (R5.4-R5.5 missing pieces, bot/claude `e7fd9ae`)
- Owner's calls: embers, cracks and breach saves are gone; Body Magic (its once-per-rest spells, Lantern/Mending runes) is stashed; money is the owner's to write.
- Rules: `packages/rules/src/features.ts` (uses per rest), `sheetState.ts` (spendFeatureUse, takeRest ported from the old rest(), spendSlot, castSpell), `spellbook.ts` (learn/prepare caps, moved out of apiSpellController). Creature gains `restUses`, `spellLimits` and per-feature `key` / `perRest` / `diceNow`. Tests: `sheetState.test.ts`, `spellbook.test.ts` (82/82).
- Server: POST `/api/sheets/character/:id/feature` | `/rest` | `/cast`, GET+POST `/spellbook` (owner or DM). Old spell routes now share `changeSpellbook()`. No migration: uses `rest_uses`, `used_slots`, `conditions`, `exhaustion`, `character_spells`.
- Web: FeaturesBlock (uses left + Use), RestBlock, SpellsBlock casts through `/cast` (the browser no longer spends slots), SpellBookBlock (prepare / action / forget / learn). e2e `sheet-new.spec.js` passes on 4001/5174.
- Left: money (owner); then swap the default sheet. ConditionsBlock/exhaustion still save through PATCH /state (owner only).

### 2026-11-20 — Claude (R5.4–R5.5, bot/claude `e185d8e`)
- New sheet at `/characters/:id?new=1` (old sheet stays the default): `apps/web/src/features/sheet/` — CharacterSheetPage + blocks SheetHeader, HealthBlock, CoreStatsBlock, StatsBlock (stats + skills), ConditionsBlock (+ exhaustion), ActionsBlock (weapons, bonus actions, Soul/Runic/Sigil), SpellsBlock (slots, cast level, cast/damage), InventoryBlock, FeaturesBlock, RollFeed. One `Sheet.module.css` with theme variables, laid out like the sheet mockup.
- Every roll goes through `/act`; initiative, stats and skills are `kind: 'check'` (bonus from the Creature). 68/68 rules tests, typecheck, build OK. New e2e `sheet-new.spec.js`. Not yet seen in a browser.
- Still on the old sheet only (do before swapping): feature activation (embers, per-rest uses, cracks/breach), rests, Body Magic once-per-rest spells, lanterns/Mending runes, spell book (learn/prepare), money. Spell slots are still spent from the browser.
- Next: owner compares ?new=1 with the old sheet; then the missing pieces, the swap (R5.5 end), and R5.6/R5.7 (need migration OK).

### 2026-11-20 — Claude (R5.1–R5.3, bot/claude)
- Based on bot/cursor `bbd0db9` (R4 + review fixes 1–3), since main is mid-merge.
- R5.1 `e7d32db`: `packages/rules/src/creature.ts` (Creature type + characterToCreature: AC, initiative, weapons incl. versatile/dual wield/Soul Brand/runed/sigil, fists, skills, spells, embers, cracks, speed), `stats.ts` and `runes.ts` moved into rules (web utils re-export them). Tests check every number against the old sheet's math.
- R5.2–R5.3 `a11ee9a`: `GET /api/sheets/character/:id` -> { creature, canEdit, access } (owner/DM edit, other campaign players view) and `POST /api/sheets/character/:id/act` { actionKey, kind, castLevel?, extra?, featureKey? } — server finds the action, rolls, remembers a natural 20 (in memory) for the next damage. Rules in `actions.ts`.
- 67/67 rules tests, typecheck clean, routes load. NOT run against the database from here (this shell can't reach Neon): needs a check on port 4001.
- The old sheet still rolls through /api/roll; the new blocks (R5.4–R5.5) will use /act. Spell slot spending is still client state.
- Next: R5.4 blocks + R5.5 Character layout. R5.6/R5.7 need the owner's OK for their migrations.

### 2026-11-20 — Cursor (R4 review: finished role and Endurance)
- A finished character's role save also writes `class_id` and `subclass_id`, the same way finish does. A draft still waits until finish. Those columns go away in R7.
- Changing Endurance on a finished character recomputes the stored max with the same gain as a level change: the level-1 CON mod and every later step. Current HP is clamped.
- Checked on ports 4003 / 5176: typecheck, `npm test` (54), form e2e (7 passed, smoke accounts in use).
- R5 is not started.

### 2026-11-20 — Cursor (R4 review: level-up)
- A finished character can change level from the header, up to 20, and down. The gain is the old editor's: hit die / 2 + 1 + CON mod, at least 1. `leveledMaxHp` matches `startingHp`. Stored max stays the base; current HP is clamped and not refilled. Drafts still get HP only when they finish.
- Checked on ports 4003 / 5176: typecheck, `npm test` (54), form e2e (7 passed, smoke accounts in use). A finished warrior gained one hit-die step at level 2 and lost it again at level 1.
- R5 is not started.

### 2026-11-20 — Cursor (R4 review: max level 20)
- Owner's decision: maximum level is 20. Recorded in `docs/DECISIONS.md` and `docs/PLAN.md`. One constant, `MAX_LEVEL` in `packages/rules/src/characterForm.ts`. The model, the options check, and the header dropdown use it.
- Level 21 is refused. A character already above 20 keeps that level (it stays in the dropdown as one extra option) and can be saved or lowered. It cannot be raised. The two characters on `rework` above 20 were not changed.
- Checked on ports 4003 / 5176: typecheck, `npm test` (53), form e2e (7 passed, smoke accounts in use).
- R5 is not started.

### 2026-11-20 — Cursor (R4.9)
- Home "New character" and the sheet Edit link open the new form. `/api/home` lists draft rows under Unfinished (delete uses the existing character delete). The old `/create_char` pages, `/edit-old`, and `req.session.charDraft` are gone.
- A finished character can save role, traits, and gear on this form. Rerolls stay locked after finish. Changing the level of a finished character is refused ("not ready yet") — this slice does not add level-up math.
- PLACEHOLDER until `docs/DECISIONS.md` (unchanged): gifts 1, plus 1 at levels 4 and 8; rerolls unlimited while `is_draft`; callings do not add proficiencies; starting money is 10. Gift ids still live inside `stat_rolls`.
- Left in place because other code still shares the file, and nothing else imported the deleted pages: `createCharacter`, `getEditCharacter`, `updateLevel`, `updateAbilities`, `applyBoostResult` in `characterModel.js`; `listStartingGearForRole` in `content.js`; `utils/choiceRules.js`; `apps/web/src/styles/char_create.css`. Kept `background.js` and `glyphs.js`.
- Checked on ports 4003 / 5176: typecheck, `npm test` (53), `npm run test:e2e` (9 passed, smoke accounts `smoketest` and `smoketest2` in use). The new character test walks the form, finishes, and rolls to hit.
- R4 is done. R5 is not started.

### 2026-11-20 — Cursor (R4.8)
- Inventory tab. Proficiencies come from the role. `armorTypesFromProf` and `weaponCategoryNamesFromProf` now live in `packages/rules/gear.ts`; the server re-exports them. Weapon and armor options are marked proficient or not.
- PLACEHOLDER until `docs/DECISIONS.md`: callings do not add proficiencies, and a new character starts with 10 money. The browser cannot send a different amount.
- Auto default (`POST /api/characters/:id/form/gear/default`) fills this tab only: first proficient weapon and armor, equipped. Finish shows the missing lines when it refuses, and opens the sheet when it succeeds. The equipped weapon is on the sheet.
- Checked on ports 4003 / 5176: typecheck, `npm test` (54), `npm run test:e2e` (9 passed, smoke accounts in use).
- Next is R4.9.

### 2026-11-20 — Cursor (R4.7)
- Personality tab. The alignment chart is the real 3 by 3 (law axis by good axis). Upbringing, lifestyle and outlook save with the state each pick gives. A wildcard pick sends its chosen state; every other pick's state comes from the pack.
- Two matching states are refused in the rules, before the database constraint `characters_personality_states_differ` can turn the save into a 500. No race element and no race spell.
- Checked on ports 4003 / 5176: typecheck, `npm test` (50), `npm run test:e2e` (8 passed, smoke accounts in use). Lawful Good, Orphan, Solitary and Confident survived a reload. A second pick forced onto the same state was refused.
- Next is R4.8.

### 2026-11-20 — Cursor (R4.5 fix, after R4.6)
- Finished characters keep the old editor at `/characters/:id/edit-old`. The sheet Edit link goes there when `is_draft` is false. Drafts still use `/characters/:id/edit`.
- Role-tab saves and every traits save (rolls, placements, bonuses, gifts) are refused on a finished character until R4.9. The role tab shows a failed load instead of a blank page.
- Next is still R4.7.

### 2026-11-20 — Cursor (R4.6)
- Traits tab. `POST /api/characters/:id/stat-rolls` rolls one 4d6-drop-lowest (or resets placements / all 8 rolls). The traits save sends roll indexes, the +2, the +1, and gift ids. The server looks up the dice and writes the scores. Same stat may take both bonuses.
- Gift ids are stored inside `stat_rolls` (with the rolls and the placement). There is no gifts column, and this slice does not add one.
- PLACEHOLDER until `docs/DECISIONS.md`: rerolls are unlimited while `is_draft`, and refused after finish.
- Checked on ports 4003 / 5176: typecheck, `npm test` (48), `npm run test:e2e` (7 passed, smoke accounts in use). A saved Might score was the stored roll + 3, not a number sent by the browser. A repeated index and too many gifts were refused. After finish, another roll was refused.
- Next is R4.7.

### 2026-11-20 — Cursor (R4.5)
- Role & calling tab. `checkRoleTab` in `packages/rules`: a calling below level 3 is refused, skills must be exactly the role's list, feature picks are checked. Saving the header below level 3 clears the calling and its picks. The role's other picks stay.
- Choice features moved into `choiceFeaturesFor` / `checkChoicePicks` (`packages/rules`). The server and the old creator call those instead of keeping a second copy. Divine Blessing rows are still added by the server before the check, because they are not create-time features.
- Rune thumbnails: `node scripts/thumbs.js assets/glyphs/classes` (18 WebP files).
- No new placeholder. Checked on ports 4003 / 5176: typecheck, `npm test` (45), `npm run test:e2e` (6 passed, smoke accounts in use). A role save survived reload. Level 3→2 hid the calling. A hand-edited calling and a skill outside the list were refused.
- Next is R4.6.

### 2026-11-20 — Cursor (R4.4)
- Species & look tab: species, sub-species or variant, eye color, that species' sizes, optional look. The picture is an 88px WebP thumbnail; a tap shows the full PNG and a second tap closes it. Picking a sub-species switches the picture.
- `scripts/thumbs.js` (sharp) wrote 176px WebP copies to `assets/races/thumbs/` (44 files, about 1.6 KB each). The picker does not load the big PNGs until the picture is opened.
- No new placeholder. Sizes above Large were already refused by `sizeOptions` / `checkSpeciesTab`. Checked again with a hand-edited `size_id: 5` (Enormous) — the server answers 400.
- Checked on ports 4003 / 5176: typecheck, `npm test` (40), `npm run test:e2e` (5 passed, smoke accounts in use). A species save survived reload. A hand-edited size of Enormous was refused.
- Next is R4.5.

### 2026-11-20 — Cursor (R4.3)
- Form shell in `apps/web/src/features/character-form/`: header (name, level, portrait), five tabs in the URL (`?tab=`), `/characters/new` creates a draft and `/characters/:id/edit` edits it. Server errors show under Save.
- Old `/create_char` routes still work. `/characters/:id/edit` is the new form now, so the sheet's Edit link already opens it. The old editor files stay until R4.9.
- Checked on this worktree (ports 4003 / 5176): `npm run typecheck`, `npm test` (40), `npm run test:e2e` against `http://localhost:5176` — 4 passed. Smoke accounts were in use for that run. A draft survived a tab change and a reload; an empty name shows the server's error.
- Next is R4.4.

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
