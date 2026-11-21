// The unified character form (R4): one draft row per new character, one save per tab.
//
//   POST /api/characters                  create a draft from the header { name, level, portrait_url }  -> { id }
//   GET  /api/characters/:id/form         everything the form shows, plus the choices it may offer
//   PUT  /api/characters/:id/form/:tab    check and save one tab
//   POST /api/characters/:id/finish       check every tab is done, roll starting HP, stop being a draft
//
// The rules live in @tenebris/rules (characterOptions + characterForm); this file is the glue.
import { characterOptions } from '@tenebris/rules/characterOptions';
import { checkHeader, checkSpeciesTab, missingForFinish, startingHp, FORM_TABS } from '@tenebris/rules/characterForm';
import { rollDice } from '@tenebris/rules/dice';
import { rng } from '../dice.js';
import formPack from '../models/formPack.js';
import { getRole, hitDieSides } from '../models/content.js';
import * as Form from '../models/characterFormModel.js';

// The tabs that can be saved so far. Each later slice (R4.5-R4.8) adds its check here.
const TAB_CHECKS = {
    header: (options, body) => checkHeader(body),
    species: (options, body) => checkSpeciesTab(options, body),
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

// What GET /form answers, grouped the way the form's tabs are
function formView(ch) {
    return {
        id: ch.id,
        is_draft: ch.is_draft,
        header: { name: ch.name, level: ch.level, portrait_url: ch.portrait_url },
        species: { ...splitSpecies(ch.species_id), size_id: ch.size_id, variant: ch.variant, eye_color: ch.eye_color, look_description: ch.look_description },
        role: { role_id: ch.role_id, calling_id: ch.calling_id },
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

    const checked = check(optionsFor(ch), req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });

    // A finished character's level changes HP, which the old level editor still handles (until R4.9)
    if (!ch.is_draft && checked.values.level !== undefined && checked.values.level !== ch.level) {
        return res.status(400).json({ error: 'Change the level of a finished character with the level editor for now' });
    }

    await Form.updateCharacterFields(ch.id, checked.values);
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
