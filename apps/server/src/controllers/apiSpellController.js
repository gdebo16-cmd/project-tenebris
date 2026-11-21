// The spell book (learn / unlearn / prepare / action spells) as JSON for React. Queries live in models/.
// The rules (caps, levels) live in @tenebris/rules/spellbook; changeSpellbook() is shared with the new sheet (R5).
import { ownsCharacter } from '../models/characterModel.js';
import * as Spells from '../models/spellModel.js';
import { getSheetCharacter } from '../models/characterModel.js';
import { getSpell } from '../models/spellPack.js';
import { getSpellSlots } from '@tenebris/rules/spellSlots';
import { getSpellCaps, bodyMaxLevel } from '@tenebris/rules/spellLimits'; /*prep-done*/
import { learnRefusal, prepareRefusal } from '@tenebris/rules/spellbook';

// Highest spell level a character can cast (number of slot tiers). Cantrips (0) are always allowed.
// Body Magic has no slots: its highest level comes from the character level.
const highestSlotFor = async (ch) => ch.caster_type === 'body'
    ? bodyMaxLevel(ch.level)
    : getSpellSlots(ch.level, await Spells.getClassSlots(ch.role_id, ch.level, ch.calling_id)).length;

// Everything the sheet and the book need after a change:
// learnedSpells = full rows for the Spell Book tab, learnedIds = just the ids for the book's buttons
// spellLimits = { cantrips, prepared, known } for the counters (null = no cap)
async function loadLearned(charId, ch = null) {
    const rows = await Spells.getLearnedSpells(charId);
    const spellLimits = ch ? getSpellCaps(ch.class_name, ch.level, ch.subclass_name) : undefined;
    return { learnedSpells: rows, learnedIds: rows.map((r) => Number(r.id)), ...(ch ? { spellLimits } : {}) };
}

// Ownership check shared by every route. Returns charId, or null after sending 401/404.
async function ownedCharId(req, res) {
    if (!req.session.userId) { res.status(401).json({ error: 'Not logged in' }); return null; }
    const charId = Number(req.params.id);
    if (!(await ownsCharacter(charId, req.session.userId))) {
        res.status(404).json({ error: 'Character not found' });
        return null;
    }
    return charId;
}

// The book: every spell this character could learn (up to its highest slot level), plus what it knows.
// ownerId = the character's owner (the caller has already checked who may look).
export async function loadSpellbook(charId, ownerId) {
    const ch = await getSheetCharacter(charId, ownerId);
    if (!ch) return null;
    const allSpells = await Spells.getLearnableSpells(ch.alignment_code);
    const highestSlot = await highestSlotFor(ch);
    const spells = allSpells.filter((s) => Number(s.base_level) <= highestSlot);
    return { spells, ...(await loadLearned(charId, ch)) };
}

// One spell book change. Answers { status, body }: 200 with the learned spells, or 400 with { error }.
// ownerId = the character's owner (the caller has already checked who may change it).
export async function changeSpellbook(charId, ownerId, op, spellId) {
    const ch = await getSheetCharacter(charId, ownerId);
    if (!ch) return { status: 404, body: { error: 'Character not found' } };
    const refuse = (error) => ({ status: 400, body: { error } });
    const caps = getSpellCaps(ch.class_name, ch.level, ch.subclass_name);

    if (op === 'learn') {
        const spell = getSpell(spellId);
        const refusal = learnRefusal({
            exists: !!spell,
            featureOnly: !!spell && Spells.isFeatureOnlySpell(spell.name),
            baseLevel: Number(spell?.base_level),
            highestSlot: spell ? await highestSlotFor(ch) : 0,
            level: ch.level,
            caps,
            counts: caps && spell ? await Spells.spellCountsFromPack(charId, spellId) : null,
        });
        if (refusal) return refuse(refusal);
        await Spells.learnSpell(charId, spellId);
    } else if (op === 'unlearn') {
        await Spells.unlearnSpell(charId, spellId);
    } else if (op === 'prepare') {
        const refusal = prepareRefusal({
            baseLevel: Number(getSpell(spellId)?.base_level),
            level: ch.level,
            caps,
            counts: caps ? await Spells.spellCountsFromPack(charId, spellId) : null,
        });
        if (refusal) return refuse(refusal);
        if (!(await Spells.setPrepared(charId, spellId, true))) return refuse('You have to learn that spell first');
    } else if (op === 'unprepare' || op === 'setAction' || op === 'removeAction') {
        const rowCount = op === 'unprepare'
            ? await Spells.setPrepared(charId, spellId, false)
            : await Spells.setAction(charId, spellId, op === 'setAction');
        if (!rowCount) return refuse('You have to learn that spell first');
    } else {
        return refuse('Unknown spell book change');
    }
    return { status: 200, body: await loadLearned(charId, ch) };
}

// GET /api/characters/:id/spellbook
export async function getSpellbook(req, res) {
    const charId = await ownedCharId(req, res);
    if (charId === null) return;
    res.json(await loadSpellbook(charId, req.session.userId));
}

// The old sheet's POST routes, one per change. body: { spell_id }
const changeRoute = (op) => async (req, res) => {
    const charId = await ownedCharId(req, res);
    if (charId === null) return;
    const { status, body } = await changeSpellbook(charId, req.session.userId, op, Number(req.body.spell_id));
    res.status(status).json(body);
};

// POST /api/characters/:id/spells/learn   body: { spell_id }
export const learnSpell = changeRoute('learn');
// POST /api/characters/:id/spells/unlearn   body: { spell_id }
export const unlearnSpell = changeRoute('unlearn');
// POST /api/characters/:id/spells/prepare     body: { spell_id }
export const prepareSpell = changeRoute('prepare');
// POST /api/characters/:id/spells/unprepare   body: { spell_id }
export const unprepareSpell = changeRoute('unprepare');
// POST /api/characters/:id/spells/setAction     body: { spell_id }
export const setAction = changeRoute('setAction');
// POST /api/characters/:id/spells/removeAction     body: { spell_id }
export const removeAction = changeRoute('removeAction');
