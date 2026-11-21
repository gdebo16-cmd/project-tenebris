// The pack the character form's rules read: the content pack plus looks.json, joined once at startup.
// Used by the options endpoint and the form's save checks, so both see exactly the same choices.
import content from './content.js';
import looks from './looks.js';

const formPack = { ...content, looks };

export default formPack;
