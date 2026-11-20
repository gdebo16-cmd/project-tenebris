import type { Rng } from '../src/dice.ts';

// Fake dice for tests: hands out the numbers you list, in order.
// fixedDice(3, 5) rolls a 3, then a 5, then complains if asked again.
export function fixedDice(...numbers: number[]): Rng {
    let i = 0;
    return () => {
        if (i >= numbers.length) throw new Error('The test ran out of fake dice');
        return numbers[i++];
    };
}

// Every die lands on its highest face (a d6 rolls 6, a d20 rolls 20)
export const maxDice: Rng = (sides) => sides;
// Every die lands on 1
export const minDice: Rng = () => 1;
