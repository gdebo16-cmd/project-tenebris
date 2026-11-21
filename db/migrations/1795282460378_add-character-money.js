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
        pgm.addColumns('characters', {
          copper: { type: 'integer', notNull: true, default: 0, check: 'copper >= 0' },
          silver: { type: 'integer', notNull: true, default: 0, check: 'silver >= 0' },
          gold: { type: 'integer', notNull: true, default: 0, check: 'gold >= 0' },
          crowns: { type: 'integer', notNull: true, default: 0, check: 'crowns >= 0' },
          oracles: { type: 'integer', notNull: true, default: 0, check: 'oracles >= 0' },
        });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumns('characters', ['copper', 'silver', 'gold', 'crowns', 'oracles']);
};
