// Small game-math helpers shared by the server (the authority) and the web app (previews).

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

// "2d6" -> roll two 6-sided dice and add them up; a critical doubles the dice
export const rollDice = (dice: string | number, crit = false): number => {
    const text = String(dice).replace(/\s/g, '');          // "3d4 + 3" becomes "3d4+3"
    if (!text.includes('d')) return Number(text) || 0;     // a flat number like "20"
    const [diePart, bonus = '0'] = text.split('+');        // "3d4" and "3"
    const [count, sides] = diePart.split('d').map(Number);
    const rolls = crit ? count * 2 : count;
    let total = Number(bonus);
    for (let i = 0; i < rolls; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
};

export const d20 = (): number => Math.floor(Math.random() * 20) + 1;

export type ToHitRoll = { natural: number; total: number; crit: boolean; fail: boolean; fumble: boolean };

export const rollToHit = (bonus: number): ToHitRoll => {
    const natural = d20();
    return { natural, total: natural + bonus, crit: natural === 20, fail: natural === 1, fumble: natural === 1 };
};

// Roll 4d6 and drop the lowest
export const roll4d6DropLowest = (): number => {
    const dice = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
    dice.sort((a, b) => a - b);
    return dice[1] + dice[2] + dice[3];
};

// "strength" -> "Strength"
export const capitalize = (text: string | null | undefined): string => (text || '').replace(/^\w/, (c) => c.toUpperCase());

export const proficiencyBonus = (level: number): number => 2 + Math.floor((level - 1) / 4);
