export const FEET_PER_HEX = 5;
export const hexesForSpeed = (speedFt: number): number => Math.max(0, Math.floor(speedFt / FEET_PER_HEX));