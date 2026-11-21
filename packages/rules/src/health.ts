// HP and temporary HP changes from the sheet's Health block (Damage / Heal / Ward). The server checks the body
// with these and the character model applies it: damage eats temporary HP first, healing stops at max HP,
// and temporary HP doesn't stack (the higher one stays).
export const MAX_HP_CHANGE = 100000;

export type HpRequest = { action: 'heal' | 'damage'; amount: number };
export type TempHpRequest = { amount: number; clear: boolean };

const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_HP_CHANGE;

// { action: 'heal' | 'damage', amount: 1.. }
export function checkHpRequest(body: unknown): { error: string } | { request: HpRequest } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (b.action !== 'heal' && b.action !== 'damage') return { error: 'action must be heal or damage' };
    if (!isAmount(b.amount)) return { error: `amount must be a whole number from 1 to ${MAX_HP_CHANGE}` };
    return { request: { action: b.action, amount: b.amount } };
}

// The signed change the model adds: damage is negative
export const hpChange = (r: HpRequest) => (r.action === 'heal' ? r.amount : -r.amount);

// { amount: 1.. } sets temporary HP (keeps the higher), or { clear: true } removes it
export function checkTempHpRequest(body: unknown): { error: string } | { request: TempHpRequest } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (b.clear === true) return { request: { amount: 0, clear: true } };
    if (b.clear !== undefined && b.clear !== false) return { error: 'clear must be true or false' };
    if (!isAmount(b.amount)) return { error: `amount must be a whole number from 1 to ${MAX_HP_CHANGE}` };
    return { request: { amount: b.amount, clear: false } };
}
