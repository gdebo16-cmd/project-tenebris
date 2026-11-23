export type Hex = {
    q: number;
    r: number;
};

export const HEX_DIRECTIONS: Hex[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
];

export function neighbors (hex: Hex): Hex[] {
    const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
    return HEX_DIRECTIONS.map(dir => add(hex, dir));
}


export function distance(a: Hex, b: Hex): number {
    const dq = b.q - a.q;
    const dr = b.r - a.r;
    const ds = dq + dr;
    const dist = Math.abs(dq) + Math.abs(dr) + Math.abs(ds);
    return dist / 2;
}   

export function hexKey(hex: Hex): string {
    return `${hex.q},${hex.r}`;
}

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
