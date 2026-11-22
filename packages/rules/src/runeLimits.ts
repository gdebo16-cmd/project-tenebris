// Tome of Inscription rune limits (rune-weaver-inscribe-runes.md section 3). Index 0 = level 1 ... index 29 = level 30.
// The Mage calling that inscribes runes (it was called Rune Weaver before; one name now, docs/DECISIONS.md)
export const RUNE_CALLING = 'Tome of Inscription';
export const RUNES_PER_ITEM = [0,0,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,3];
export const ACTIVE_RUNES = [0,0,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,6,6,7,7,7,7,8,8,8];
export const WARDING_TYPES = ['acid', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'poison', 'psychic', 'radiant', 'thunder'];

const at = (arr: number[], level: number): number => arr[Math.min(30, Math.max(1, Number(level) || 1)) - 1];
export const runesPerItem = (level: number) => at(RUNES_PER_ITEM, level);
export const activeRunes = (level: number) => at(ACTIVE_RUNES, level);

// No gear table: runes listed for "gear" go on worn armor or shields instead (Lantern, Hush, Mending, Dusksight, Fleet, Warding).
export const runeFitsItem = (itemTypes: string[], type: string) => itemTypes.includes(type) || (itemTypes.includes('gear') && (type === 'armor' || type === 'shield'));
