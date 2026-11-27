type Loose = Record<string, unknown>;
export const text = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
export const yes = (v: unknown) => v === true;
export type { Loose };
