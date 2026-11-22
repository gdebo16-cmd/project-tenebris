// R5.7: what the DM page keeps per campaign: private notes, and the turn order
// ({ round, turn, order: [{ kind, id, name, bonus, roll }] }, or null when no fight is running).

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
    pgm.addColumns('campaigns', {
        dm_notes: { type: 'text', notNull: true, default: '' },
        initiative: { type: 'jsonb' },
    });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
    pgm.dropColumns('campaigns', ['dm_notes', 'initiative']);
};
