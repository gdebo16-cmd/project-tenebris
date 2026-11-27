# Tenebris web app restructure (MAJ-30)

Batches 1–11, 14–16 have landed as local commits on `main` (not pushed). Batches 12 and 13 were skipped (see below). Goal: **reusable parts in `components/<featureType>/`**, **pages and build files (plus hooks, queries, types) in `features/<section>/`**, **all CSS under `src/styles/` mirroring those two trees exactly**, and **one runtime asset home**. No new inline styles (keep the few that already exist: toolbar swatch thumbs, sheet layout CSS variables). No new libraries. No `index.ts` barrels (they caused import cycles in the table toolbar work).

Today `apps/web/src` is mixed: a flat `pages/` of fat route files, a useful `features/` that still holds both pages and reusable parts, and a catch-all `components/` for the shell and a few widgets. CSS Modules sit next to components (two global files already live in `src/styles/`). Images and models live in several places. The table feature is already in domain folders after the toolbar split. Character and monster sheets are already block-based.

---

## Where do I find X

- A route page (table, login, campaign, sheet, dice…) → `features/<section>/` (the page and any build file that assembles it, plus hooks, queries, types)
- That page’s looks → `styles/features/<section>/…/PageName.module.css`
- A reusable part (toolbar button, sheet block, inventory row, form tab) → `components/<featureType>/`
- That part’s looks → `styles/components/<featureType>/…/ComponentName.module.css`
- Toolbar → `components/table/toolbar/Toolbar.tsx`
- Toolbar looks → `styles/components/table/toolbar/Toolbar.module.css`
- Toolbar button → `components/table/toolbar/parts/ToolButton.tsx`
- Toolbar button looks → still `styles/components/table/toolbar/Toolbar.module.css` (parts share the toolbar sheet; a later split would give `parts/ToolButton.module.css`)
- Shared UI primitives (Button, ToggleButton, ButtonRow, Field, Section) → `components/ui/`
- Board 3D pieces → `components/table/board/`
- Hex math (`hexToWorld`, `worldToHex`, `HEIGHT_STEP`, `liftOf`, rims) → `components/table/board/ground/hexMath.ts` (re-exported from `TableScenery.tsx`)
- Table hooks, queries, types → `features/table/hooks/`
- Sheet Fit (zoom-to-fill; keeps existing CSS-variable / zoom inline styles) → `components/sheets/Fit.tsx` (looks stay in `SheetLayout.module.css`)
- Sheet health block → `components/sheets/blocks/HealthBlock.tsx`
- Sheet health looks → `styles/components/sheets/blocks/HealthBlock.module.css`
- Character / monster sheet pages → `features/sheets/CharacterSheetPage.tsx`, `MonsterSheetPage.tsx`
- App chrome (sidebar, login gate, settings) → `components/layout/`
- Theme / global CSS → `styles/themes/`, `styles/base/`
- Images, models, HDRIs, icons → repo-root `assets/` served at the site root (`Vite publicDir`)
- Logos, favicon, toolbar SVGs → `assets/icons/` and `assets/icons/toolbar/` (`/icons/Logo.png`, `/icons/toolbar/…`)
- Theme backgrounds and sketches → `assets/images/backgrounds/`, `assets/images/sketches/` (default portrait: `/images/default-character.png`)
- HDRIs → `assets/hdri/` (`/hdri/…`; was `/textures/hdris/`)
- Models and paint textures → still `assets/models/` and `assets/textures/` (`/models/…`, `/textures/…`)

---

## Naming rules

- Folders are lowercase. Multi-word folders use kebab-case (`character-form`, not `characterForm` or `CharacterForm`). The current `features/sheet/` folder is renamed to `sheets` (a real name change, done with `git mv`, not a case-only rename).
- Component and page files are PascalCase: `ToolButton.tsx`, `HealthBlock.tsx`, `LoginPage.jsx`.
- A component’s CSS file uses the **same base name** and lives at the **mirrored path** under `styles/`. `components/table/toolbar/parts/ToolButton.tsx` ↔ `styles/components/table/toolbar/parts/ToolButton.module.css`. `features/table/pages/TablePage.tsx` ↔ `styles/features/table/pages/TablePage.module.css`.
- Hooks, queries, and types stay descriptive camelCase: `useTableController.ts`, `tableQueries.ts`, `toolbarTypes.ts`. They live in `features/<section>/`, not under `components/`.
- No `index.ts` barrels.
- Never rename a file only by case — the Linux (Render) build is case-sensitive.
- Exceptions already in the tree, left until a later split: `Settings.module.css` is shared by the three settings screens; `Sheet.module.css` is shared sheet chrome; `CharacterSheetPage.module.css` is also imported by the monster and DM pages; `TablePage.module.css` is also imported by `BoardActs`; toolbar `parts/` still share `Toolbar.module.css` (and some share `TableControls.module.css`). New CSS follows one-file-per-component. `dice.module.css` is renamed to `DiceLab.module.css` when it moves, so it matches `DiceLab.tsx`.

---

## 1. Target tree

`components/<featureType>/` holds reusable parts for that domain. `features/<section>/` holds only that section’s page and build files, plus hooks, queries, and types. **`styles/` mirrors `components/` and `features/` exactly** (`styles/components/…`, `styles/features/…`). Global CSS that has no component file sits in `styles/base/` and `styles/themes/`. No CSS remains beside TS/JS. Leave `main.jsx`, `App.jsx`, `api.ts`, `queryClient.ts`, `queries.ts`, `hooks/`, and `utils/` at `src/` until a later optional cleanup.

Do not pre-create empty `components/auth/`, `components/home/`, `components/campaign/`, or `components/dice/` (or their `styles/` mirrors) until a split actually lands a file there.

The one runtime asset home is repo-root **`assets/`**. Vite is already set to `publicDir: '../../assets'` in `apps/web/vite.config.js`. There is no `public/` directory today. A second asset root is not required: URL-loaded files already live in that `publicDir`, and the only imported art (nine toolbar SVGs) can move to `assets/icons/toolbar/` and be referenced as `/icons/toolbar/…`.

```
apps/web/src/
  main.jsx, App.jsx, api.ts, queryClient.ts, queries.ts
  hooks/, utils/, data/
  styles/
    base/                              # reset, fonts, globals (today: base.css)
    themes/                            # theme, display, background variables
    components/
      ui/
      layout/
        settings/
      sheets/
        blocks/
      character-form/
        tabs/
      inventory/
      table/
        toolbar/parts/, toolbar/panels/
        panels/
        board/tokens/                  # plus ground, lighting, models, … as CSS appears
      dm/
      # auth/, home/, campaign/, dice/  — created when the first reusable part lands
    features/
      auth/
      home/
      campaign/
      sheets/
      character-form/
      inventory/
      table/
        pages/
      dice/
      dm/
  components/
    ui/                                # Loader, Tabs, filters; later Button, Field, …
    layout/                            # AppLayout, RequireLogin, Sidebar*, settings
    sheets/
      blocks/                          # HealthBlock, ActionsBlock, registry, …
      LayoutEditor.tsx
      SheetLayout.tsx
    character-form/
      tabs/                            # Gear, Role, Species, Traits, Personality
      FormHeader.tsx, FormTabs.tsx
    inventory/                         # ItemShop, ItemDetails; later rows/filters
    table/
      toolbar/                         # Toolbar, TableControls, BoardSize, Act/Shape panels
        parts/, panels/
      panels/                          # BoardLibrary, Feed, TablePanels, TurnBar
      board/                           # Camera, Canvas, HexGrid, ground, lighting, …
        ground/, lighting/, models/, moments/, overlays/, tokens/
    dm/                                # DmBlocks, DmContext
    # auth/, home/, campaign/, dice/   — created when splits land
  features/
    auth/                              # LoginPage, RegisterPage
    home/                              # HomePage
    campaign/                          # CampaignPage, List, Create, Join, campaignImages
    sheets/                            # CharacterSheetPage, MonsterSheetPage,
                                       # queries, layouts, sheetTools, types
    character-form/                    # CharacterForm (the route/build file), queries, types
    inventory/                         # InventoryPage
    table/
      pages/                           # TablePage, MapEditorPage  (lazy paths stay)
      hooks/                           # hooks, queries, utils, tableTypes, toolbarTypes
    dice/                              # DiceLab
    dm/                                # DmPage, dmQueries

assets/                                # THE runtime asset home (Vite publicDir)
  icons/                               # Logo, favicon, PWA, toolbar SVGs
  images/
    backgrounds/
    campaigns/
    themes/
    sketches/
  models/                              # URL /models/… stays
  textures/                            # ground paints, URL /textures/… stays
  hdri/                                # from assets/textures/hdris
  fonts/                               # reserved (fonts are Google-hosted today)
  glyphs/, portraits/, races/, classes/, subclasses/
  manifest.webmanifest                 # stays at the public root
```

`components/ui/` is still seeded from toolbar `parts/`, then filled with primitives the rest of the app already repeats (`Button`, `ToggleButton`, `ButtonRow`, `Section`, `Field`, `Tabs`, `Loader`, `FilterBar`, `Confirm`, `PageHeader`). Their CSS lives in `styles/components/ui/`. Toolbar parts remain in `components/table/toolbar/parts/` as thin wrappers that pass existing toolbar classes so the board toolbar looks identical.

Large components split as in §5. Large CSS files split later **under the same mirrored `styles/` path** (do not invent a second CSS tree).

---

## 2. Move map (JS/TS and CSS)

Binary files under `src/assets/` and toolbar SVGs are in the asset map (§4), not here. Empty `components/classes/warrior.jsx` (0 bytes, unused) is deleted in cleanup, not moved. CSS paths are omitted only when a file has no stylesheet of its own (it keeps importing a shared module, as noted in Naming rules).

### Stay at `src/` (for now)

| Current | New |
| --- | --- |
| `main.jsx` | stay (imports become `./styles/themes/themes.css` and `./styles/base/base.css`) |
| `App.jsx` | stay (imports updated as batches land; lazy table/dice paths stay under `features/`) |
| `api.ts`, `queryClient.ts`, `queries.ts` | stay |
| `hooks/*` | stay |
| `utils/api.js`, `utils/armor.js`, `utils/socket.js`, `utils/weapons.js` | stay |
| `data/campaignImages.js` | `features/campaign/campaignImages.js` in the campaign page batch |

### Global CSS

| Current | New |
| --- | --- |
| `styles/base.css` | `styles/base/base.css` (optional later split: `reset.css`, `globals.css` — only 36 lines today) |
| `styles/themes.css` | `styles/themes/themes.css` (later fine split by the existing `#region`s) |

### `components/ui/` and `components/layout/`

| Current | New file | New CSS |
| --- | --- | --- |
| `components/Loader.jsx` | `components/ui/Loader.jsx` | `styles/components/ui/Loader.module.css` |
| `components/TabList.jsx` | `components/ui/TabList.jsx` (keep the filename; optional later rename to `Tabs.jsx` + `Tabs.module.css`) | `styles/components/ui/TabList.module.css` |
| `components/CampfireIcon.tsx` | `components/ui/CampfireIcon.tsx` | — |
| `components/ArmorFilter.jsx` | `components/ui/ArmorFilter.jsx` | — |
| `components/WeaponFilter.jsx` | `components/ui/WeaponFilter.jsx` | — |
| `components/AppLayout.jsx` | `components/layout/AppLayout.jsx` | — |
| `components/RequireLogin.jsx` | `components/layout/RequireLogin.jsx` | — |
| `components/Sidebar.jsx` | `components/layout/Sidebar.jsx` | `styles/components/layout/Sidebar.module.css` |
| `components/SidebarCampaign.jsx` | `components/layout/SidebarCampaign.jsx` | — |
| `components/SidebarCharacter.jsx` | `components/layout/SidebarCharacter.jsx` | — |
| `components/SidebarSheetLayout.jsx` | `components/layout/SidebarSheetLayout.jsx` | — |
| `components/LogoutLink.jsx` | `components/layout/LogoutLink.jsx` | — |
| `components/ThemePicker.jsx` | `components/layout/ThemePicker.jsx` | — |
| `components/settings/AccountSettings.jsx` | `components/layout/settings/AccountSettings.jsx` | shared `styles/components/layout/settings/Settings.module.css` |
| `components/settings/GraphicsSettings.jsx` | `components/layout/settings/GraphicsSettings.jsx` | same shared file |
| `components/settings/LookSettings.jsx` | `components/layout/settings/LookSettings.jsx` | same shared file |
| `components/classes/warrior.jsx` | delete in cleanup | — |

### Pages now in `pages/` → `features/<section>/` (not reusable parts)

| Current | New file | New CSS |
| --- | --- | --- |
| `pages/LoginPage.jsx` | `features/auth/LoginPage.jsx` | `styles/features/auth/LoginPage.module.css` |
| `pages/RegisterPage.jsx` | `features/auth/RegisterPage.jsx` | `styles/features/auth/RegisterPage.module.css` |
| `pages/HomePage.jsx` | `features/home/HomePage.jsx` | `styles/features/home/HomePage.module.css` |
| `pages/CampaignPage.jsx` | `features/campaign/CampaignPage.jsx` | `styles/features/campaign/CampaignPage.module.css` |
| `pages/CampaignList.jsx` | `features/campaign/CampaignList.jsx` | `styles/features/campaign/CampaignList.module.css` |
| `pages/CreateCampaign.jsx` | `features/campaign/CreateCampaign.jsx` | `styles/features/campaign/CreateCampaign.module.css` |
| `pages/JoinCampaign.jsx` | `features/campaign/JoinCampaign.jsx` | `styles/features/campaign/JoinCampaign.module.css` |
| `pages/InventoryPage.jsx` | `features/inventory/InventoryPage.jsx` | `styles/features/inventory/InventoryPage.module.css` |

After each move, `App.jsx` imports the new path. Do not leave stale `pages/` copies. Later splits of these pages (tiles, headers, member lists) land in `components/home/`, `components/campaign/`, `components/auth/` with CSS under `styles/components/…`.

### Sheets (`features/sheet/` → `features/sheets/` + `components/sheets/`)

| Current | New file | New CSS |
| --- | --- | --- |
| `features/sheet/CharacterSheetPage.tsx` | `features/sheets/CharacterSheetPage.tsx` | `styles/features/sheets/CharacterSheetPage.module.css` (also imported by Monster + DM pages today) |
| `features/sheet/MonsterSheetPage.tsx` | `features/sheets/MonsterSheetPage.tsx` | — (uses the page CSS above) |
| `features/sheet/queries.ts` | `features/sheets/queries.ts` | — |
| `features/sheet/monsterQueries.ts` | `features/sheets/monsterQueries.ts` | — |
| `features/sheet/layouts.ts` | `features/sheets/layouts.ts` | — |
| `features/sheet/layoutEvents.ts` | `features/sheets/layoutEvents.ts` | — |
| `features/sheet/sheetTools.ts` | `features/sheets/sheetTools.ts` | — |
| `features/sheet/blocks/types.ts` | `features/sheets/types.ts` | — |
| `features/sheet/SheetLayout.tsx` | `components/sheets/SheetLayout.tsx` | `styles/components/sheets/SheetLayout.module.css` |
| `features/sheet/Sheet.module.css` | (no TS file) | `styles/components/sheets/Sheet.module.css` (shared chrome) |
| `features/sheet/LayoutEditor.tsx` | `components/sheets/LayoutEditor.tsx` | — (uses Sheet + SheetLayout CSS) |
| `features/sheet/blocks/ActionPanel.tsx` | `components/sheets/blocks/ActionPanel.tsx` | `styles/components/sheets/blocks/ActionPanel.module.css` |
| `features/sheet/blocks/ActionsBlock.tsx` | `components/sheets/blocks/ActionsBlock.tsx` | `styles/components/sheets/blocks/ActionsBlock.module.css` |
| `features/sheet/blocks/ConditionsBlock.tsx` | `components/sheets/blocks/ConditionsBlock.tsx` | `styles/components/sheets/blocks/ConditionsBlock.module.css` |
| `features/sheet/blocks/CoreStatsBlock.tsx` | `components/sheets/blocks/CoreStatsBlock.tsx` | `styles/components/sheets/blocks/CoreStatsBlock.module.css` |
| `features/sheet/blocks/details.tsx` | `components/sheets/blocks/details.tsx` (split later into PascalCase files) | — |
| `features/sheet/blocks/DetailsPanel.tsx` | `components/sheets/blocks/DetailsPanel.tsx` | `styles/components/sheets/blocks/DetailsPanel.module.css` |
| `features/sheet/blocks/FeaturesBlock.tsx` | `components/sheets/blocks/FeaturesBlock.tsx` | `styles/components/sheets/blocks/FeaturesBlock.module.css` |
| `features/sheet/blocks/HealthBlock.tsx` | `components/sheets/blocks/HealthBlock.tsx` | `styles/components/sheets/blocks/HealthBlock.module.css` |
| `features/sheet/blocks/InventoryBlock.tsx` | `components/sheets/blocks/InventoryBlock.tsx` | `styles/components/sheets/blocks/InventoryBlock.module.css` |
| `features/sheet/blocks/LegendaryBlock.tsx` | `components/sheets/blocks/LegendaryBlock.tsx` | `styles/components/sheets/blocks/LegendaryBlock.module.css` |
| `features/sheet/blocks/PurseBlock.tsx` | `components/sheets/blocks/PurseBlock.tsx` | `styles/components/sheets/blocks/PurseBlock.module.css` |
| `features/sheet/blocks/registry.tsx` | `components/sheets/blocks/registry.tsx` | — |
| `features/sheet/blocks/registry-draft.txt` | `components/sheets/blocks/registry-draft.txt` | — |
| `features/sheet/blocks/RestBlock.tsx` | `components/sheets/blocks/RestBlock.tsx` | `styles/components/sheets/blocks/RestBlock.module.css` |
| `features/sheet/blocks/RollFeed.tsx` | `components/sheets/blocks/RollFeed.tsx` | `styles/components/sheets/blocks/RollFeed.module.css` |
| `features/sheet/blocks/RollOrb.tsx` | `components/sheets/blocks/RollOrb.tsx` | `styles/components/sheets/blocks/RollOrb.module.css` |
| `features/sheet/blocks/RuneControl.tsx` | `components/sheets/blocks/RuneControl.tsx` | `styles/components/sheets/blocks/RuneControl.module.css` |
| `features/sheet/blocks/SheetContext.tsx` | `components/sheets/blocks/SheetContext.tsx` | — |
| `features/sheet/blocks/SheetHeader.tsx` | `components/sheets/blocks/SheetHeader.tsx` | `styles/components/sheets/blocks/SheetHeader.module.css` |
| `features/sheet/blocks/SkillsBlock.tsx` | `components/sheets/blocks/SkillsBlock.tsx` | `styles/components/sheets/blocks/SkillsBlock.module.css` |
| `features/sheet/blocks/SpellBookBlock.tsx` | `components/sheets/blocks/SpellBookBlock.tsx` | `styles/components/sheets/blocks/SpellBookBlock.module.css` |
| `features/sheet/blocks/SpellsBlock.tsx` | `components/sheets/blocks/SpellsBlock.tsx` | `styles/components/sheets/blocks/SpellsBlock.module.css` |
| `features/sheet/blocks/StatsBlock.tsx` | `components/sheets/blocks/StatsBlock.tsx` | `styles/components/sheets/blocks/StatsBlock.module.css` |
| `features/sheet/blocks/TraitsBlock.tsx` | `components/sheets/blocks/TraitsBlock.tsx` | `styles/components/sheets/blocks/TraitsBlock.module.css` |
| `features/sheet/blocks/CharacterSheetPage.module.css` | **do not move a second copy.** Not imported (the live file is `features/sheet/CharacterSheetPage.module.css`). Confirm unused, then delete. | — |

### Character form

| Current | New file | New CSS |
| --- | --- | --- |
| `features/character-form/CharacterForm.tsx` | stay in `features/character-form/CharacterForm.tsx` (route/build file, imported by `App.jsx`) | `styles/features/character-form/CharacterForm.module.css` (also imported by the tabs today) |
| `features/character-form/queries.ts` | stay | — |
| `features/character-form/types.ts` | stay | — |
| `features/character-form/FormHeader.tsx` | `components/character-form/FormHeader.tsx` | — |
| `features/character-form/FormTabs.tsx` | `components/character-form/FormTabs.tsx` | — |
| `features/character-form/tabs/GearTab.tsx` | `components/character-form/tabs/GearTab.tsx` | `styles/components/character-form/tabs/GearTab.module.css` |
| `features/character-form/tabs/PersonalityTab.tsx` | `components/character-form/tabs/PersonalityTab.tsx` | `styles/components/character-form/tabs/PersonalityTab.module.css` |
| `features/character-form/tabs/RoleTab.tsx` | `components/character-form/tabs/RoleTab.tsx` | `styles/components/character-form/tabs/RoleTab.module.css` |
| `features/character-form/tabs/SpeciesTab.tsx` | `components/character-form/tabs/SpeciesTab.tsx` | `styles/components/character-form/tabs/SpeciesTab.module.css` |
| `features/character-form/tabs/TraitsTab.tsx` | `components/character-form/tabs/TraitsTab.tsx` | `styles/components/character-form/tabs/TraitsTab.module.css` |

### Inventory, dice, DM

| Current | New file | New CSS |
| --- | --- | --- |
| `features/inventory/ItemShop.jsx` | `components/inventory/ItemShop.jsx` | `styles/components/inventory/ItemShop.module.css` |
| `features/inventory/ItemDetails.jsx` | `components/inventory/ItemDetails.jsx` | `styles/components/inventory/ItemDetails.module.css` |
| `features/dice/DiceLab.tsx` | stay in `features/dice/DiceLab.tsx` (lazy route) | `styles/features/dice/DiceLab.module.css` (**renamed** from `dice.module.css`) |
| `features/dm/DmPage.tsx` | stay in `features/dm/DmPage.tsx` | `styles/features/dm/DmPage.module.css` |
| `features/dm/dmQueries.ts` | stay | — |
| `features/dm/DmBlocks.tsx` | `components/dm/DmBlocks.tsx` | — (uses sheet + DM page CSS as today) |
| `features/dm/DmContext.tsx` | `components/dm/DmContext.tsx` | — |

Later dice splits (`PhysicsDie`, `DicePicker`) go to `components/dice/` with CSS under `styles/components/dice/`.

### Table — pages, hooks, types stay; reusable parts move

| Current | New file | New CSS |
| --- | --- | --- |
| `features/table/pages/TablePage.tsx` | stay | `styles/features/table/pages/TablePage.module.css` (also imported by `BoardActs`) |
| `features/table/pages/MapEditorPage.tsx` | stay | — |
| `features/table/hooks/*` (graphicsSettings, tableDebug, tableQueries, tableTypes, tableUtils, useTableController) | stay in `features/table/hooks/` | — |
| `features/table/toolbar/toolbarTypes.ts` | `features/table/hooks/toolbarTypes.ts` | — |
| `features/table/toolbar/Toolbar.tsx` | `components/table/toolbar/Toolbar.tsx` | `styles/components/table/toolbar/Toolbar.module.css` (do not normalize line endings) |
| `features/table/toolbar/TableControls.tsx` | *(filename is CSS + consumers; the module is `TableControls.module.css`)* — keep the CSS with toolbar; no `TableControls.tsx` exists | `styles/components/table/toolbar/TableControls.module.css` |
| `features/table/toolbar/BoardSize.tsx` | `components/table/toolbar/BoardSize.tsx` | `styles/components/table/toolbar/BoardSize.module.css` |
| `features/table/toolbar/ActPanel.tsx` | `components/table/toolbar/ActPanel.tsx` | — |
| `features/table/toolbar/ShapePanels.tsx` | `components/table/toolbar/ShapePanels.tsx` | — |
| `features/table/toolbar/parts/*.tsx` (ActionButton, ButtonRow, Field, Section, ShapesRow, StatusLine, ToggleButton, ToolButton, ToolParts) | `components/table/toolbar/parts/` (same names) | still `Toolbar.module.css` / `TableControls.module.css` until a later per-part split |
| `features/table/toolbar/panels/EffectsPanel.tsx` | `components/table/toolbar/panels/EffectsPanel.tsx` | — |
| `features/table/toolbar/panels/ObjectsPanel.tsx` | `components/table/toolbar/panels/ObjectsPanel.tsx` | — |
| `features/table/toolbar/panels/PaintPanel.tsx` | `components/table/toolbar/panels/PaintPanel.tsx` | — |
| `features/table/toolbar/panels/RemovePanel.tsx` | `components/table/toolbar/panels/RemovePanel.tsx` | — |
| `features/table/toolbar/panels/ScenePanel.tsx` | `components/table/toolbar/panels/ScenePanel.tsx` | — |
| `features/table/toolbar/icons/*.svg` | not a component move — see asset map, `assets/icons/toolbar/` | — |
| `features/table/panels/BoardLibrary.tsx` | `components/table/panels/BoardLibrary.tsx` | `styles/components/table/panels/BoardLibrary.module.css` |
| `features/table/panels/Feed.tsx` | `components/table/panels/Feed.tsx` | `styles/components/table/panels/Feed.module.css` |
| `features/table/panels/TablePanels.tsx` | `components/table/panels/TablePanels.tsx` | `styles/components/table/panels/TablePanels.module.css` |
| `features/table/panels/TurnBar.tsx` | `components/table/panels/TurnBar.tsx` | `styles/components/table/panels/TurnBar.module.css` |
| `features/table/board/BoardCamera.tsx` | `components/table/board/BoardCamera.tsx` | — |
| `features/table/board/BoardCanvas.tsx` | `components/table/board/BoardCanvas.tsx` | — |
| `features/table/board/FrameWatch.tsx` | `components/table/board/FrameWatch.tsx` | — |
| `features/table/board/HexGrid.tsx` | `components/table/board/HexGrid.tsx` | — |
| `features/table/board/HoverLayer.tsx` | `components/table/board/HoverLayer.tsx` | — |
| `features/table/board/ground/boardLooks.ts` | `components/table/board/ground/boardLooks.ts` | — |
| `features/table/board/ground/groundTextures.ts` | `components/table/board/ground/groundTextures.ts` | — |
| `features/table/board/ground/TableNatural.tsx` | `components/table/board/ground/TableNatural.tsx` | — |
| `features/table/board/ground/TableScenery.tsx` | `components/table/board/ground/TableScenery.tsx` | — |
| `features/table/board/lighting/BoardAtmosphere.tsx` | `components/table/board/lighting/BoardAtmosphere.tsx` | — |
| `features/table/board/lighting/BoardWorld.tsx` | `components/table/board/lighting/BoardWorld.tsx` | — |
| `features/table/board/models/BoardFeatures.tsx` | `components/table/board/models/BoardFeatures.tsx` | — |
| `features/table/board/models/BoardModels.tsx` | `components/table/board/models/BoardModels.tsx` | — |
| `features/table/board/moments/BoardMoments.tsx` | `components/table/board/moments/BoardMoments.tsx` | — |
| `features/table/board/overlays/BoardActs.tsx` | `components/table/board/overlays/BoardActs.tsx` | — (imports `TablePage.module.css`) |
| `features/table/board/tokens/TokenOnBoard.tsx` | `components/table/board/tokens/TokenOnBoard.tsx` | `styles/components/table/board/tokens/TokenOnBoard.module.css` |

---

## 3. CSS-only recap

Every current stylesheet is in the tables above. After the CSS batches, **none** remain beside components and the two globals have moved into `styles/base/` and `styles/themes/`. Components import from the mirrored path, e.g. `import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'`.

Do not normalize `Toolbar.module.css` line endings when moving it.

---

## 4. Assets: one home

Unchanged in substance from the previous revision. Short recap; the full move map stays below.

### Where they live today

| Location | What it is |
| --- | --- |
| **`assets/`** (repo root) | Vite `publicDir`. Already the runtime home. Served as `/Logo.png`, `/models/…`, `/textures/…`, `/glyphs/…`, `/icons/icon-192.png`, etc. The production server serves Vite’s `dist/` copy of this folder. |
| **`assets/` root files** | A junk drawer: Logo, favicon, manifest, `default-character.png`, ~40 `eldrid-bg-*.webp` backgrounds, a couple of sketches. |
| **`assets/models/`**, **`assets/textures/`** | Board GLBs and ground paints. URLs `/models/…` and `/textures/…`. HDRIs are tucked under `assets/textures/hdris/`. |
| **`assets/glyphs/`, `portraits/`, `races/`, `classes/`, `subclasses/`, `campaigns/`** | Character-form and campaign art, already typed. |
| **`assets/icons/`** | PWA icons only. Logo still sits at the root. |
| **`assets/images/themes/`** | Extra theme backgrounds. |
| **`assets/utils/`** | Ten sketch/map PNGs **used at runtime** by `themes.css` (`url('/utils/mapblack1.png')`, etc.). |
| **`apps/web/src/assets/`** | Byte-identical copies of those ten PNGs, plus unused `colorsketch-eldrid-*.jpg` / `.webp`. **No JS import references this folder.** |
| **`features/table/toolbar/icons/`** | Nine SVGs *imported as modules* by `Toolbar.tsx`. |
| **`texture-sources/`** | Local editor/source work. **Not a runtime asset tree.** Do not put it in `assets/`. |

Fonts are loaded from Google in `apps/web/index.html`. There are no `.woff`/`.ttf` files in the repo.

### Constraint (one sentence)

URL-loaded files (GLB models, HDRIs, textures, logos, theme backgrounds, PWA icons) must live in Vite’s `publicDir` — already repo-root `assets/` — because `models:check`, `textures:check`, the library manifest, and the board load them by site-root paths like `/models/…` and `/textures/…`; imported modules could live under `src/`, but the only imported art today is the nine toolbar SVGs, which can move into `assets/icons/toolbar/` and be referenced as `/icons/toolbar/Effects.svg`, so **a second root is not required**.

### Asset move map

Keep `/models/…` and `/textures/…` (paints) stable so `packages/rules` model files, `content.json`, `scripts/generate-library.mjs`, and `models:check` do not need a path-prefix change.

| Current | New | URL after |
| --- | --- | --- |
| `assets/models/<id>/…` | stay | `/models/<id>/…` (unchanged) |
| `assets/textures/library/…`, `surfaces/`, `terrain/`, `felt/`, `wood/`, `wall/`, `ice/`, `CREDITS.md` | stay | `/textures/…` (unchanged) |
| `assets/textures/hdris/day/sky.hdr` (and dawn, dusk, night, dungeon) | `assets/hdri/day/sky.hdr` (same for each mood) | `/hdri/day/sky.hdr` |
| `assets/glyphs/**`, `portraits/**`, `races/**`, `classes/**`, `subclasses/**`, `campaigns/**` | stay | unchanged |
| `assets/images/themes/**` | stay | `/images/themes/…` |
| `assets/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | stay | `/icons/…` |
| `assets/Logo.png` | `assets/icons/Logo.png` | `/icons/Logo.png` |
| `assets/logo_banner.png` | `assets/icons/logo_banner.png` | `/icons/logo_banner.png` |
| `assets/favicon.svg`, `assets/icons.svg` | `assets/icons/` | `/icons/favicon.svg`, `/icons/icons.svg` |
| `assets/manifest.webmanifest` | stay at `assets/` root | `/manifest.webmanifest` |
| `assets/default-character.png` | `assets/images/default-character.png` | `/images/default-character.png` |
| `assets/colorsketch-eldrid-*.webp`, `assets/eldrid-bg-*.webp`, `assets/snowstuff.webp`, `assets/topdowncabin.webp` | `assets/images/backgrounds/` | `/images/backgrounds/…` |
| `assets/utils/*.png` (10 files, including `Vaelith.png`, `mapblack1.png`, …) | `assets/images/sketches/` | `/images/sketches/mapblack1.png` etc. |
| `apps/web/src/assets/*` | delete (duplicates; webps already at `assets/` root; jpgs unused) | — |
| `features/table/toolbar/icons/*.svg` (9 files) | `assets/icons/toolbar/` | `/icons/toolbar/Effects.svg` etc. |

**Code and script updates in the same batch:** `apps/web/index.html` (`/Logo.png` → `/icons/Logo.png`); every page/CSS logo and `url('/logo_banner.png')`; theme CSS `/utils/…` and `/colorsketch-eldrid-….webp`; `/default-character.png` → `/images/default-character.png`; `BoardAtmosphere.tsx` `/textures/hdris/<mood>/sky.hdr` → `/hdri/<mood>/sky.hdr`; `Toolbar.tsx` uses `/icons/toolbar/…` instead of module imports. Leave `publicDir: '../../assets'`, `/models/`, `/textures/` (paints), and therefore the library manifest, `modelsLibrary.ts`, `content.json`, `generate-library.mjs`, and the `models:check` folder prefix unchanged. `check-textures.mjs` still serves `assets/` and `/textures/…`. Import/bake scripts still write `assets/models` and `assets/textures`. Do not copy `texture-sources/` into `assets/`.

---

## 5. Big files to split

Line counts are physical lines as of the original inventory. New pieces land in `components/<featureType>/`; the page or build file stays in `features/`.

| File (after the move) | Lines | Split into |
| --- | --- | --- |
| `components/table/board/ground/TableScenery.tsx` | 538 | `hexMath.ts` first, then `Terrain.tsx`, `Tabletop.tsx` (same folder) |
| `components/table/board/ground/TableNatural.tsx` | 399 | Leave unless a later split is needed |
| `components/sheets/blocks/ActionsBlock.tsx` | 340 | `WeaponActions`, `SpellActions`, `BonusActions`, `ReactionActions` in `components/sheets/blocks/`; `ActionsBlock` assembles them |
| `components/sheets/SheetLayout.tsx` | 329 | `Fit.tsx`, `SheetGrid.tsx` (same folder) |
| `features/table/hooks/tableQueries.ts` | 304 | Optional later; skip until UI batches are done |
| `components/character-form/tabs/RoleTab.tsx` | 297 | `RoleFields`, `GuideList` (same tabs folder) |
| `components/table/board/tokens/TokenOnBoard.tsx` | 264 | `LetterCard`, `StandeeCard`, `TokenPiece` (same folder) |
| `features/dice/DiceLab.tsx` | 255 | `components/dice/PhysicsDie.tsx`, `DicePicker.tsx`; `DiceLab` stays the page |
| `features/campaign/CampaignPage.jsx` | 254 | `components/campaign/`: `CampaignHeader`, `CampaignEditForm`, `InvitePanel`, `MemberList`, `CharacterPicker`, `CampaignMonsters`, `CampaignTabs` |
| `components/character-form/tabs/TraitsTab.tsx` | 251 | `TraitsFields`, `Dice`, `StatPick` |
| `components/sheets/blocks/registry.tsx` | 240 | Leave as the block registry |
| `components/table/board/models/BoardFeatures.tsx` | 233 | One file per stock piece already named |
| `components/table/board/lighting/BoardWorld.tsx` | 224 | `Weather`, `Room`, `MapPicture` |
| `components/character-form/tabs/GearTab.tsx` | 200 | `GearFields`, `ChipGroup` |
| `components/sheets/blocks/InventoryBlock.tsx` | 191 | Extract `WeaponFilterBar` → `components/ui/FilterBar` |
| `components/dm/DmBlocks.tsx` | 185 | One file per already-exported block, in `components/dm/` |
| `components/character-form/tabs/SpeciesTab.tsx` | 166 | `SpeciesFields`, `Choice` |
| `components/inventory/ItemShop.jsx` | 165 | `ArmorTab`, `WeaponTab`, `ItemTab`, `ItemFilter` in `components/inventory/` |
| `features/character-form/CharacterForm.tsx` | 156 | `NewCharacter`, `SavedHeader` can stay as build pieces in `features/character-form/` or move to `components/character-form/` if reused |
| `components/sheets/blocks/details.tsx` | 155 | One PascalCase file per already-exported info panel |
| `features/home/HomePage.jsx` | 149 | `components/home/`: `CharacterTile`, `CampaignTile`, `EmptyState`, `HomeTabs`, `UnfinishedList` |
| `components/table/panels/BoardLibrary.tsx` | 142 | Already `BoardSelector`, `BoardLibrary`, `MeasureLine` |
| `components/sheets/LayoutEditor.tsx` | 112 | `TabPicker` already exported |
| `features/campaign/CampaignList.jsx` | 103 | `components/campaign/CampaignListCard` |

Pages that are already assemblies (stay in `features/`): `InventoryPage.jsx`, `TablePage.tsx`, `MapEditorPage.tsx`, `CharacterSheetPage.tsx`, `AppLayout.jsx` (layout is a component).

Large CSS to split later under the **same mirrored folder**: `CampaignPage.module.css` (1341), `HomePage.module.css` (859), `themes.css` (1161, already marked with `#region`), plus the twin auth/public chrome files (~440–500), and toolbar parts out of `Toolbar.module.css` into `ToolButton.module.css` etc.

---

## 6. Repeated UI patterns → shared `ui` parts

Unchanged in substance: `ToggleButton`, `Button`, `ButtonRow`, `Field`, `Tabs`, `PageHeader`, `EmptyState`, tiles, `FilterBar`, `Confirm`, `Loader`, one `messageOf` helper. Their CSS goes in `styles/components/ui/` (or stays in the domain stylesheet until that batch). Public-page CSS dedup is a Major batch on files already in `styles/features/auth/` and `styles/features/campaign/` (extracted shared chrome may land in `components/auth/` + `styles/components/auth/`).

---

## 7. Batches (smallest risk first)

Every Saunter batch: `git mv`, fix imports, **no** barrels, **no** look changes, then `npm run typecheck`, `npm test`, `npm run build -w @tenebris/web`. If `App.jsx` lazy paths change, also confirm Vite `/campaign/test/table` and `/maps` return 200 with no resolve errors. Do not run GPU/WebGL renders. Do not commit unless asked. Do not normalize `Toolbar.module.css`.

Move **JS and CSS to their final homes in the same domain batch** so imports are fixed once (page CSS under `styles/features/…`, part CSS under `styles/components/…`).

### Batch 1 — Saunter: global CSS into `styles/base/` and `styles/themes/`

- `git mv` `styles/base.css` → `styles/base/base.css`, `styles/themes.css` → `styles/themes/themes.css`.
- Update the two imports in `main.jsx`.
- Do not split themes yet.

### Batch 2 — Saunter: layout + ui components and their CSS

- Create `components/layout/`, `components/ui/`, and the mirrored `styles/components/layout/` and `styles/components/ui/`.
- Move shell and widget files per the map, including filters (`ArmorFilter`, `WeaponFilter`) and settings.
- Fix JS and CSS imports (`App.jsx`, sidebar, ItemShop, etc.).

### Batch 3 — Saunter: route pages into `features/` + page CSS into `styles/features/`

- `git mv` Login, Register, Home, Campaign*, Inventory pages (and `campaignImages.js`).
- CSS to `styles/features/auth|home|campaign|inventory/`.
- Update `App.jsx` (these pages are **not** lazy).

### Batch 4 — Saunter: sheets split + rename `sheet` → `sheets`

- Pages, queries, layouts, tools, types → `features/sheets/`; CSS → `styles/features/sheets/`.
- Blocks, SheetLayout, LayoutEditor, shared `Sheet.module.css` → `components/sheets/` and `styles/components/sheets/`.
- `git mv` the folder rename; update every importer (including DM).
- Delete unused `features/sheet/blocks/CharacterSheetPage.module.css` only after confirming it has no importers.

### Batch 5 — Saunter: character-form parts vs the form page

- Keep `CharacterForm.tsx`, `queries.ts`, `types.ts` in `features/character-form/`; move form CSS to `styles/features/character-form/CharacterForm.module.css`.
- Move FormHeader, FormTabs, and tabs to `components/character-form/`; tab CSS to `styles/components/character-form/tabs/`.
- Fix tab imports of the shared form CSS (depth will change).

### Batch 6 — Saunter: inventory components

- `ItemShop` and `ItemDetails` → `components/inventory/`; CSS → `styles/components/inventory/`.
- `InventoryPage` is already in `features/inventory/` from Batch 3; update its imports.

### Batch 7 — Saunter: DM parts + dice CSS rename

- `DmBlocks`, `DmContext` → `components/dm/`; `DmPage` + `dmQueries` stay; page CSS → `styles/features/dm/DmPage.module.css`.
- `git mv` `features/dice/dice.module.css` → `styles/features/dice/DiceLab.module.css` and update `DiceLab.tsx`. The page file stays (lazy path unchanged).

### Batch 8 — Saunter (careful): table parts vs table pages

- Keep `pages/` and `hooks/` in `features/table/`; move `toolbarTypes.ts` into `hooks/`.
- Move toolbar, panels, and board to `components/table/` (keep the existing subfolders).
- CSS to `styles/components/table/…` and `styles/features/table/pages/TablePage.module.css`.
- `git mv` `Toolbar.module.css` only — no line-ending rewrite.
- Update `TablePage`, `MapEditorPage`, `BoardActs`, toolbar parts, and Settings (`graphicsSettings` path stays under `features/table/hooks/`).
- Lazy paths in `App.jsx` **stay** `./features/table/pages/TablePage.tsx` and `MapEditorPage.tsx`.
- Toolbar icons stay put until the asset batch, or move in Batch 11; do not leave broken `import … from './icons/…'` in between.

### Batch 9 — Saunter: mechanical in-place splits + `messageOf`

- Split `DmBlocks`, `details.tsx`, already-named form-tab pieces. New files go in the matching `components/<featureType>/` folder.
- DiceLab → extract `components/dice/PhysicsDie.tsx` and `DicePicker.tsx`; `DiceLab` stays the page. Create `components/dice/` and `styles/components/dice/` in this batch.
- One shared `messageOf` helper to replace the six copies in the character form.

### Batch 10 — Saunter (careful): seed `components/ui` from toolbar parts

- Add `Button`, `ToggleButton`, `ButtonRow`, `Section`, `Field` under `components/ui/` with CSS in `styles/components/ui/`, or `className` props.
- `components/table/toolbar/parts/` become wrappers that import `styles/components/table/toolbar/` classes so the board look does not change.
- Vite table routes stay on the same lazy file paths.

### Batch 11 — Saunter (careful): one asset home

- Follow the asset move map exactly (`git mv`).
- Update index.html, theme CSS URLs, page logo paths, `BoardAtmosphere.tsx` HDRI URLs, toolbar icon URLs, and `/default-character.png`.
- Leave `publicDir: '../../assets'`, `/models/`, `/textures/` (paints), and therefore the library manifest, `modelsLibrary.ts`, `content.json`, `generate-library.mjs`, and the `models:check` folder prefix unchanged.
- Delete `apps/web/src/assets/` after confirming the webps exist under `assets/`.
- Do not copy `texture-sources/` into `assets/`.
- Verify: `npm run models:check`, the file-and-shader half of `textures:check` (no Chromium/WebGL), typecheck, tests, web build. Spot-check `/icons/Logo.png` and `/hdri/day/sky.hdr` resolve in the Vite dev server (HTTP only).

### Batch 12 — Major: fat campaign/home pages

- Split `HomePage` and campaign pages into the components in §5, landing in `components/home/` and `components/campaign/` with CSS under `styles/components/home|campaign/`.
- Shared `PageHeader`, `EmptyState`, mobile `PageTabs` may live in `components/ui/`.

### Batch 13 — Major: public/auth CSS chrome

- Deduplicate Login/Register/Create/Join (and list-page banner) CSS already in `styles/features/auth/` and `styles/features/campaign/` without changing look.
- Shared chrome, if extracted as components, goes to `components/auth/` + `styles/components/auth/`.

### Batch 14 — Major: sheet layout and actions

- Split `SheetLayout.tsx` and `ActionsBlock.tsx` in `components/sheets/`. Keep the existing `Fit` CSS-variable inline style.
- Point `InventoryBlock`’s filter bar at `components/ui/FilterBar`.

### Batch 15 — Major: table 3D files (already under `components/table/board/`)

- Extract `hexMath` from `TableScenery.tsx` first, then Tabletop/Terrain, BoardFeatures pieces, BoardWorld, TokenOnBoard cards.
- Do not reshuffle table component folders. Verify typecheck, tests, build, and Vite table/maps routes. No WebGL renders.

### Batch 16 — Saunter: cleanup

- Delete empty `components/classes/warrior.jsx`.
- Add `Confirm` and replace `window.confirm` if not already done.
- Optional: move `App.jsx` / `main.jsx` into `src/app/` only after everything else.

Batches **12–15** are Major. **1–11** and **16** are Saunter (8, 10, and 11 are high-impact but mechanical if the maps are followed exactly).

---

## 8. Risks

**Relative CSS import depth.** A deep file such as `components/table/toolbar/parts/ToggleButton.tsx` will import from `../../../../styles/components/table/toolbar/Toolbar.module.css`. Miss one importer (especially shared CSS: `Sheet.module.css`, `TableControls.module.css`, `TablePage.module.css` used by `BoardActs`, form tabs importing both form + tab CSS, `CharacterSheetPage.module.css` used by Monster and DM) and the build fails. Optional later convenience, not required: a Vite alias `@styles` → `src/styles`. Do not add it in the mechanical batches.

**`features/` must not keep reusable parts, and `components/` must not keep pages.** After Batch 8, `features/table/` should contain only `pages/`, `hooks/`, and types. A leftover `features/table/toolbar/` will recreate the “where is this?” problem this plan is meant to fix.

**Case-sensitive Linux build (Render).** Always `git mv`. Never change only the case of a filename. The `sheet` → `sheets` rename is a different name; still use `git mv` and grep for the old `features/sheet/` and `styles/…/sheet/` paths. `/Logo.png` vs `/logo_banner.png` already differ in case and will 404 in production if typo’d on Windows. After asset moves, grep for old `/utils/`, `/Logo.png`, `/textures/hdris/`, `pages/*.module.css`, and `./Loader.module.css`. Do not rename mixed-case files (`Vaelith.png`, `MapBackground.png`) except to a new folder.

**Circular imports.** No folder `index.ts` barrels. `components/ui` must not import from `components/table` or `features/table`. Domain components may import `components/ui` and `components/layout`. Settings may keep importing `features/table/hooks/graphicsSettings.ts` one-way. Features import components, not the other way around, except where a page-level module is already shared (e.g. `BoardActs` importing `TablePage.module.css`) — leave that until a later CSS split.

**Lazy routes in `App.jsx`.** These three paths must stay exact file URLs (they already point at `features/`, and those page files stay there):

```js
lazy(() => import('./features/table/pages/TablePage.tsx'))
lazy(() => import('./features/table/pages/MapEditorPage.tsx'))
lazy(() => import('./features/dice/DiceLab.tsx'))
```

A broken lazy path blanks the table, map editor, or dice routes.

**Asset URLs and the publicDir.** Moving a file under `assets/` changes its site-root URL and will break the board, theme backgrounds, or `models:check` if a reference is missed. That is why models and paint textures stay at `/models/` and `/textures/`. The budget in `models:check` is the whole `assets/` tree; do not drag `texture-sources/` into it. `src/assets/` is not served by Vite today, which is why those copies are dead weight.

**Look regressions.** Highest visual risk: lifting toolbar parts (Batch 10), CSS chrome dedup (Batch 13), and asset URL changes (Batch 11). Wrappers + classNames first; do not “clean up” CSS in a Saunter batch. Existing inline exceptions stay.

**Tests.** Almost all automated tests live in `packages/rules`. Typecheck + the web build catch missing CSS/JS imports; asset URL mistakes need `models:check` and a quick HTTP check of a moved file.
