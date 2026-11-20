// Small game-math helpers shared by the server (the authority) and the web app (previews).
// Nothing here is random: dice live in dice.ts and only the server rolls them.

// Ability score -> modifier: 10 -> +0, 16 -> +3, 7 -> -2
export const modOf = (score: number | string): number => Math.floor(Number(score) / 2) - 5;

// 3 -> "+3", -1 -> "-1"
export const signed = (n: number): string => (n >= 0 ? '+' : '') + n;

// HP as a 0-4 band (4 = full health)
export const healthInit = (current: number, max: number): number => {
    const pct = max > 0 ? current / max : 0;
    if (pct >= 1) return 4;
    if (pct >= 0.75) return 3;
    if (pct >= 0.5) return 2;
    if (pct >= 0.25) return 1;
    return 0;
};

// "strength" -> "Strength"
export const capitalize = (text: string | null | undefined): string => (text || '').replace(/^\w/, (c) => c.toUpperCase());

export const proficiencyBonus = (level: number): number => 2 + Math.floor((level - 1) / 4);
