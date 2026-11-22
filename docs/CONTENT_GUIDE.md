# Content Guide

Tenebris keeps **game content** (species, roles, callings, features, spells, gear, runes, monsters) in a JSON content pack in the repo, and **player data** (users, characters, inventory, campaigns) in Postgres. The server reads all game content from the pack. There are no content tables in the database.

## What lives where

| What | Edit this | Built into |
|------|-----------|------------|
| Everything except spells | `packages/content/source/<section>.json` | `packages/content/content.json` |
| Spells, upcasts, spell slots, bonus spells, spell element/state/alignment/bands | `packages/content/source/<section>.json` | `packages/content/spells.json` |
| Looks (appearance options) | `packages/content/looks.json` | (read directly) |

Each file in `source/` is one section of the built file, written exactly as the server reads it. For example `source/species.json` becomes the `species` list in `content.json`, joined-in fields (such as a species' size name) included.

**Do not hand-edit `content.json` or `spells.json`.** They are rebuilt from `source/`.

## How to edit or add content

1. Edit the matching file in `packages/content/source/`.
2. **Keep ids and keys stable.** Characters point at these ids. Renaming a display `name` is fine; changing an `id` or `key`, or reusing one, is not.
3. **New content** gets a new, unused id (and a unique `key` where the section has keys). Never renumber old rows.
4. **Removing content:** don't delete an id a character still uses. Stop offering it instead, until player data is cleaned up.
5. **New section:** add the file to `source/` and its name to `CONTENT_SECTIONS` or `SPELL_SECTIONS` in `packages/content/build.ts`. The build stops with an error if a file in `source/` is in neither list.

## Build

From the repo root:

```bash
npm run content:build
```

This writes `content.json` and `spells.json`. Commit the source files **and** the built files: the server reads the built files from the repo.

## Test

1. `npm run content:build`
2. Restart the server, then check the character form, the sheet, spells and inventory.
3. `npm test` for the rules package.

## When a migration is needed

Only when **player** tables change (columns, constraints, backfills). Changing content never needs a migration, as long as ids stay stable. Migrations are JavaScript files in `db/migrations/` (`npm run migrate:create -- <name>`), and they run on `rework` only with Gabriel's OK.
