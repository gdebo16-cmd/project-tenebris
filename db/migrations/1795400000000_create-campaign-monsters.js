// R5.6: the monsters a DM adds to a campaign. The stat block stays in the content pack (monster_id);
// this row keeps what changes in play: HP, temporary HP, conditions, exhaustion and the DM's notes.
// Deleting a campaign deletes its monsters.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
    pgm.createTable('campaign_monsters', {
        id: 'id',
        campaign_id: { type: 'integer', notNull: true, references: 'campaigns', onDelete: 'CASCADE' },
        monster_id: { type: 'integer', notNull: true },
        nickname: { type: 'text' },
        current_hp: { type: 'integer', notNull: true, check: 'current_hp >= 0' },
        temp_hp: { type: 'integer', notNull: true, default: 0, check: 'temp_hp >= 0' },
        conditions: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
        exhaustion: { type: 'integer', notNull: true, default: 0, check: 'exhaustion BETWEEN 0 AND 10' },
        notes: { type: 'text', notNull: true, default: '' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('campaign_monsters', 'campaign_id');
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
    pgm.dropTable('campaign_monsters');
};
