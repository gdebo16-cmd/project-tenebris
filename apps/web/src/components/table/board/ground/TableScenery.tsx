// The table's scenery: the hexes and what's on them, the felt tabletop and the wooden rim.
// Each hex has a SURFACE (how it looks: grass, cobble, wood floor...) and maybe a TERRAIN on top (the rules):
//   block -> a raised stone block (a wall)   deep  -> water instead of the surface
//   slick -> a shiny see-through ice layer over the surface
//   rough -> small rocks scattered on the surface        (steep only changes walking; heights show it)
// Every picture set lives in assets/textures/: color.jpg, normal.jpg (GL), rough.jpg. Until they load (or if one
// fails) the board draws the same shapes in plain colours, so it never goes blank.
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import { Instances, Instance, useTexture } from '@react-three/drei'
import { type Hex, hexKey, neighbors, waterShoreEdges, SURFACES, DEFAULT_SURFACE, isCoreSurface, isSurface, type CoreSurface, type Surface, type BoardStyle } from '@tenebris/rules/board'
import { paintById } from '@tenebris/rules/board'
import { surfaceSet, textureUrl } from './groundTextures.ts'
import { hexToWorld, worldToHex, HEIGHT_STEP, liftOf, rimInner, rimOuter } from './hexMath.ts'
import { useGraphics } from '../../../../features/table/hooks/graphicsSettings.ts'
import { Shape, ExtrudeGeometry, RepeatWrapping, SRGBColorSpace, type BufferGeometry, type Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { paintTiles, paintStone, waterLookFor, iceLook } from './boardLooks.ts'
import { useCssColor } from '../../../../hooks/useCssColor.ts'
import { NaturalGround, radiusOfHexes } from './TableNatural.tsx'

const backgroundColor = useCssColor('--background-color', '#0e1815');


// Photo textures (assets/textures) on the hexes and the tabletop: off for now (owner's call, 2026-11-23: the painted
// photo look wasn't working); the board draws the same shapes in plain colours. The wooden rim keeps its wood picture.
// Set to true to bring the rest of the pictures back.
const USE_TEXTURES = false;


export { hexToWorld, worldToHex, HEIGHT_STEP, liftOf, rimInner, rimOuter } from './hexMath.ts'

// ---- how each surface looks ----

// flat = the plain colour before the pictures load. straight = the picture has a direction (planks, rows of bricks):
// those hexes all face the same way instead of getting a random turn.
export const SURFACE_LOOK: Record<CoreSurface, { label: string; flat: string; straight?: boolean }> = {
    grass:     { label: 'Grass',      flat: '#3f6b2a' },
    moss:      { label: 'Moss',       flat: '#5a6b33' },
    dirt:      { label: 'Dirt',       flat: '#6b5440' },
    cobble:    { label: 'Cobble',     flat: '#8a8a7a' },
    flagstone: { label: 'Flagstone',  flat: '#7a7468' },
    rock:      { label: 'Rock',       flat: '#5d5a55' },
    bricks:    { label: 'Bricks',     flat: '#9a7b5c', straight: true },
    snow:      { label: 'Snow',       flat: '#e8eef2' },
    bark:      { label: 'Bark',       flat: '#5a4632' },
    woodfloor: { label: 'Wood floor', flat: '#7a5a3a', straight: true },
    roof:      { label: 'Roof',       flat: '#3a3a3e', straight: true },
};

const CATEGORY_FLAT: Record<string, string> = {
    grass: '#3f6b2a', moss: '#5a6b33', 'forest floor': '#4a5a32', dirt: '#6b5440', mud: '#5a4030',
    sand: '#c2a36b', gravel: '#8a8680', 'cobble and paving': '#8a8a7a', 'brick floors': '#9a7b5c',
    rock: '#5d5a55', snow: '#e8eef2', 'wood planks': '#7a5a3a', bark: '#5a4632',
};

export function surfaceLook(surface: string): { label: string; flat: string; straight?: boolean } {
    if (isCoreSurface(surface)) return SURFACE_LOOK[surface];
    const paint = paintById(surface);
    if (!paint) return { label: surface, flat: '#6b665e' };
    const straight = paint.category === 'wood planks' || paint.category === 'brick floors';
    return { label: paint.name, flat: CATEGORY_FLAT[paint.category] ?? '#6b665e', straight };
}

const TILE_HEIGHT = 0.2;           // every hex's bottom sits at -0.1, so a tile's top is at 0.1
const WALL_HEIGHT = 1;             // walls stand up as blocks
const WATER = { roughness: 0.08 };   // custom water (T2): colour, depth and foam come from waterLookFor in boardLooks.ts

// How far each water hex is from land, in hexes (1 = on the shore), counted up to 3: shallow water by the shore, deep
// water further out. Off-board hexes count as land.
export function waterDepths(water: Hex[]): Map<string, number> {
    const isWater = new Set(water.map(hexKey));
    const depth = new Map<string, number>();
    let ring = water.filter((h) => neighbors(h).some((n) => !isWater.has(hexKey(n))));
    for (let d = 1; ring.length > 0; d++) {
        for (const h of ring) depth.set(hexKey(h), Math.min(d, 3));
        ring = [...new Map(ring.flatMap((h) => neighbors(h)).filter((n) => isWater.has(hexKey(n)) && !depth.has(hexKey(n))).map((n) => [hexKey(n), n])).values()];
    }
    return depth;
}
// One batch per depth and land-edge mask, so foam can differ from hex to hex.
function groupWater(water: Hex[], depths: Map<string, number>) {
    const isWater = new Set(water.map(hexKey));
    const groups: { key: string; d: number; look: ReturnType<typeof waterLookFor>; hexes: Hex[] }[] = [];
    const index = new Map<string, number>();
    for (const hex of water) {
        const d = depths.get(hexKey(hex)) ?? 1;
        const edges = waterShoreEdges(hex, isWater);
        const key = d + ':' + edges;
        let i = index.get(key);
        if (i === undefined) {
            i = groups.length;
            index.set(key, i);
            groups.push({ key, d, look: waterLookFor((d - 1) / 2, edges), hexes: [] });
        }
        groups[i].hexes.push(hex);
    }
    return groups;
}

// Small "random" numbers that are the same on every screen for the same hex (so rocks don't jump about on a repaint)
export function fixedRandom(hex: Hex, n: number) {
    let h = Math.imul(hex.q, 374761393) ^ Math.imul(hex.r, 668265263) ^ Math.imul(n + 1, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;      // 0 up to (not including) 1
}

// A turn for each hex: a multiple of 60° (so hexes still line up), to hide the repeating picture. Straight ones don't turn.
const turnFor = (hex: Hex, surface: string) =>
    Math.PI / 6 + (surfaceLook(surface).straight ? 0 : Math.floor(fixedRandom(hex, 99) * 6) * (Math.PI / 3));

// ---- the pictures ----

// The three pictures for one look: colour, bumps (normal) and shininess (roughness)
const filesFor = (name: string, folder: string) => ({
    [`${name}Color`]: `/textures/${folder}/color.jpg`,
    [`${name}Normal`]: `/textures/${folder}/normal.jpg`,
    [`${name}Rough`]: `/textures/${folder}/rough.jpg`,
});
const BOARD_FILES = Object.assign({},
    ...SURFACES.map((s) => filesFor(s, `surfaces/${s}`)),
    filesFor('wall', 'wall'),
    filesFor('ice', 'ice'),
) as Record<string, string>;

// Only the colour picture is a colour (sRGB). Normal and roughness pictures are data: marking them sRGB bends the numbers.
function prepare(textures: Record<string, Texture>, repeat = 1) {
    for (const [key, t] of Object.entries(textures)) {
        if (key.endsWith('Color')) t.colorSpace = SRGBColorSpace;
        t.anisotropy = 16;                         // stays sharp when the camera is tilted
        t.wrapS = t.wrapT = RepeatWrapping;        // past the edge of the picture, start it again (tiling)
        if (repeat !== 1) t.repeat.set(repeat, repeat);
        t.needsUpdate = true;                      // the picture was already sent to the graphics card: send it again with these settings
    }
}

type Pictures = Record<string, Texture> | null;    // null = plain colours
const pictures = (tex: Pictures, name: string) =>
    tex ? { map: tex[`${name}Color`], normalMap: tex[`${name}Normal`], roughnessMap: tex[`${name}Rough`] } : {};

// If a picture is missing or broken, show the plain version instead of crashing the whole board.
// (React only catches errors with a class component: this is the one place we need one.)
class Fallback extends Component<{ plain: ReactNode; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: unknown) { console.warn('Table textures did not load, using plain colours:', error); }
    render() { return this.state.failed ? this.props.plain : this.props.children; }
}

// ---- the hexes ----

type TerrainProps = {
    hexes: Hex[];
    terrain: Record<string, string>;     // the rules: { "q,r": "wall" }
    surfaces: Record<string, string>;    // the looks: { "q,r": "cobble" }
    heights: Record<string, number>;     // raised ground: { "q,r": 2 }
    onHexClick: (hex: Hex, e: ThreeEvent<MouseEvent>) => void;
    style?: BoardStyle;                  // T1: 'tiles' (hex tiles, the default) or 'natural' (one blended ground, T3)
    radius?: number;                     // the board's size (worked out from the hexes when missing)
};

// Sort the hexes into what gets drawn where. An unknown surface name from the server just shows the default.
function sortHexes(hexes: Hex[], terrain: Record<string, string>, surfaces: Record<string, string>) {
    const tiles: Record<string, Hex[]> = Object.fromEntries(SURFACES.map((s) => [s, [] as Hex[]]));
    const walls: Hex[] = [], water: Hex[] = [], ice: Hex[] = [], rough: Hex[] = [];
    for (const hex of hexes) {
        const key = hexKey(hex);
        const rule = terrain[key];
        if (rule === 'block') { walls.push(hex); continue; }     // the block replaces the tile
        if (rule === 'deep') { water.push(hex); continue; }      // water replaces the tile
        const surface = isSurface(surfaces[key]) ? surfaces[key] : DEFAULT_SURFACE;
        tiles[surface].push(hex);
        if (rule === 'slick') ice.push(hex);                     // these sit on top of the tile
        if (rule === 'rough') rough.push(hex);
    }
    return { tiles, walls, water, ice, rough };
}

const ROCKS_PER_HEX = 7;

// ---- walls ----
// All the wall hexes are joined into ONE shape, and the stone picture is laid across the world (like one big stone
// surface with the wall cut out of it), so neighbouring wall hexes share one continuous pattern: a line of walls reads
// as one wall, not a row of pillars. Each block has bevelled edges and its own slightly different height.
const WALL_BEVEL = 0.07;
const WALL_TEXTURE_SIZE = 2;       // one copy of the stone picture covers 2 x 2 world units (about one hex)

// One wall block: a hexagon pushed up, with rounded-off edges. Its base sits at y = 0.
const WALL_PIECE = (() => {
    const s = new Shape();
    const radius = 1 - WALL_BEVEL;                     // the bevel grows the shape, so start smaller and end up hex-sized
    for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;                   // flat-top: corners at 0°, 60°, 120°... like the grid
        if (k === 0) s.moveTo(radius * Math.cos(a), radius * Math.sin(a));
        else s.lineTo(radius * Math.cos(a), radius * Math.sin(a));
    }
    const g = new ExtrudeGeometry(s, {
        depth: WALL_HEIGHT - 2 * WALL_BEVEL, bevelEnabled: true,
        bevelThickness: WALL_BEVEL, bevelSize: WALL_BEVEL, bevelSegments: 2,
    });
    g.rotateX(-Math.PI / 2);                           // stand it up: the push now points up
    g.translate(0, WALL_BEVEL, 0);                     // base at 0
    return g;
})();

// Give every corner of the joined walls picture coordinates from its place in the world:
// tops use x and z (seen from above), sides use "along the face" and height.
function layStoneAcrossWorld(g: BufferGeometry) {
    const pos = g.getAttribute('position'), normal = g.getAttribute('normal'), uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i);
        if (Math.abs(ny) > 0.6) {
            uv.setXY(i, x / WALL_TEXTURE_SIZE, z / WALL_TEXTURE_SIZE);                  // a top (or bevel facing up)
        } else {
            const along = (x * -nz + z * nx) / (Math.hypot(nx, nz) || 1);             // distance along this face
            uv.setXY(i, along / WALL_TEXTURE_SIZE, y / WALL_TEXTURE_SIZE);
        }
    }
    uv.needsUpdate = true;
}

// How tall each wall block is (a little taller or shorter than WALL_HEIGHT, fixed per hex), and where its top is
const wallHeightFor = (hex: Hex) => (0.85 + fixedRandom(hex, 7) * 0.3) * WALL_HEIGHT;
export const wallTop = (hex: Hex) => wallHeightFor(hex) - 0.1;

function buildWalls(walls: Hex[]): BufferGeometry | null {
    if (walls.length === 0) return null;
    const blocks = walls.map((hex) => {
        const block = WALL_PIECE.clone();
        block.scale(1, wallHeightFor(hex) / WALL_HEIGHT, 1);     // each block a little taller or shorter
        const [x, , z] = hexToWorld(hex, 1);
        block.translate(x, -0.1, z);                              // every hex's bottom sits at -0.1
        return block;
    });
    const joined = mergeGeometries(blocks);
    blocks.forEach((b) => b.dispose());
    if (!joined) return null;
    layStoneAcrossWorld(joined);
    return joined;
}

function Walls({ walls, tex, onHexClick }: { walls: Hex[]; tex: Pictures; onHexClick: TerrainProps['onHexClick'] }) {
    const geometry = useMemo(() => buildWalls(walls), [walls]);
    useEffect(() => () => geometry?.dispose(), [geometry]);       // free the old shape when the walls change
    if (!geometry) return null;
    return (
        <mesh geometry={geometry} castShadow receiveShadow
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
                // which hex was clicked: step a hair back inside the wall from where the click landed
                const n = e.face?.normal;
                const hex = worldToHex(e.point.x - (n?.x ?? 0) * 0.05, e.point.z - (n?.z ?? 0) * 0.05);
                e.stopPropagation();
                onHexClick(hex, e);
            }}>
            <meshPhysicalMaterial {...pictures(tex, 'wall')} color={tex ? 'white' : '#6b665e'} roughness={1} onBeforeCompile={paintStone} />
        </mesh>
    );
}


function LibrarySurfaceTiles({ surface, hexes, limit, raised, stretch }: {
    surface: string;
    hexes: Hex[];
    limit: number;
    raised: (hex: Hex) => [number, number, number];
    stretch: (hex: Hex) => [number, number, number];
}) {
    const look = surfaceLook(surface);
    const body = (pictures: Pictures) => (
        <Instances limit={limit} receiveShadow>
            <cylinderGeometry args={[1, 1, TILE_HEIGHT, 6]} />
            <meshPhysicalMaterial {...(pictures ? { map: pictures.color, normalMap: pictures.normal, roughnessMap: pictures.rough } : {})} color={pictures ? 'white' : look.flat} roughness={1} onBeforeCompile={paintTiles} />
            {hexes.map((hex) => (
                <Instance key={hexKey(hex)} position={raised(hex)} scale={stretch(hex)} rotation={[0, turnFor(hex, surface), 0]} />
            ))}
        </Instances>
    );
    if (!USE_TEXTURES) return body(null);
    return (
        <Suspense fallback={body(null)}>
            <LibrarySurfacePictures surface={surface}>{body}</LibrarySurfacePictures>
        </Suspense>
    );
}

function LibrarySurfacePictures({ surface, children }: { surface: string; children: (pictures: Pictures) => ReactNode }) {
    const graphics = useGraphics();
    const folder = surfaceSet(surface).folder;
    const urls = {
        color: textureUrl(folder, 'color', graphics.textureQuality),
        normal: textureUrl(folder, 'normal', graphics.textureQuality),
        rough: textureUrl(folder, 'rough', graphics.textureQuality),
    };
    const tex = useTexture(urls) as { color: Texture; normal: Texture; rough: Texture };
    useMemo(() => {
        tex.color.colorSpace = SRGBColorSpace;
        for (const picture of Object.values(tex)) {
            picture.anisotropy = 16;
            picture.wrapS = picture.wrapT = RepeatWrapping;
            picture.needsUpdate = true;
        }
    }, [tex]);
    return children(tex);
}

// Everything on the grid. tex = the loaded pictures, or null for plain colours (same shapes either way).
function BoardHexes({ hexes, terrain, surfaces, heights, onHexClick, tex }: TerrainProps & { tex: Pictures }) {
    const sorted = useMemo(() => sortHexes(hexes, terrain, surfaces), [hexes, terrain, surfaces]);
    const depths = useMemo(() => waterDepths(sorted.water), [sorted.water]);
    const waterGroups = useMemo(() => groupWater(sorted.water, depths), [sorted.water, depths]);
    const at = (hex: Hex, y: number): [number, number, number] => { const [x, , z] = hexToWorld(hex, 1); return [x, y + liftOf(heights, hex), z]; };
    // a raised tile is the same hex column, stretched upwards (its bottom stays on the table)
    const raised = (hex: Hex): [number, number, number] => { const [x, , z] = hexToWorld(hex, 1); const l = liftOf(heights, hex); return [x, l / 2, z]; };
    const stretch = (hex: Hex): [number, number, number] => [1, (TILE_HEIGHT + liftOf(heights, hex)) / TILE_HEIGHT, 1];
    // (clicks on tiles, water and rocks are caught by the one invisible sheet over the board: HoverLayer in TablePage)

    return (
        <>
            {/* the surfaces: one batch per kind of ground */}
            {SURFACES.map((s) => sorted.tiles[s].length > 0 && (
                <Instances key={s} limit={hexes.length} receiveShadow>
                    <cylinderGeometry args={[1, 1, TILE_HEIGHT, 6]} />
                    <meshPhysicalMaterial {...pictures(tex, s)} color={tex ? 'white' : SURFACE_LOOK[s].flat} roughness={1} onBeforeCompile={paintTiles} />
                    {sorted.tiles[s].map((hex) => (
                        <Instance key={hexKey(hex)} position={raised(hex)} scale={stretch(hex)} rotation={[0, turnFor(hex, s), 0]} />
                    ))}
                </Instances>
            ))}
            {Object.entries(sorted.tiles).filter(([s, list]) => list.length > 0 && !isCoreSurface(s)).map(([s, list]) => (
                <LibrarySurfaceTiles key={s} surface={s} hexes={list} limit={hexes.length} raised={raised} stretch={stretch} />
            ))}

            {/* walls: one joined stone mass standing up from the board */}
            <Walls walls={sorted.walls} tex={tex} onHexClick={onHexClick} />

            {/* water: custom water in place of the ground, a little lower, with moving ripples; clear by the shore with
                foam, darker further out (waterLookFor in boardLooks.ts). One batch per depth. */}
            {waterGroups.map(({ key, look, hexes: level }) => (
                <Instances key={key} limit={hexes.length} receiveShadow>
                    <cylinderGeometry args={[1, 1, TILE_HEIGHT, 6]} />
                    <meshPhysicalMaterial roughness={WATER.roughness} clearcoat={1} clearcoatRoughness={0.05} transparent onBeforeCompile={look} />
                    {level.map((hex) => (
                        <Instance key={hexKey(hex)} position={at(hex, -0.04)} rotation={[0, Math.PI / 6, 0]} />
                    ))}
                </Instances>
            ))}

            {/* ice: a thin, shiny, see-through layer over whatever ground is underneath */}
            {sorted.ice.length > 0 && (
                <Instances limit={hexes.length} receiveShadow>
                    <cylinderGeometry args={[0.97, 0.97, 0.02, 6]} />
                    <meshPhysicalMaterial color="#9fd6ee" roughness={0.08}
                        transparent opacity={0.6} depthWrite={false} clearcoat={0.8} clearcoatRoughness={0.04} onBeforeCompile={iceLook} />
                    {sorted.ice.map((hex) => (
                        <Instance key={hexKey(hex)} position={at(hex, 0.11)} rotation={[0, turnFor(hex, 'rock'), 0]} />
                    ))}
                </Instances>
            )}

            {/* rough ground: small rocks scattered on top of the ground (clicks go through them to the hex) */}
            {sorted.rough.length > 0 && (
                <Instances limit={hexes.length * ROCKS_PER_HEX} castShadow receiveShadow raycast={() => null}>
                    <dodecahedronGeometry args={[1, 0]} />
                    <meshPhysicalMaterial {...pictures(tex, 'rock')} color={tex ? 'white' : '#7a756c'} roughness={1} onBeforeCompile={paintStone} />
                    {sorted.rough.flatMap((hex) => {
                        const [cx, , cz] = hexToWorld(hex, 1);
                        return Array.from({ length: ROCKS_PER_HEX }, (_, i) => {
                            const angle = fixedRandom(hex, i) * Math.PI * 2;
                            const out = Math.sqrt(fixedRandom(hex, i + 10)) * 0.7;      // spread evenly inside the hex
                            const size = 0.07 + fixedRandom(hex, i + 20) * 0.11;
                            return (
                                <Instance key={`${hexKey(hex)}-${i}`}
                                    position={[cx + Math.cos(angle) * out, 0.1 + liftOf(heights, hex) + size * 0.4, cz + Math.sin(angle) * out]}
                                    rotation={[fixedRandom(hex, i + 30) * 6, fixedRandom(hex, i + 40) * 6, 0]}
                                    scale={[size, size * 0.7, size]} />                       // a bit flattened, like real stones
                            );
                        });
                    })}
                </Instances>
            )}
        </>
    );
}

function TexturedHexes(props: TerrainProps) {
    const tex = useTexture(BOARD_FILES) as Record<string, Texture>;
    useMemo(() => prepare(tex), [tex]);
    return <BoardHexes {...props} tex={tex} />;
}

// The Natural style (T3): the blended ground (TableNatural.tsx), with the walls standing on it as in Tiles
function NaturalBoard(props: TerrainProps) {
    const { hexes, terrain, surfaces, heights, onHexClick } = props;
    const walls = useMemo(() => sortHexes(hexes, terrain, surfaces).walls, [hexes, terrain, surfaces]);
    const radius = props.radius ?? radiusOfHexes(hexes);
    return (
        <>
            <NaturalGround hexes={hexes} terrain={terrain} surfaces={surfaces} heights={heights} radius={radius} />
            <Walls walls={walls} tex={null} onHexClick={onHexClick} />
        </>
    );
}

// What TablePage uses: pictures when they're ready, plain colours until then (or if they fail).
// Natural boards show the plain tiles while their pictures load (or if they fail), then the blended ground.
export function Terrain(props: TerrainProps) {
    const plain = <BoardHexes {...props} tex={null} />;
    if (props.style === 'natural') {
        return (
            <Fallback plain={plain}>
                <Suspense fallback={plain}>
                    <NaturalBoard {...props} />
                </Suspense>
            </Fallback>
        );
    }
    if (!USE_TEXTURES) return plain;
    return (
        <Fallback plain={plain}>
            <Suspense fallback={plain}>
                <TexturedHexes {...props} />
            </Suspense>
        </Fallback>
    );
}

// ---- the tabletop and the wooden rim ----

// A flat hexagon outline, corners pointing the same way as the board's own outline
function hexOutline(radius: number) {
    const s = new Shape();
    for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;          // 30°, 90°, 150°...
        const x = radius * Math.cos(a), y = radius * Math.sin(a);
        if (k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    return s;
}

// The wooden frame around a board of this radius: a big hexagon with the board-sized hexagon cut out, 0.4 tall.
function rimGeometry(radius: number) {
    const frame = hexOutline(rimOuter(radius));
    frame.holes.push(hexOutline(rimInner(radius)));       // cut the middle out
    return new ExtrudeGeometry(frame, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
}
function useRim(radius: number) {
    const geometry = useMemo(() => rimGeometry(radius), [radius]);
    useEffect(() => () => { geometry.dispose(); }, [geometry]);
    return geometry;
}

type TabletopProps = { wood: string; surface: string; felt?: boolean; radius: number };   // felt: false when the room's table is showing   // plain colours (from CSS) for before the pictures load

// The felt tabletop with its picture (only when USE_TEXTURES is on)
function FeltTabletop() {
    const felt = useTexture(filesFor('felt', 'felt')) as Record<string, Texture>;
    useMemo(() => prepare(felt, 40), [felt]);     // felt: a fine weave, tiled many times
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
            <planeGeometry args={[200, 200]} />
            <meshPhysicalMaterial color={backgroundColor} metalness={0.2} roughness={1} clearcoat={1} clearcoatRoughness={0.15} />
        </mesh>
    );
}

// The wooden rim always uses its wood picture (owner's call: the grain looks good); the tabletop only when USE_TEXTURES is on
function TexturedTabletop({ surface, felt = true, radius }: { surface: string; felt?: boolean; radius: number }) {
    const rim = useRim(radius);
    const wood = useTexture(filesFor('wood', 'wood')) as Record<string, Texture>;
    useMemo(() => prepare(wood, 0.25), [wood]);   // the rim's shape is in world units, so shrink the tiling
    return (
        <>
            {!felt ? null : USE_TEXTURES ? <FeltTabletop /> : (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
                    <planeGeometry args={[200, 200]} />
                    <meshStandardMaterial color={surface} roughness={0.9} />
                </mesh>
            )}
            <mesh geometry={rim} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} castShadow receiveShadow>
                {/* color darkens the pale pine picture to a warm stained wood (white = the picture as it is) */}
                <meshPhysicalMaterial {...pictures(wood, 'wood')} color="#b07a52" roughness={1} clearcoat={0.5} clearcoatRoughness={0.25} />
            </mesh>
        </>
    );
}

function PlainTabletop({ wood, surface, felt = true, radius }: TabletopProps) {
    const rim = useRim(radius);
    return (
        <>
            <mesh visible={felt} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
                <planeGeometry args={[200, 200]} />
                <meshStandardMaterial color={surface} roughness={0.9} />
            </mesh>
            <mesh geometry={rim} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} castShadow receiveShadow>
                <meshPhysicalMaterial color={wood} roughness={0.55} clearcoat={0.4} clearcoatRoughness={0.3} />
            </mesh>
        </>
    );
}

// What TablePage uses: the felt tabletop and the wooden rim, plain colours until the pictures are ready
export function Tabletop(props: TabletopProps) {
    const plain = <PlainTabletop {...props} />;
    return (
        <Fallback plain={plain}>
            <Suspense fallback={plain}>
                <TexturedTabletop surface={props.surface} felt={props.felt} radius={props.radius} />
            </Suspense>
        </Fallback>
    );
}
