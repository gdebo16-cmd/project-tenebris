// The unified character form (R4): one draft row per new character, one save per tab.
//
//   POST /api/characters                  create a draft from the header { name, level, portrait_url }  -> { id }
//   GET  /api/characters/:id/form         everything the form shows, plus the choices it may offer
//   PUT  /api/characters/:id/form/:tab    check and save one tab
//   POST /api/characters/:id/finish       check every tab is done, roll starting HP, stop being a draft
//
// The rules live in @tenebris/rules (characterOptions + characterForm); this file is the glue.
import { characterOptions } from '@tenebris/rules/characterOptions';
import { checkHeader, checkPersonalityTab, checkRoleTab, checkSpeciesTab, checkStatRollBody, checkTraitsTab, clearedCalling, emptyStatRolls, finishedFormBlock, keepUnrelatedChoices, missingForFinish, readStatRolls, rerollAllowed, scoreFromRolls, startingHp, writeRoll, FORM_TABS, STAT_COLUMNS } from '@tenebris/rules/characterForm';
import { CALLING_LEVEL } from '@tenebris/rules/characterOptions';
import { roll4d6DropLowest, rollDice } from '@tenebris/rules/dice';
import { rng } from '../dice.js';
import formPack from '../models/formPack.js';
import { getRole, hitDieSides } from '../models/content.js';
import * as Form from '../models/characterFormModel.js';

// The tabs that can be saved so far. Each later slice (R4.5-R4.8) adds its check here.
const TAB_CHECKS = {
    header: (_options, body) => checkHeader(body),
    species: (options, body) => checkSpeciesTab(options, body),
    role: (options, body) => checkRoleTab(options, body),
    traits: (options, body, ch) => checkTraitsTab(options, ch.stat_rolls, body),
    personality: (options, body) => checkPersonalityTab(options, body),
};

// Sub-species are stored as the species id; the form wants the top-level species and the sub-species apart
function splitSpecies(speciesId) {
    const row = formPack.species.find((s) => s.id === speciesId);
    if (!row) return { species_id: null, subspecies_id: null };
    return row.parent_id == null
        ? { species_id: row.id, subspecies_id: null }
        : { species_id: row.parent_id, subspecies_id: row.id };
}

// The choices for this character's current picks (level and role decide callings, skills, gifts)
function optionsFor(ch) {
    return characterOptions(formPack, {
        level: ch.level ?? 1,
        species_id: splitSpecies(ch.species_id).species_id ?? undefined,
        role_id: ch.role_id ?? undefined,
        calling_id: ch.calling_id ?? undefined,
    });
}

// The role tab is checked against the role and calling in this save, not the ones already stored.
// Otherwise the first save would see an empty calling list.
function optionsForSave(ch, tab, body) {
    if (tab !== 'role' || !body || typeof body !== 'object') return optionsFor(ch);
    const roleId = Number(body.role_id);
    const rawCalling = body.calling_id;
    const callingId = rawCalling == null || rawCalling === '' ? undefined : Number(rawCalling);
    return characterOptions(formPack, {
        level: ch.level ?? 1,
        species_id: splitSpecies(ch.species_id).species_id ?? undefined,
        role_id: Number.isInteger(roleId) ? roleId : undefined,
        calling_id: Number.isInteger(callingId) ? callingId : undefined,
    });
}

// Every :id route starts here. Answers the character, or sends the error and answers null.
async function loadOwnCharacter(req, res) {
    if (!req.session.userId) {
        res.status(401).json({ error: 'Not logged in' });
        return null;
    }
    const id = Number(req.params.id);
    const ch = Number.isInteger(id) ? await Form.getFormCharacter(id) : undefined;
    if (!ch) {
        res.status(404).json({ error: 'Character not found' });
        return null;
    }
    // Only the owner for now; the DM gets edit rights with the sheet permissions in R5
    if (Number(ch.user_id) !== Number(req.session.userId)) {
        res.status(403).json({ error: "That isn't your character" });
        return null;
    }
    return ch;
}

// Rolls, where they were placed, and the bonuses. Scores are the columns the server wrote.
function traitsView(ch) {
    const state = readStatRolls(ch.stat_rolls);
    const scores = {};
    for (const stat of STAT_COLUMNS) scores[stat] = ch[stat] ?? null;
    return {
        rolls: state.rolls,
        placement: state.placement,
        gifts: state.gifts,
        plus2: ch.plus2_stat ?? null,
        plus1: ch.plus1_stat ?? null,
        scores,
    };
}

// What GET /form answers, grouped the way the form's tabs are
function formView(ch) {
    return {
        id: ch.id,
        is_draft: ch.is_draft,
        header: { name: ch.name, level: ch.level, portrait_url: ch.portrait_url },
        species: { ...splitSpecies(ch.species_id), size_id: ch.size_id, variant: ch.variant, eye_color: ch.eye_color, look_description: ch.look_description },
        role: {
            role_id: ch.role_id,
            calling_id: ch.calling_id,
            skill_proficiencies: ch.skill_proficiencies ?? [],
            feature_choices: ch.feature_choices ?? {},
        },
        traits: traitsView(ch),
        personality: {
            alignment_code: ch.alignment_code ?? null,
            upbringing_id: ch.upbringing_id ?? null,
            lifestyle_id: ch.lifestyle_id ?? null,
            outlook_id: ch.outlook_id ?? null,
            upbringing_state: ch.upbringing_state ?? null,
            lifestyle_state: ch.lifestyle_state ?? null,
            outlook_state: ch.outlook_state ?? null,
        },
        missing: missingForFinish(ch),
        options: optionsFor(ch),
    };
}

export async function createDraft(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const checked = checkHeader(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const id = await Form.createDraft(req.session.userId, checked.values);
    res.status(201).json({ id });
}

export async function getForm(req, res) {
    const ch = await loadOwnCharacter(req, res);
    if (!ch) return;
    res.json(formView(ch));
}

export async function saveTab(req, res) {
    const ch = await loadOwnCharacter(req, res);
    if (!ch) return;

    const tab = req.params.tab;
    if (!FORM_TABS.includes(tab)) return res.status(404).json({ error: `There is no "${tab}" tab` });
    const check = TAB_CHECKS[tab];
    if (!check) return res.status(400).json({ error: `The ${tab} tab can't be saved yet` });

    const options = optionsForSave(ch, tab, req.body);
    const checked = check(options, req.body, ch);
    if ('error' in checked) return res.status(400).json({ error: checked.error });

    // Until R4.9 the old editor owns a finished character's level, role and traits.
    if (!ch.is_draft && checked.values.level !== undefined && checked.values.level !== ch.level) {
        return res.status(400).json({ error: 'Change the level of a finished character with the level editor for now' });
    }
    const blocked = finishedFormBlock(tab, Boolean(ch.is_draft));
    if (blocked) return res.status(400).json({ error: blocked });

    // The server decides: below level 3 the calling is gone, even if the browser still sends one on the header.
    if (tab === 'header' && Number(checked.values.level) < CALLING_LEVEL) {
        Object.assign(checked.values, clearedCalling(ch.feature_choices));
    }
    if (tab === 'role') {
        const roleChanged = Number(ch.role_id) !== Number(checked.values.role_id);
        checked.values.feature_choices = keepUnrelatedChoices(ch.feature_choices, checked.values.feature_choices, options.features, roleChanged);
    }

    await Form.updateCharacterFields(ch.id, checked.values);
    res.json(formView(await Form.getFormCharacter(ch.id)));
}

// POST /api/characters/:id/stat-rolls
// { index: 0..7 } rolls one 4d6-drop-lowest. { reset: 'placements' | 'rolls' } clears placement or every roll.
export async function rollStat(req, res) {
    const ch = await loadOwnCharacter(req, res);
    if (!ch) return;

    const request = checkStatRollBody(req.body);
    if ('error' in request) return res.status(400).json({ error: request.error });

    // Rolls, resets, placements, bonuses and gifts all stay on the old editor until R4.9.
    const blocked = finishedFormBlock('traits', Boolean(ch.is_draft));
    if (blocked) return res.status(400).json({ error: blocked });

    // Rolling again, and clearing the dice, are rerolls. Moving a roll to another stat is not.
    const reroll = 'index' in request || request.reset === 'rolls';
    if (reroll) {
        const allowed = rerollAllowed(Boolean(ch.is_draft));
        if ('error' in allowed) return res.status(400).json({ error: allowed.error });
    }

    let state = readStatRolls(ch.stat_rolls);
    const values = {};
    if ('index' in request) {
        state = writeRoll(state, request.index, roll4d6DropLowest(rng));
        for (const stat of STAT_COLUMNS) {
            if (state.placement[stat] === request.index) values[stat] = scoreFromRolls(state, stat, ch.plus2_stat, ch.plus1_stat);
        }
    } else if (request.reset === 'placements') {
        state = { ...state, placement: {} };
        for (const stat of STAT_COLUMNS) values[stat] = null;
    } else {
        state = { ...emptyStatRolls(), gifts: state.gifts };
        for (const stat of STAT_COLUMNS) values[stat] = null;
    }
    values.stat_rolls = state;
    await Form.updateCharacterFields(ch.id, values);
    res.json(formView(await Form.getFormCharacter(ch.id)));
}

export async function finish(req, res) {
    const ch = await loadOwnCharacter(req, res);
    if (!ch) return;
    if (!ch.is_draft) return res.status(400).json({ error: 'This character is already finished' });

    const missing = missingForFinish(ch);
    if (missing.length > 0) return res.status(400).json({ error: 'Some tabs are not done yet', missing });

    const sides = hitDieSides(getRole(ch.role_id)?.hit_die);
    if (!sides) return res.status(400).json({ error: 'That role has no hit die' });
    const firstRoll = rollDice(`1d${sides}`, rng).total;   // the server rolls, as always
    await Form.finishCharacter(ch, startingHp(sides, ch.con, ch.level, firstRoll));
    res.json({ id: ch.id });
}
