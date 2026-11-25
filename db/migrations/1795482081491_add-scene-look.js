// Table polish: how a scene looks as a whole, set by the DM: mood (day, dusk, night...), weather, the room around the
// table, a map picture under the hexes, and raised ground. Looks only: none of it changes the rules (yet).
// { "mood": "dusk", "weather": "fog", "room": true, "map": { "url": "https://...", "size": 30 }, "heights": { "2,0": 1 } }

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
        look: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumns('scenes', ['look']);
};
