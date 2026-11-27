// Per-device graphics quality for the table. Stored in localStorage on this machine only;
// it is not part of the board Look and is never saved with the scene.
import { useSyncExternalStore } from 'react'

export const GRAPHICS_LEVELS = ['low', 'medium', 'high'] as const;
export type GraphicsLevel = (typeof GRAPHICS_LEVELS)[number];
export const DEFAULT_GRAPHICS_LEVEL: GraphicsLevel = 'high';
export const GRAPHICS_STORAGE_KEY = 'tenebris-graphics';
export const GRAPHICS_EVENT = 'tenebris-graphics';

export type TextureQuality = '1k' | '2k';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';

export type GraphicsOptions = {
    level: GraphicsLevel;
    dpr: number;
    antialias: boolean;
    shadows: ShadowQuality;
    shadowMapSize: number;
    textureQuality: TextureQuality;
    lightModels: boolean;
};

export function isGraphicsLevel(value: unknown): value is GraphicsLevel {
    return value === 'low' || value === 'medium' || value === 'high';
}

export function graphicsOptions(level: GraphicsLevel, devicePixelRatio = 1): GraphicsOptions {
    if (level === 'low') {
        return { level, dpr: 1, antialias: false, shadows: 'off', shadowMapSize: 0, textureQuality: '1k', lightModels: true };
    }
    if (level === 'medium') {
        return { level, dpr: Math.min(1.5, devicePixelRatio), antialias: true, shadows: 'medium', shadowMapSize: 2048, textureQuality: '1k', lightModels: true };
    }
    return { level, dpr: Math.min(2, devicePixelRatio), antialias: true, shadows: 'high', shadowMapSize: 4096, textureQuality: '2k', lightModels: false };
}

export function readGraphicsLevel(): GraphicsLevel {
    try {
        const saved = localStorage.getItem(GRAPHICS_STORAGE_KEY);
        if (isGraphicsLevel(saved)) return saved;
    } catch { /* private mode */ }
    return DEFAULT_GRAPHICS_LEVEL;
}

export function writeGraphicsLevel(level: GraphicsLevel) {
    try { localStorage.setItem(GRAPHICS_STORAGE_KEY, level); } catch { /* private mode */ }
    try { window.dispatchEvent(new Event(GRAPHICS_EVENT)); } catch { /* no window */ }
}

function subscribe(onChange: () => void) {
    window.addEventListener(GRAPHICS_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
        window.removeEventListener(GRAPHICS_EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

export function useGraphics(): GraphicsOptions {
    const level = useSyncExternalStore(subscribe, readGraphicsLevel, () => DEFAULT_GRAPHICS_LEVEL);
    const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
    return graphicsOptions(level, devicePixelRatio);
}