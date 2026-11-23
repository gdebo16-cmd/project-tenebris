// 2.9: scenes, tokens and overlays for a campaign.

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
    pgm.createTable('scenes', {
        id: 'id',
        campaign_id: { type: 'integer', notNull: true, references: 'campaigns', onDelete: 'CASCADE' },
        name: { type: 'text', notNull: true },
        terrain: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('scenes', 'campaign_id');
    pgm.addColumns('campaigns', {
        active_scene_id: { type: 'integer', references: 'scenes', onDelete: 'SET NULL' },
    });
    pgm.createTable('tokens', {
        id: 'id',
        name: { type: 'text'},
        scene_id: { type: 'integer', notNull: true, references: 'scenes', onDelete: 'CASCADE' },
        kind: { type: 'text', notNull: true, check: "kind IN ('character', 'monster', 'summon')"},
        character_id: { type: 'integer', references: 'characters', onDelete: 'CASCADE' },
        campaign_monster_id: { type: 'integer', references: 'campaign_monsters', onDelete: 'CASCADE' },
        owner_id: { type: 'integer', references: 'users', onDelete: 'CASCADE' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        q: { type: 'integer', notNull: true },
        r: { type: 'integer', notNull: true },
    });
    pgm.createIndex('tokens', ['scene_id', 'q', 'r'], { unique: true });
    pgm.createTable('overlays', {
        id: 'id',
        scene_id: { type: 'integer', notNull: true, references: 'scenes', onDelete: 'CASCADE' },
        name: { type: 'text', notNull: true },
        owner_id: { type: 'integer', references: 'users', onDelete: 'CASCADE' },
        shape: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb")},
        turns_left: { type: 'integer', check: "turns_left >= 0" },
        counts_token_id: { type: 'integer', references: 'tokens', onDelete: 'SET NULL' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
    pgm.createIndex('overlays', 'scene_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('overlays');
    pgm.dropTable('tokens');
    pgm.dropColumns('campaigns', 'active_scene_id');
    pgm.dropTable('scenes');
    
};
