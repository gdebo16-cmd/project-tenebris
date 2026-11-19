-- Baseline: the 17 tables Tenebris uses, as they existed on Neon `rework` on 2026-11-19.
-- Generated from the live catalog; you never need to edit this file.
-- Existing databases (rework, production) already have these tables: adopt the baseline
-- there with `npm run migrate -- fake` instead of running it.
-- Not included: the 54 legacy/backup tables (see docs/DECISIONS.md, step 7), and the
-- legacy foreign key callings.legacy_subclass_id -> sub_classes (that table is legacy).

-- Up Migration

-- ---- Accounts ----
CREATE TABLE users (
  id serial PRIMARY KEY,
  name name NOT NULL DEFAULT 'name pending'::name,
  email text NOT NULL DEFAULT 'Email@email.com'::text,
  username text,
  password_hash text,
  created_at timestamptz DEFAULT now(),
  site_theme text DEFAULT 'default'::text,
  avatar_url text,
  site_background varchar(30) DEFAULT 'default'::varchar,
  site_display varchar(30) DEFAULT 'standard'::varchar
);
CREATE UNIQUE INDEX users_username_lower_uq ON users (lower(username));

CREATE TABLE session (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX "IDX_session_expire" ON session (expire);

-- ---- Spell lookups ----
CREATE TABLE spell_alignment (
  id serial PRIMARY KEY,
  "Name" text NOT NULL,
  "Type" text NOT NULL,
  color text,
  chart_square text,
  meaning text
);

CREATE TABLE spell_element (
  id serial PRIMARY KEY,
  name text NOT NULL,
  difficulty integer NOT NULL
);

CREATE TABLE spell_state (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  difficulty integer NOT NULL,
  retired boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX spell_state_lname_uq ON spell_state (lower(name));

CREATE TABLE spells (
  id serial PRIMARY KEY,
  name text,
  casting_time integer,
  range integer,
  duration numeric(3,1),
  base_level integer,
  base_description text,
  focus_level integer,
  state_id integer,
  element_id integer,
  alignment_id integer,
  base_damage_dice text,
  opponent_save_roll text,
  attack_type text CHECK (attack_type = ANY (ARRAY['melee'::text, 'ranged'::text])),
  base_to_hit_modifier integer,
  beam_scaling jsonb,
  action_type text CHECK (action_type = ANY (ARRAY['action'::text, 'bonus'::text, 'reaction'::text, 'other'::text])),
  heal_dice text,
  heal_add_mod boolean NOT NULL DEFAULT false,
  color text CHECK (color = ANY (ARRAY['White'::text, 'Yellow'::text, 'Green'::text, 'Blue'::text, 'Grey'::text, 'Red'::text, 'Orange'::text, 'Purple'::text, 'Black'::text]))
);

-- ---- Roles and callings ----
CREATE TABLE roles (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  hit_die smallint NOT NULL,
  primary_stat text NOT NULL,
  description text,
  sort_order smallint,
  score_key text,
  saving_throws text[],
  armor_proficiencies text,
  weapon_proficiencies text,
  tool_proficiencies text,
  skill_choice_count integer,
  skill_options text[],
  skill_fixed text[],
  spellcasting text,
  spellcasting_stat text,
  caster_type text,
  subclass_level integer,
  has_embers boolean NOT NULL DEFAULT false,
  crack_max integer,
  breach_dc integer,
  breach_dc_scaling jsonb,
  img_url text
);

CREATE TABLE callings (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  role_id integer NOT NULL,
  description text,
  sort_order smallint,
  armor_proficiencies text,
  weapon_proficiencies text,
  tool_proficiencies text,
  spellcasting text,
  spellcasting_stat text,
  caster_type text,
  breach_effect text,
  breach_drains_embers boolean NOT NULL DEFAULT false,
  black_gate_level integer,
  img_url text,
  legacy_subclass_id integer UNIQUE
);

CREATE TABLE role_spells (
  id serial PRIMARY KEY,
  role_id integer NOT NULL,
  calling_id integer,
  spell_id integer NOT NULL,
  min_level integer NOT NULL DEFAULT 1,
  is_bonus boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX role_spells_uidx ON role_spells (role_id, COALESCE(calling_id, 0), spell_id, is_bonus);

-- ---- Characters ----
CREATE TABLE characters (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  name text NOT NULL,
  str integer,
  dex integer,
  con integer,
  "int" integer,
  wis integer,
  cha integer,
  luc integer,
  spd integer,
  created_at timestamptz DEFAULT now(),
  race_id integer,
  class_id integer,
  subclass_id integer,
  plus2_stat text,
  plus1_stat text,
  armor_id integer,
  shield_id integer,
  max_hp integer NOT NULL DEFAULT 1,
  current_hp integer NOT NULL DEFAULT 1,
  level integer DEFAULT 1,
  spell_slot_level integer,
  spell_slots integer,
  spell_slots_used integer NOT NULL DEFAULT 0,
  skill_proficiencies text[] DEFAULT '{}'::text[],
  save_proficiencies text[] DEFAULT '{}'::text[],
  feature_choices jsonb NOT NULL DEFAULT '{}'::jsonb,
  portrait_url text,
  subrace_id integer,
  used_slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  embers_spent integer NOT NULL DEFAULT 0,
  rest_locks jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  exhaustion integer NOT NULL DEFAULT 0,
  cracks integer NOT NULL DEFAULT 0,
  rest_uses jsonb NOT NULL DEFAULT '{}'::jsonb,
  boost_migrated boolean NOT NULL DEFAULT true,
  boost_repick_available boolean NOT NULL DEFAULT false,
  last_swap_level integer,
  runed_weapon_item_id integer,
  sigil_item_id integer,
  temp_hp integer NOT NULL DEFAULT 0,
  alignment_code text,
  upbringing_id integer,
  lifestyle_id integer,
  outlook_id integer,
  upbringing_state text,
  lifestyle_state text,
  outlook_state text,
  race_element_id integer,
  race_spell_id integer,
  species_id integer,
  role_id integer,
  calling_id integer,
  CONSTRAINT characters_hp_range CHECK ((max_hp > 0) AND (current_hp >= 0)),
  CONSTRAINT characters_personality_states_differ CHECK ((upbringing_state IS NULL) OR ((upbringing_state <> lifestyle_state) AND (upbringing_state <> outlook_state) AND (lifestyle_state <> outlook_state)))
);
CREATE INDEX characters_calling_id_idx ON characters (calling_id);
CREATE INDEX characters_role_id_idx ON characters (role_id);
CREATE INDEX characters_species_id_idx ON characters (species_id);

CREATE TABLE character_weapons (
  id serial PRIMARY KEY,
  character_id integer NOT NULL,
  weapon_id integer NOT NULL,
  is_equipped boolean NOT NULL DEFAULT false,
  dual_wield boolean NOT NULL DEFAULT false,
  soul_branded boolean NOT NULL DEFAULT false,
  two_handed boolean NOT NULL DEFAULT false,
  UNIQUE (character_id, weapon_id)
);
CREATE UNIQUE INDEX character_weapons_one_soul_brand ON character_weapons (character_id) WHERE soul_branded;

CREATE TABLE character_armor (
  id serial PRIMARY KEY,
  character_id integer NOT NULL,
  armor_id integer NOT NULL,
  is_equipped boolean NOT NULL DEFAULT false,
  UNIQUE (character_id, armor_id)
);

CREATE TABLE character_items (
  id serial PRIMARY KEY,
  character_id integer NOT NULL,
  item_id integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  is_equipped boolean NOT NULL DEFAULT false,
  UNIQUE (character_id, item_id)
);

CREATE TABLE character_spells (
  id serial PRIMARY KEY,
  character_id integer NOT NULL,
  spell_id integer NOT NULL,
  is_prepared boolean NOT NULL DEFAULT false,
  notes text,
  is_learned boolean NOT NULL DEFAULT false,
  is_action boolean NOT NULL DEFAULT false,
  UNIQUE (character_id, spell_id)
);

CREATE TABLE item_runes (
  id serial PRIMARY KEY,
  character_weapon_id integer,
  character_armor_id integer,
  rune_id integer NOT NULL,
  inscribed_by_character_id integer NOT NULL,
  choice_value text,
  inscribed_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT item_runes_check CHECK ((character_weapon_id IS NULL) <> (character_armor_id IS NULL))
);
CREATE UNIQUE INDEX item_runes_armor_rune ON item_runes (character_armor_id, rune_id) WHERE (character_armor_id IS NOT NULL);
CREATE UNIQUE INDEX item_runes_weapon_rune ON item_runes (character_weapon_id, rune_id) WHERE (character_weapon_id IS NOT NULL);
CREATE INDEX item_runes_inscriber ON item_runes (inscribed_by_character_id);

-- ---- Campaigns ----
CREATE TABLE campaigns (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  name text NOT NULL CHECK ((char_length(name) >= 1) AND (char_length(name) <= 100)),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  campaign_img_url text,
  invite_code text NOT NULL DEFAULT upper(substr(md5(((random())::text || (clock_timestamp())::text)), 1, 8))
);
CREATE UNIQUE INDEX campaigns_invite_code_key ON campaigns (invite_code);
CREATE INDEX campaigns_user_id_idx ON campaigns (user_id);

CREATE TABLE campaign_members (
  id serial PRIMARY KEY,
  campaign_id integer NOT NULL,
  user_id integer NOT NULL,
  role text NOT NULL DEFAULT 'player'::text CHECK (role = ANY (ARRAY['dm'::text, 'player'::text])),
  character_id integer,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);
CREATE INDEX campaign_members_user_id_idx ON campaign_members (user_id);

-- ---- Foreign keys (added last; characters <-> character_weapons point at each other) ----
ALTER TABLE spells ADD CONSTRAINT spells_alignment_id_fkey FOREIGN KEY (alignment_id) REFERENCES spell_alignment(id);
ALTER TABLE spells ADD CONSTRAINT spells_element_id_fkey FOREIGN KEY (element_id) REFERENCES spell_element(id);
ALTER TABLE spells ADD CONSTRAINT spells_state_id_fkey FOREIGN KEY (state_id) REFERENCES spell_state(id);
ALTER TABLE callings ADD CONSTRAINT callings_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE role_spells ADD CONSTRAINT role_spells_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE role_spells ADD CONSTRAINT role_spells_calling_id_fkey FOREIGN KEY (calling_id) REFERENCES callings(id) ON DELETE CASCADE;
ALTER TABLE characters ADD CONSTRAINT characters_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE characters ADD CONSTRAINT characters_runed_weapon_item_id_fkey FOREIGN KEY (runed_weapon_item_id) REFERENCES character_weapons(id) ON DELETE SET NULL;
ALTER TABLE characters ADD CONSTRAINT characters_sigil_item_id_fkey FOREIGN KEY (sigil_item_id) REFERENCES character_weapons(id) ON DELETE SET NULL;
ALTER TABLE character_weapons ADD CONSTRAINT character_weapons_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
ALTER TABLE character_armor ADD CONSTRAINT character_armor_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
ALTER TABLE character_items ADD CONSTRAINT character_items_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
ALTER TABLE character_spells ADD CONSTRAINT character_spells_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE;
ALTER TABLE item_runes ADD CONSTRAINT item_runes_character_weapon_id_fkey FOREIGN KEY (character_weapon_id) REFERENCES character_weapons(id) ON DELETE CASCADE;
ALTER TABLE item_runes ADD CONSTRAINT item_runes_character_armor_id_fkey FOREIGN KEY (character_armor_id) REFERENCES character_armor(id) ON DELETE CASCADE;
ALTER TABLE item_runes ADD CONSTRAINT item_runes_inscribed_by_character_id_fkey FOREIGN KEY (inscribed_by_character_id) REFERENCES characters(id) ON DELETE CASCADE;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE campaign_members ADD CONSTRAINT campaign_members_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE campaign_members ADD CONSTRAINT campaign_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE campaign_members ADD CONSTRAINT campaign_members_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL;

-- Down Migration

DROP TABLE IF EXISTS campaign_members, campaigns, item_runes, character_spells, character_items,
  character_armor, character_weapons, characters, role_spells, callings, roles, spells,
  spell_state, spell_element, spell_alignment, session, users CASCADE;
