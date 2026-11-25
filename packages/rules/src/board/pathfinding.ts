import type { Hex } from './hex.ts';
import { hexKey, neighbors } from './hex.ts';

export function findPath(start: Hex, goal: Hex, walls: Set<string>, maxSteps: number): Hex[] | null {
    const queue: Hex[] = [start];
    const cameFrom = new Map<string, Hex | null>();
    const steps = new Map<string, number>();
    
    steps.set(hexKey(start), 0);
    cameFrom.set(hexKey(start), null);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (hexKey(current) === hexKey(goal)) break;

        for (const neighbor of neighbors(current)) {
            const next = neighbor;
            const key = hexKey(next);
            const nextSteps = steps.get(hexKey(current))! + 1;
            if (walls.has(key) || cameFrom.has(key) || nextSteps > maxSteps) continue;
            steps.set(key, nextSteps);
            queue.push(next);
            cameFrom.set(key, current);
        }
    }
    
    if (!cameFrom.has(hexKey(goal))) return null;
    const path: Hex[] = [];
    let step: Hex | null = goal;
    while (step) {
        path.push(step);
        step = cameFrom.get(hexKey(step)) ?? null;
    }
    return path.reverse();
    
}