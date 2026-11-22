# Legacy tables on `rework` (R7.4)

Checked 2026-11-22 (Claude). The server reads and writes only these tables:

`users`, `session`, `characters`, `character_armor`, `character_weapons`, `character_items`, `character_spells`,
`item_runes`, `campaigns`, `campaign_members` (and `pgmigrations`, node-pg-migrate's own).
`campaign_monsters` is read too, but has never existed (R5.6 creates it).

**Proof:** every SQL statement in `apps/server/src` names only those tables
(`grep -rhoE "(FROM|JOIN|INTO|UPDATE|TABLE) [a-z_]+" apps/server/src`), and none of them has a foreign key to any
table below. All game content (species, roles, callings, spells, items, weapons, armor, runes, …) comes from
`packages/content/content.json`. The only other reader was `packages/content/export.ts` (database → JSON), which R7.5 removes.

Migration `1795360000100_drop-legacy-tables.js` drops all 61. A Neon backup branch of `rework` keeps their data:
**`rework-backup-pre-r7`** (made before the migration runs).

| Table | Rows | What it was |
| --- | ---: | --- |
| `alignment_bands` | 81 | Copy of a content-pack table; the server reads the pack, not this |
| `alignments` | 9 | Copy of a content-pack table; the server reads the pack, not this |
| `armor` | 92 | Copy of a content-pack table; the server reads the pack, not this |
| `calling_features` | 672 | Copy of a content-pack table; the server reads the pack, not this |
| `callings` | 94 | Copy of a content-pack table; the server reads the pack, not this |
| `character_spells_backup_2026_10_23_refactor2` | 72 | Dated backup from the Umber refactors |
| `characters_magicv3` | 20 | Old magic system copy |
| `class_feature_options` | 130 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `class_features` | 702 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `class_item_proficiencies` | 122 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `class_levels` | 480 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `class_spell_slots` | 1,748 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `class_spells` | 1,308 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `class_spells_backup_2026_10_23_refactor2` | 1,166 | Dated backup from the Umber refactors |
| `classes` | 16 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `feature_text_backup_2026_10_23` | 7 | Dated backup from the Umber refactors |
| `feature_text_backup_2026_10_23_b` | 9 | Dated backup from the Umber refactors |
| `features` | 1,212 | Copy of a content-pack table; the server reads the pack, not this |
| `items` | 172 | Copy of a content-pack table; the server reads the pack, not this |
| `items_backup_2026_10_23` | 30 | Dated backup from the Umber refactors |
| `items_backup_2026_10_23_refactor2` | 172 | Dated backup from the Umber refactors |
| `items_backup_2026_10_23_refactor3` | 172 | Dated backup from the Umber refactors |
| `personality_options` | 51 | Copy of a content-pack table; the server reads the pack, not this |
| `primordial_blessings` | 27 | Copy of a content-pack table; the server reads the pack, not this |
| `proficiency_levels` | 20 | Copy of a content-pack table; the server reads the pack, not this |
| `race_affinity_elements` | 86 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `race_lineage_bonuses` | 90 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `race_traits` | 24 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `races` | 24 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `role_features` | 1,077 | Copy of a content-pack table; the server reads the pack, not this |
| `role_item_proficiencies` | 122 | Copy of a content-pack table; the server reads the pack, not this |
| `role_spell_slots` | 1,748 | Copy of a content-pack table; the server reads the pack, not this |
| `role_spells` | 1,308 | Copy of a content-pack table; the server reads the pack, not this |
| `roles` | 16 | Copy of a content-pack table; the server reads the pack, not this |
| `runes` | 14 | Copy of a content-pack table; the server reads the pack, not this |
| `sizes` | 6 | Copy of a content-pack table; the server reads the pack, not this |
| `species` | 43 | Copy of a content-pack table; the server reads the pack, not this |
| `species_affinity_elements` | 86 | Copy of a content-pack table; the server reads the pack, not this |
| `species_features` | 121 | Copy of a content-pack table; the server reads the pack, not this |
| `spell_alignment` | 9 | Copy of a content-pack table; the server reads the pack, not this |
| `spell_alignment_magicv3` | 9 | Old magic system copy |
| `spell_bands` | 5 | Copy of a content-pack table; the server reads the pack, not this |
| `spell_element` | 17 | Copy of a content-pack table; the server reads the pack, not this |
| `spell_state` | 17 | Copy of a content-pack table; the server reads the pack, not this |
| `spell_state_magicv3` | 15 | Old magic system copy |
| `spell_upcasts` | 1,436 | Copy of a content-pack table; the server reads the pack, not this |
| `spell_upcasts_backup_2026_10_23_refactor2` | 1,436 | Dated backup from the Umber refactors |
| `spells` | 794 | Copy of a content-pack table; the server reads the pack, not this |
| `spells_backup_2026_10_22` | 436 | Dated backup from the Umber refactors |
| `spells_backup_2026_10_23_preamble` | 436 | Dated backup from the Umber refactors |
| `spells_backup_2026_10_23_refactor` | 436 | Dated backup from the Umber refactors |
| `spells_backup_2026_10_23_refactor2` | 780 | Dated backup from the Umber refactors |
| `spells_backup_2026_10_23_refactor3` | 770 | Dated backup from the Umber refactors |
| `spells_magicv3` | 770 | Old magic system copy |
| `sub_classes` | 51 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `sub_classes_magicv3` | 51 | Old magic system copy |
| `subclass_features` | 365 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `subclass_levels` | 362 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `subraces` | 19 | Old race/class catalog (replaced by species/roles/callings in the pack) |
| `weapon_category` | 8 | Copy of a content-pack table; the server reads the pack, not this |
| `weapons` | 140 | Copy of a content-pack table; the server reads the pack, not this |
