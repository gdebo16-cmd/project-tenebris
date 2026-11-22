// L4: each player's own sheet layouts, saved to the account so they follow them to every device.
// { "character": { …layout… }, "monster": { …layout… } }; a kind that's missing uses the default layout.
// The server checks a layout (packages/rules/src/layout.ts) before saving it.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
    pgm.addColumns('users', {
        sheet_layouts: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
    pgm.dropColumns('users', ['sheet_layouts']);
};
