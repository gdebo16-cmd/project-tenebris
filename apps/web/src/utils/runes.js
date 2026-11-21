// The rune effects live in @tenebris/rules now (shared with the server). Re-exported so old imports keep working.
export { weaponRuneEffects, armorRuneEffects, runicStrikeDice, utilityRuneEffects } from '@tenebris/rules/runes';

// No gear table: runes listed for "gear" go on worn armor or shields (same rule as the server's runeFitsItem)
export const runeFits = (rune, itemType) => rune.item_types.includes(itemType) || (rune.item_types.includes('gear') && (itemType === 'armor' || itemType === 'shield'));
