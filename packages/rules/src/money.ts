// Money (R5): five separate coins on the character row. Coins never change into each other automatically.
// For reference: 10 copper = 1 silver, 10 silver = 1 gold, 10 gold = 1 crown, 10 crowns = 1 oracle.
// The browser asks to add or spend some coins; these functions check the request and name a short coin.

export const COINS = ['copper', 'silver', 'gold', 'crowns', 'oracles'] as const;
export type Coin = (typeof COINS)[number];
export type Purse = Record<Coin, number>;
export type MoneyAction = 'add' | 'spend';
export type MoneyRequest = { action: MoneyAction; amounts: Purse };

// One request may move at most this many of a coin (keeps totals far inside a Postgres integer)
export const MAX_COINS_PER_CHANGE = 1_000_000;

// A purse from a character row: missing or empty columns count as 0
export function purseOf(row: Partial<Record<Coin, unknown>> | null | undefined): Purse {
    return Object.fromEntries(COINS.map((c) => [c, Number(row?.[c] ?? 0) || 0])) as Purse;
}

// Checks { action, copper, silver, gold, crowns, oracles }. A missing coin is 0; every amount is a whole
// number from 0 up, and at least one is more than 0.
export function checkMoneyRequest(body: unknown): { error: string } | { request: MoneyRequest } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (b.action !== 'add' && b.action !== 'spend') return { error: 'action must be add or spend' };
    const amounts = {} as Purse;
    for (const c of COINS) {
        const raw = b[c] ?? 0;
        const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
        if (!Number.isInteger(n) || n < 0) return { error: `${c} must be a whole number, 0 or more` };
        if (n > MAX_COINS_PER_CHANGE) return { error: `${c} can't be more than ${MAX_COINS_PER_CHANGE.toLocaleString('en-US')} at once` };
        amounts[c] = n;
    }
    if (COINS.every((c) => amounts[c] === 0)) return { error: 'Add or spend at least one coin' };
    return { request: { action: b.action, amounts } };
}

// The first coin the purse doesn't have enough of for this spend, as the message to show; null = it can pay
export function shortCoinMessage(purse: Purse, spend: Purse): string | null {
    const short = COINS.find((c) => purse[c] < spend[c]);
    return short ? `Not enough ${short}.` : null;
}

// The purse after a change (what the database UPDATE does), for tests and previews
export function applyMoney(purse: Purse, request: MoneyRequest): Purse {
    const sign = request.action === 'add' ? 1 : -1;
    return Object.fromEntries(COINS.map((c) => [c, purse[c] + sign * request.amounts[c]])) as Purse;
}

// ---- Default money (character form, Gear tab) ----
// A new character picks one of these. It's written to the coin columns while the character is a draft;
// after that, money only changes on the sheet.
export const MONEY_PRESETS = {
    impoverished: { label: 'Impoverished', purse: { copper: 10, silver: 0, gold: 0, crowns: 0, oracles: 0 } },
    average: { label: 'Average', purse: { copper: 10, silver: 10, gold: 0, crowns: 0, oracles: 0 } },
    wealthy: { label: 'Wealthy', purse: { copper: 10, silver: 10, gold: 10, crowns: 0, oracles: 0 } },
} as const satisfies Record<string, { label: string; purse: Purse }>;
export type MoneyPresetKey = keyof typeof MONEY_PRESETS;
export const MONEY_PRESET_KEYS = Object.keys(MONEY_PRESETS) as MoneyPresetKey[];

// Which preset a purse is exactly, or null (a draft that hasn't picked yet has an empty purse)
export function moneyPresetOf(purse: Purse): MoneyPresetKey | null {
    return MONEY_PRESET_KEYS.find((key) => COINS.every((c) => MONEY_PRESETS[key].purse[c] === purse[c])) ?? null;
}

// The browser names a preset; only the three keys are accepted
export function checkMoneyPreset(raw: unknown): { error: string } | { key: MoneyPresetKey } {
    if (typeof raw === 'string' && (MONEY_PRESET_KEYS as string[]).includes(raw)) return { key: raw as MoneyPresetKey };
    return { error: `Default money must be one of: ${MONEY_PRESET_KEYS.map((k) => MONEY_PRESETS[k].label).join(', ')}` };
}
