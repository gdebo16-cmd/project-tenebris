// R7.4: drop the 61 tables nothing reads (list and proof: docs/LEGACY-TABLES.md).
// Their data stays in the Neon backup branch rework-backup-pre-r7.

const LEGACY_TABLES = [
    'alignment_bands',
    'alignments',
    'armor',
    'calling_features',
    'callings',
    'character_spells_backup_2026_10_23_refactor2',
    'characters_magicv3',
    'class_feature_options',
    'class_features',
    'class_item_proficiencies',
    'class_levels',
    'class_spell_slots',
    'class_spells',
    'class_spells_backup_2026_10_23_refactor2',
    'classes',
    'feature_text_backup_2026_10_23',
    'feature_text_backup_2026_10_23_b',
    'features',
    'items',
    'items_backup_2026_10_23',
    'items_backup_2026_10_23_refactor2',
    'items_backup_2026_10_23_refactor3',
    'personality_options',
    'primordial_blessings',
    'proficiency_levels',
    'race_affinity_elements',
    'race_lineage_bonuses',
    'race_traits',
    'races',
    'role_features',
    'role_item_proficiencies',
    'role_spell_slots',
    'role_spells',
    'roles',
    'runes',
    'sizes',
    'species',
    'species_affinity_elements',
    'species_features',
    'spell_alignment',
    'spell_alignment_magicv3',
    'spell_bands',
    'spell_element',
    'spell_state',
    'spell_state_magicv3',
    'spell_upcasts',
    'spell_upcasts_backup_2026_10_23_refactor2',
    'spells',
    'spells_backup_2026_10_22',
    'spells_backup_2026_10_23_preamble',
    'spells_backup_2026_10_23_refactor',
    'spells_backup_2026_10_23_refactor2',
    'spells_backup_2026_10_23_refactor3',
    'spells_magicv3',
    'sub_classes',
    'sub_classes_magicv3',
    'subclass_features',
    'subclass_levels',
    'subraces',
    'weapon_category',
    'weapons',
];

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    for (const table of LEGACY_TABLES) pgm.dropTable(table, { ifExists: true, cascade: true });
};

// No way back from here: restore from the backup branch instead.
export const down = false;
