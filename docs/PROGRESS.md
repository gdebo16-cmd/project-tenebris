# Progress — handoff between AIs

Every AI reads this first and adds a Log entry last. Newest entry on top.

## Now

- **Stage 1, native rebuild:** R1–R3 done (R3 = commit `2d5c775`). R4 is ready for Gabriel to merge from `bot/cursor`.
- **In progress:** Claude — R5 (sheet blocks), on bot/claude in tenebris-claude. Cursor — R4 review items 4–7 (form header, layout, mockup controls).

## Next

- Gabriel merges R4. R5 (sheet blocks) waits — ask before any migration.

## Status by step

See `docs/CHECKLIST.md` — the one place steps get ticked off.

## Log

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
