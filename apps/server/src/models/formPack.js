// The pack the character form's rules read: the content pack plus looks.json, joined once at startup.
// Used by the options endpoint and the form's save checks, so both see exactly the same choices.
import content from './content.js';
import looks from './looks.js';
import { liveStates } from './spellPack.js';

// spell_states is the live list a wildcard personality pick may choose from.
const formPack = { ...content, looks, spell_states: liveStates().map((name) => ({ name, retired: false })) };

export default formPack;
