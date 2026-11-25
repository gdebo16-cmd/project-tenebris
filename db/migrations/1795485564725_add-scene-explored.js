// Step 18, fog: every hex the party has ever seen on a scene, { "q,r": 1, ... }. The server adds to it as the party
// walks around (hexes seen once stay uncovered, greyed when out of sight). The DM can clear it.

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.addColumns('scenes', {
        explored: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumns('scenes', ['explored']);
};
