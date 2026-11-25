// Table polish: features the DM places on hexes (lights, trees, pillars, crates...), beside terrain and surfaces.
// Same shape: { "q,r": { "kind": "tree", "size": 1.2 }, "2,0": { "kind": "light", "color": "#ffd08a", "size": 1 } }.

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
        features: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumns('scenes', ['features']);
};
