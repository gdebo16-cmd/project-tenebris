# Progress — handoff between AIs

Every AI reads this first and adds a Log entry last. Newest entry on top.

## Now

- **Stage 1, native rebuild:** R1–R3 done (R3 = commit `2d5c775`). R4 is ready for Gabriel to merge from `bot/cursor`.
- **In progress:** Cursor — R4 review fixes (level cap, then level-up, role/traits, then the form layout). R5 is not started.

## Next

- Gabriel merges R4. R5 (sheet blocks) waits — ask before any migration.

## Status by step

See `docs/CHECKLIST.md` — the one place steps get ticked off.

## Log

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
