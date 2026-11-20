// The server's dice. This is the only place in Tenebris that makes random numbers for the game.
// crypto.randomInt is a fair random source (Math.random is not meant for that).
import { randomInt } from 'node:crypto';

// rng(6) -> a whole number from 1 to 6
export const rng = (sides) => randomInt(1, sides + 1);
