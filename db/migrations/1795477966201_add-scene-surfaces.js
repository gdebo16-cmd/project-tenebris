// Table polish: painted surfaces (looks only) for each scene, beside its terrain (rules).
// Same shape as terrain: { "q,r": "paving", ... } — only painted hexes are listed; the rest use the default surface.

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
        surfaces: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumns('scenes', ['surfaces']);
};
