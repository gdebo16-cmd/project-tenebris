// R7.3: characters use species_id, role_id and calling_id only. The old race/class ids were kept in step
// by idMap.js for the old sheet; nothing reads them any more, so the columns go.
// Every finished character already has species_id and role_id (checked on rework 2026-11-22).

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    pgm.dropColumns('characters', ['race_id', 'subrace_id', 'class_id', 'subclass_id']);
};

/**
 * Puts the columns back, empty: the old values can't come back (and nothing reads them).
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.addColumns('characters', {
        race_id: { type: 'integer' },
        subrace_id: { type: 'integer' },
        class_id: { type: 'integer' },
        subclass_id: { type: 'integer' },
    });
};
