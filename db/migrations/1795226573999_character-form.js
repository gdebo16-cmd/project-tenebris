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
    is_draft: { type: 'boolean', notNull: true, default: false },
    size_id: { type: 'integer' },
    eye_color: { type: 'text' },
    variant: { type: 'text' },
    look_description: { type: 'text' },
    money: { type: 'integer', notNull: true, default: 0 },
    stat_rolls: { type: 'jsonb' },   // the 8 server rolls and where each was placed
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropColumns('characters', ['is_draft', 'size_id', 'eye_color', 'variant', 'look_description', 'money', 'stat_rolls']);
};
