# Character creator — spec (owner, 2026-11-19)

One unified form for **create and edit**. Edit mode = same tabs, everything open.
**Tabs open in any order**, in both create and edit.

Mockup: https://claude.ai/artifact/7j3ke94s1R4R5jZoSxQpsZ

## Persistent header (visible on every tab)

- Name
- Level
- Portrait
- Phone layout: compact — small portrait on the left, name + level on one row, one-line summary; labels hidden on phones

## Tabs (replace back/forward arrows)

- **Always 5 across, side by side, at every width.** Phones show short names: Species, Role, Traits, Persona, Gear.

**T1 — Species & look**
- Species, with its **artwork as a small thumbnail** (~88 px) beside the picker; tapping it expands the full art in place, tapping again closes it
- Sub-species; if the species has none, a **variant** (its color) from a **race-specific fixed list**
- **Picking a sub-species switches the art to that sub-species' image** (all 19 sub-species have art; Opal reuses the main Vellari image)
- Eye color — **fixed list**
- Size — **each species chooses between two sizes; nobody larger than Large**
- Look description (optional)

**T2 — Role & calling**
- Role, with its **class rune as a thumbnail** (~88 px) beside the selected role's name, hit die and primary stat; tapping it expands the rune in place. Each role in the list also shows a small rune icon. Runes: `assets/glyphs/classes/<role>.png` (512 px tiles; ~21 KB as thumbnails).
- Calling (only at level 3+; `SUBCLASS_LEVEL = 3` today)
- Skills, plus role/calling options

**T3 — Traits & gifts**
- Stat bonuses +2 and +1 — **same stat allowed** (rule change)
- Stat rolls: **8 individual rolls**, each with its own Roll button, showing the 4d6 dice with the lowest dropped and the total; then each result is placed into a stat of the player's choice. Two buttons: **Reset placements** (keeps the dice, clears where they went) and **Reset rolls** (clears all 8 so they can be rolled again). **The server rolls** (the mockup rolls in the browser only for show).
- Gifts (formerly "primordial blessings"; 27 in the content pack today), with a **"Choose N · M chosen"** counter driven by level; choices beyond N are disabled

**T4 — Personality**
- Alignment shown as the **real alignment chart** (Lawful Good … Chaotic Evil), not the color chart
- Upbringing
- Lifestyle
- Outlook
- **Removed:** race element and race spell

**T5 — Inventory**
- **Proficiencies window** at the top: armor, weapon groups and tools the role (+ calling) can use
- Weapon and armor pickers mark each option ✓ proficient / ✗ not, with a note under the current pick
- Items
- Money (new)
- **Auto default** button — fills **T5 only**, with the role/calling starting kit

## What the data already supports (checked 2026-11-19)

- `alignments` (9) already carry `code` LG…CE, `law_axis`, `good_axis` **and** their magic `color` → show the chart, keep the color mapping behind it for spells.
- `personality_options` (51): categories `upbringing` (19), `lifestyle` (16), `outlook` (16).
- `sizes` (6): Tiny, Small, Medium, Large, Enormous, Titanic; each species has a `size_id` (its default). Player choices cap at Large.
- Sub-species = `species` rows with `parent_id`; each has its own `image`.
- `primordial_blessings` (27) = gifts.
- Characters have **8** stats: Might, Precision, Endurance, Intellect, Judgment, Confidence, Speed, Luck.
- Species art: every species and sub-species has an `image` in `assets/races/` (~1–1.5 MB PNGs). Needs small WebP thumbnails (the mockup's are ~5 KB each).
- Class runes: `assets/glyphs/classes/` has one per role (plus legacy `paladin`/`druid` copies).
- Proficiencies: roles carry `armor_prof`, `weapon_prof`, `tool_prof` as text lists; weapons have `category_id` → `weapon_category` (Minor, Elegant One-Handed, …); armor has `armor_type` (light / medium / heavy / shield). Callings have the same prof fields, currently empty.
- Existing server roll endpoint: `POST /create_char/roll/:stat`.

## New data needed (JS migrations + content pack)

- Character columns: eye color, chosen size, look description, variant, money. Items already exist (`character_items`). Race element/spell columns retire.
- Content pack: per-species **two size options**, per-species **variant colors**, **eye color** list, species / sub-species / rune **thumbnails**.

## Still to define

- Which two sizes each species may choose.
- The variant color list for each species without sub-species, and the eye color list.
- Money: currency name(s) and starting amount.
- Gifts: **how many by level** (mockup shows an example: 1, +1 at level 4 and 8), and prerequisites (blessings list some).
- Whether callings add proficiencies (fields exist, all empty today).
- Rerolling: is "Reset rolls" unlimited, or limited (e.g. once, or DM-approved)?
