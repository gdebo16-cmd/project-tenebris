// The 8 ability scores and the house-rule skills. "key" is the column name in the characters table.

export type StatKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | 'spd' | 'luc';

export const STATS: { key: StatKey; label: string }[] = [
    { key: 'str', label: 'Might' },
    { key: 'dex', label: 'Precision' },
    { key: 'con', label: 'Endurance' },
    { key: 'int', label: 'Intellect' },
    { key: 'wis', label: 'Judgment' },
    { key: 'cha', label: 'Confidence' },
    { key: 'spd', label: 'Speed' },
    { key: 'luc', label: 'Luck' },
];

// 'DEX' / 'dex' -> 'Precision' (anything unknown comes back as is)
export const statName = (key: string | null | undefined): string =>
    STATS.find((s) => s.key === String(key ?? '').toLowerCase())?.label ?? String(key ?? '');

// 'Might' / 'STR' / 'str' -> 'str' (unknown -> undefined). Use before indexing character[stat].
const STAT_TO_KEY: Record<string, StatKey> = {
    might: 'str', str: 'str',
    precision: 'dex', dex: 'dex',
    endurance: 'con', con: 'con',
    intellect: 'int', int: 'int',
    judgment: 'wis', wis: 'wis',
    confidence: 'cha', cha: 'cha',
    speed: 'spd', spd: 'spd',
    luck: 'luc', luc: 'luc',
};
export const statKey = (stat: string | null | undefined): StatKey | undefined =>
    stat == null || stat === '' ? undefined : STAT_TO_KEY[String(stat).trim().toLowerCase()];

// Each skill adds the modifiers of two stats (plus proficiency when the character has it).
export const SKILLS: { id: string; name: string; stats: [StatKey, StatKey] }[] = [
    { id: 'finesse', name: 'Finesse', stats: ['dex', 'con'] },
    { id: 'memory', name: 'Memory', stats: ['int', 'con'] },
    { id: 'awareness', name: 'Awareness', stats: ['wis', 'spd'] },
    { id: 'knowledge', name: 'Knowledge', stats: ['int', 'cha'] },
    { id: 'faith', name: 'Faith', stats: ['cha', 'luc'] },
    { id: 'arcana', name: 'Arcana', stats: ['int', 'wis'] },
    { id: 'botany', name: 'Botany', stats: ['int', 'dex'] },
    { id: 'triage', name: 'Triage', stats: ['wis', 'dex'] },
    { id: 'diplomacy', name: 'Diplomacy', stats: ['cha', 'spd'] },
    { id: 'misdirection', name: 'Misdirection', stats: ['spd', 'luc'] },
    { id: 'stealth', name: 'Stealth', stats: ['spd', 'con'] },
    { id: 'presence', name: 'Presence', stats: ['str', 'wis'] },
    { id: 'showmanship', name: 'Showmanship', stats: ['cha', 'str'] },
    { id: 'dominance', name: 'Dominance', stats: ['str', 'int'] },
    { id: 'balance', name: 'Balance', stats: ['str', 'dex'] },
];
