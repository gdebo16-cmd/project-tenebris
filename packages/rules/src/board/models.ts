import { type Hex, hexKey, hexFromKey } from './hex.ts';
import { LIBRARY_MODELS } from './modelsLibrary.ts';

// T7: a model is only a picture. The footprint (which hexes it covers) is what the server uses
// for movement and sight. Today's simple-shape trees and boulders already work this way; a
// library entry swaps in a real .glb and can cover more than one hex later (T10).
export type BoardModel = {
    id: string;
    name: string;
    file: string;
    lightFile?: string;
    footprint: readonly Hex[];
    blocksMovement: boolean;
    blocksSight: boolean;
    kind?: string;
    category?: string;
};

export const BOARD_MODELS: readonly BoardModel[] = LIBRARY_MODELS;

const BY_ID = new Map(BOARD_MODELS.map((m) => [m.id, m]));
const BY_KIND = new Map(BOARD_MODELS.filter((m) => m.kind).map((m) => [m.kind, m]));

export type Modeled = { kind: string; model?: string };

export function modelById(id: string): BoardModel | undefined {
    return BY_ID.get(id);
}

export function modelOf(feature: Modeled): BoardModel | undefined {
    if (feature.model) return BY_ID.get(feature.model);
    return feature.kind ? BY_KIND.get(feature.kind) : undefined;
}

export function modelFile(model: BoardModel, light: boolean): string {
    if (light) return model.lightFile ?? model.file.replace(/\.glb$/, '.light.glb');
    return model.file;
}

export function footprintHexes(origin: Hex, footprint: readonly Hex[] = [{ q: 0, r: 0 }]): Hex[] {
    return footprint.map((cell) => ({ q: origin.q + cell.q, r: origin.r + cell.r }));
}

export function modelFootprint(origin: Hex, feature: Modeled): Hex[] {
    return footprintHexes(origin, modelOf(feature)?.footprint ?? [{ q: 0, r: 0 }]);
}

export function featuresCovering<T extends Modeled>(features: Record<string, T>, key: string): T[] {
    const out: T[] = [];
    for (const [originKey, feature] of Object.entries(features)) {
        if (!feature) continue;
        if (originKey === key) {
            out.push(feature);
            continue;
        }
        const origin = hexFromKey(originKey);
        if (origin && modelFootprint(origin, feature).some((hex) => hexKey(hex) === key)) out.push(feature);
    }
    return out;
}