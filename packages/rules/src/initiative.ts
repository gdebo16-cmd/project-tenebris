// Turn order for the DM page (R5.7). The server rolls everyone's initiative (d20 + their Creature's initiative),
// sorts, and keeps whose turn it is and the round. The DM only says "roll", "next turn" or "clear".
import { rollToHit, type Rng } from './dice.ts';

export type Combatant = { kind: 'character' | 'monster'; id: number; name: string; bonus: number };
export type InitiativeEntry = Combatant & { roll: number };
export type InitiativeState = { round: number; turn: number; order: InitiativeEntry[] };

export type InitiativeOp = 'roll' | 'next' | 'clear';
const OPS: InitiativeOp[] = ['roll', 'next', 'clear'];

export function checkInitiativeRequest(body: unknown): { error: string } | { op: InitiativeOp } {
    const op = ((body ?? {}) as Record<string, unknown>).op;
    if (!OPS.includes(op as InitiativeOp)) return { error: 'op must be roll, next or clear' };
    return { op: op as InitiativeOp };
}

// Highest roll first. Ties: the higher bonus, then characters before monsters, then by name.
export function rollInitiative(combatants: Combatant[], rng: Rng): InitiativeState {
    const order = combatants
        .map((c) => ({ ...c, roll: rollToHit(c.bonus, rng).total }))
        .sort((a, b) => b.roll - a.roll || b.bonus - a.bonus
            || (a.kind === b.kind ? 0 : a.kind === 'character' ? -1 : 1)
            || a.name.localeCompare(b.name));
    return { round: 1, turn: 0, order };
}

// The next turn; after the last one, back to the top and a new round
export function nextTurn(state: InitiativeState): InitiativeState {
    if (state.order.length === 0) return state;
    const turn = state.turn + 1;
    return turn >= state.order.length ? { ...state, turn: 0, round: state.round + 1 } : { ...state, turn };
}

// A saved state from the database, or null if it isn't one (never trust a stored blob's shape)
export function initiativeOf(raw: unknown): InitiativeState | null {
    const s = raw as InitiativeState | null;
    if (!s || !Array.isArray(s.order) || !Number.isInteger(s.round) || !Number.isInteger(s.turn)) return null;
    return { round: s.round, turn: Math.min(Math.max(0, s.turn), Math.max(0, s.order.length - 1)), order: s.order };
}
