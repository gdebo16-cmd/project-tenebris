export const SCENE_MOODS = ['day', 'dawn', 'dusk', 'night', 'dungeon'] as const;
export type SceneMood = (typeof SCENE_MOODS)[number];
export const SCENE_WEATHERS = ['clear', 'fog', 'rain', 'snow'] as const;
export type SceneWeather = (typeof SCENE_WEATHERS)[number];
export const MAX_HEIGHT = 5;
export type SceneMap = { url: string; size: number };      // size: how many world units wide the picture is (10–80)
export type SceneLook = { mood?: SceneMood; weather?: SceneWeather; room?: boolean; fog?: boolean; map?: SceneMap | null; heights?: Record<string, number> };

// Check a change to the look (anything except heights, which are painted hex by hex). Answers the cleaned change.
export function checkLookChange(body: unknown): { error: string } | { change: Partial<SceneLook> } {
    const b = (body ?? {}) as Record<string, unknown>;
    const change: Partial<SceneLook> = {};
    if ('mood' in b) {
        if (!SCENE_MOODS.includes(b.mood as SceneMood)) return { error: `mood must be one of ${SCENE_MOODS.join(', ')}` };
        change.mood = b.mood as SceneMood;
    }
    if ('weather' in b) {
        if (!SCENE_WEATHERS.includes(b.weather as SceneWeather)) return { error: `weather must be one of ${SCENE_WEATHERS.join(', ')}` };
        change.weather = b.weather as SceneWeather;
    }
    if ('room' in b) {
        if (typeof b.room !== 'boolean') return { error: 'room must be true or false' };
        change.room = b.room;
    }
    if ('fog' in b) {                                      // step 18: players see only what the party can see
        if (typeof b.fog !== 'boolean') return { error: 'fog must be true or false' };
        change.fog = b.fog;
    }
    if ('map' in b) {
        if (b.map === null) change.map = null;
        else {
            const m = (b.map ?? {}) as Record<string, unknown>;
            const url = typeof m.url === 'string' ? m.url.trim() : '';
            if (!/^https?:\/\/\S+$/i.test(url) || url.length > 2000) return { error: 'map url must be a web link (http or https)' };
            const size = m.size === undefined ? 30 : Number(m.size);
            if (!(size >= 10 && size <= 80)) return { error: 'map size must be from 10 to 80' };
            change.map = { url, size };
        }
    }
    if (Object.keys(change).length === 0) return { error: 'Nothing to change' };
    return { change };
}