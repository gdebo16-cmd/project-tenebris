// The table (Stage 2, steps 11–13): the map, a hex grid over it, painted terrain and tokens, drawn with R3F from a
// camera looking straight down. Everything that changes goes to the server, which decides (sceneController.js):
// the board only asks and shows the answer.
//
// Tools: everyone can Move (click your token, then a hex). The DM also gets the terrain brushes, Place and Remove.
import { Suspense, useState } from 'react'
import { useParams } from 'react-router'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Html, MapControls, useTexture } from '@react-three/drei'
import { type Hex, hexKey, hexesWithin, TERRAIN_KINDS, type TerrainKind } from '@tenebris/rules/hex'
import { ApiError } from '../../api.ts'
import {
    useScene, usePaint, usePlaceToken, useMoveToken, useRemoveToken,
    type PlaceRequest, type SceneData, type Token,
} from './tableQueries.ts'
import styles from './TablePage.module.css'

const GRID_RADIUS = 8;      // how many rings of hexes around the centre (enough to cover a 20-wide map)

function hexToWorld(hex: Hex, size: number): [number, number, number] {
    const x = 1.5 * size * hex.q
    const z = (Math.sqrt(3) * size * (hex.r + hex.q/2))
    return [x, 0, z]
}

const TERRAIN_COLORS: Record<string, string> = {
    "wall": '#4a4a4a',
    "water": "#3060c0",
    "rough": "#800000",
    "ice": '#00ffff',
}

// Token colours: yours, another player's, a monster (the DM's), a summon
const TOKEN_COLORS = { mine: '#3fae6a', player: '#4d8fe0', monster: '#d0503c', summon: '#e0a63b' };

function MapImage() {
    const texture = useTexture('/topdowncabin.webp');
    const height = 20 * ((texture.image as HTMLImageElement).height / (texture.image as HTMLImageElement).width);
    return (
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.11, 0]}>
            <planeGeometry args={[20, height]} />
            <meshBasicMaterial map={texture} />
        </mesh>
    )
}

// What a click on a hex does
type Tool =
    | { type: 'move' }
    | { type: 'paint'; terrain: TerrainKind | null }     // null = eraser
    | { type: 'place' };

// A click that ended a drag (panning the map) isn't a click
const wasDrag = (e: ThreeEvent<MouseEvent>) => e.delta > 4;

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

export default function TablePage() {
    const hexes = hexesWithin({ q: 0, r: 0 }, GRID_RADIUS);
    const { campId = '' } = useParams();
    const { data, error } = useScene(campId);
    const terrain = data?.scene?.terrain ?? {};
    const paint = usePaint(campId);
    const place = usePlaceToken(campId);
    const move = useMoveToken(campId);
    const remove = useRemoveToken(campId);

    const [tool, setTool] = useState<Tool>({ type: 'move' });
    const [selected, setSelected] = useState<number | null>(null);    // the token about to move
    const [placing, setPlacing] = useState('');                       // 'character:3', 'monster:7' or 'summon'
    const [summonName, setSummonName] = useState('');
    const [summonOwner, setSummonOwner] = useState('');               // a player's user id, or '' for the DM
    const [message, setMessage] = useState('');

    const isDm = data?.isDm ?? false;
    const tokens = data?.tokens ?? [];
    const selectedToken = tokens.find((t) => t.id === selected) ?? null;
    const canMove = (t: Token) => isDm || t.ownerId === data?.userId;
    const done = { onSuccess: () => setMessage(''), onError: (err: unknown) => setMessage(messageOf(err)) };

    // The token to place, from the Place picker
    function placeRequest(): PlaceRequest | null {
        const [kind, id] = placing.split(':');
        if (kind === 'character') return { kind, characterId: Number(id) };
        if (kind === 'monster') return { kind, campaignMonsterId: Number(id) };
        if (kind === 'summon') return { kind, name: summonName, ownerId: summonOwner ? Number(summonOwner) : null };
        return null;
    }

    function clickHex(hex: Hex, e: ThreeEvent<MouseEvent>) {
        if (wasDrag(e) || !data?.scene) return;
        const sceneId = data.scene.id;
        if (tool.type === 'paint' && isDm) {
            paint.mutate({ sceneId, q: hex.q, r: hex.r, terrain: tool.terrain }, done);
        } else if (tool.type === 'place' && isDm) {
            const request = placeRequest();
            if (!request) return setMessage('Choose what to place first');
            place.mutate({ sceneId, q: hex.q, r: hex.r, place: request }, done);
        } else if (tool.type === 'move' && selectedToken) {
            move.mutate({ tokenId: selectedToken.id, q: hex.q, r: hex.r }, {
                onSuccess: () => { setMessage(''); setSelected(null); },
                onError: (err) => setMessage(messageOf(err)),
            });
        }
    }

    function clickToken(token: Token, e: ThreeEvent<MouseEvent>) {
        if (tool.type !== 'move') return;           // other tools act on the hex underneath
        e.stopPropagation();                        // don't also click the hex below
        if (wasDrag(e)) return;
        if (!canMove(token)) return setMessage(`${token.name} isn't yours to move`);
        setMessage('');
        setSelected(selected === token.id ? null : token.id);
    }

    if (error) return <p className={styles.notice} role="alert">{messageOf(error)}</p>;
    if (data && !data.scene) return <p className={styles.notice}>The DM hasn't opened the table yet.</p>;

    return (
        <div className={styles.board}>
            <Toolbar
                data={data}
                tool={tool}
                setTool={(t) => { setTool(t); setSelected(null); setMessage(''); }}
                placing={placing} setPlacing={setPlacing}
                summonName={summonName} setSummonName={setSummonName}
                summonOwner={summonOwner} setSummonOwner={setSummonOwner}
                selectedToken={selectedToken}
                onRemove={() => selectedToken && remove.mutate(selectedToken.id, { onSuccess: () => { setSelected(null); setMessage(''); }, onError: (err) => setMessage(messageOf(err)) })}
                message={message}
            />
            <Canvas orthographic camera={{ position: [0, 10, 0], zoom: 75 }}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[5, 10, 5]} intensity={0.8} />
                <Suspense fallback={null}>
                    <MapImage />
                </Suspense>
                {hexes.map((hex) => (
                    <mesh key={hexKey(hex)} position={hexToWorld(hex, 1)} rotation={[0, Math.PI/6, 0]} onClick={(e) => clickHex(hex, e)}>
                        <cylinderGeometry args={[.99, .99, 0.2, 6]} />
                        <meshStandardMaterial
                            color={TERRAIN_COLORS[terrain[hexKey(hex)]] ?? '#7f77dd'}
                            transparent
                            opacity={terrain[hexKey(hex)] ? 0.9 : 0.25}     // open ground lets the map show through
                        />
                    </mesh>
                ))}
                {tokens.map((token) => (
                    <TokenPiece key={token.id} token={token} mine={token.ownerId === data?.userId}
                        selected={token.id === selected} onClick={(e) => clickToken(token, e)} />
                ))}
                <MapControls enableRotate={false} />
            </Canvas>
        </div>
    );
}

// One token: a round piece standing on its hex, its name above it, a gold ring when selected
function TokenPiece({ token, mine, selected, onClick }: {
    token: Token; mine: boolean; selected: boolean; onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
    const [x, , z] = hexToWorld(token, 1);
    const color = token.kind === 'monster' ? TOKEN_COLORS.monster
        : token.kind === 'summon' ? TOKEN_COLORS.summon
        : mine ? TOKEN_COLORS.mine : TOKEN_COLORS.player;
    return (
        <group position={[x, 0.1, z]}>
            {selected && (
                <mesh position={[0, 0.01, 0]}>
                    <cylinderGeometry args={[0.85, 0.85, 0.05, 32]} />
                    <meshStandardMaterial color="#f5d061" />
                </mesh>
            )}
            <mesh position={[0, 0.15, 0]} onClick={onClick}>
                <cylinderGeometry args={[0.65, 0.65, 0.25, 32]} />
                <meshStandardMaterial color={color} />
            </mesh>
            <Html position={[0, 0.4, 0]} center className={styles.label} pointerEvents="none">
                {token.name}
            </Html>
        </group>
    );
}

// The tools above the board. Players see only their status line; the DM gets brushes, Place and Remove.
function Toolbar(props: {
    data: SceneData | undefined;
    tool: Tool; setTool: (t: Tool) => void;
    placing: string; setPlacing: (v: string) => void;
    summonName: string; setSummonName: (v: string) => void;
    summonOwner: string; setSummonOwner: (v: string) => void;
    selectedToken: Token | null;
    onRemove: () => void;
    message: string;
}) {
    const { data, tool, setTool, selectedToken, message } = props;
    const isDm = data?.isDm ?? false;
    const pressed = (t: Tool) => tool.type === t.type && (t.type !== 'paint' || (tool.type === 'paint' && tool.terrain === t.terrain));
    const button = (label: string, t: Tool) => (
        <button type="button" className={pressed(t) ? `${styles.tool} ${styles.toolOn}` : styles.tool}
            aria-pressed={pressed(t)} onClick={() => setTool(t)}>{label}</button>
    );

    const status = message
        || (selectedToken ? `${selectedToken.name}: click a hex to move there` : '')
        || (tool.type === 'move' ? 'Click your token, then a hex' : tool.type === 'place' ? 'Click a hex to place it' : 'Click hexes to paint');

    return (
        <div className={styles.toolbar} aria-label="Table tools">
            {isDm && (
                <>
                    <div className={styles.row}>
                        {button('Move', { type: 'move' })}
                        {TERRAIN_KINDS.map((kind) => <span key={kind}>{button(kind[0].toUpperCase() + kind.slice(1), { type: 'paint', terrain: kind })}</span>)}
                        {button('Eraser', { type: 'paint', terrain: null })}
                        {button('Place', { type: 'place' })}
                    </div>
                    {tool.type === 'place' && (
                        <div className={styles.row}>
                            <select className={styles.field} value={props.placing} aria-label="What to place" onChange={(e) => props.setPlacing(e.target.value)}>
                                <option value="">Choose…</option>
                                <optgroup label="Party">
                                    {data?.placeable?.party.map((p) => <option key={p.characterId} value={`character:${p.characterId}`}>{p.name} ({p.username})</option>)}
                                </optgroup>
                                <optgroup label="Monsters">
                                    {data?.placeable?.monsters.map((m) => <option key={m.id} value={`monster:${m.id}`}>{m.name}</option>)}
                                </optgroup>
                                <option value="summon">A summon or pet…</option>
                            </select>
                            {props.placing === 'summon' && (
                                <>
                                    <input className={styles.field} type="text" maxLength={60} placeholder="Summon's name" aria-label="Summon's name"
                                        value={props.summonName} onChange={(e) => props.setSummonName(e.target.value)} />
                                    <select className={styles.field} value={props.summonOwner} aria-label="Summon's owner" onChange={(e) => props.setSummonOwner(e.target.value)}>
                                        <option value="">Owner: the DM</option>
                                        {data?.placeable?.party.map((p) => <option key={p.ownerId} value={p.ownerId}>Owner: {p.username}</option>)}
                                    </select>
                                </>
                            )}
                        </div>
                    )}
                    {selectedToken && (
                        <div className={styles.row}>
                            <button type="button" className={styles.tool} onClick={props.onRemove}>Remove {selectedToken.name}</button>
                        </div>
                    )}
                </>
            )}
            <p className={message ? `${styles.status} ${styles.error}` : styles.status} role={message ? 'alert' : 'status'}>{status}</p>
        </div>
    );
}
