// Dice lab (step 15): you throw real physics dice; what lands goes to the server and into everyone's roll feed.
import { useState, useRef, useEffect, useMemo, type ReactNode, Suspense } from 'react';
import { useParams } from 'react-router';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Environment, Lightformer } from '@react-three/drei';
import { Quaternion, Vector3, IcosahedronGeometry, BufferGeometry, TetrahedronGeometry, BoxGeometry, OctahedronGeometry, DodecahedronGeometry } from 'three';
import socket from '../../utils/socket.js';
import { api } from '../../api.ts';
import { useCssColor } from '../../hooks/useCssColor.ts';
import styles from './dice.module.css';
import { Physics, RigidBody, CuboidCollider, ConvexHullCollider, type RapierRigidBody } from '@react-three/rapier';


// one line in the roll feed, as the server sends it
type FeedLine = { dice: { sides: number; value: number }[]; bonus: number; total: number; by: number; name: string; at: number };

const TURN = Math.PI * 2;          // a full circle, in radians

const SHAPES: Record<number, BufferGeometry> = {
    4: new TetrahedronGeometry(0.9),
    6: new BoxGeometry(1, 1, 1),
    8: new OctahedronGeometry(0.85),
    12: new DodecahedronGeometry(0.8),
    20: new IcosahedronGeometry(0.8),
};

type Face = { value: number; normal: Vector3; center: Vector3 };

function facesOf(shape: BufferGeometry): Face[] {
    const geometry = shape.index ? shape.toNonIndexed() : shape;   // the cube shares corners; this gives every triangle its own
    const corners = geometry.getAttribute('position');
    const groups: { normal: Vector3; centers: Vector3[] }[] = [];
    for (let i = 0; i < corners.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(corners, i);
        const b = new Vector3().fromBufferAttribute(corners, i + 1);
        const c = new Vector3().fromBufferAttribute(corners, i + 2);
        const center = a.add(b).add(c).divideScalar(3);
        // the triangle's true facing direction: at right angles to two of its edges
        const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
        const same = groups.find((g) => g.normal.dot(normal) > 0.999);    // already have a face pointing this way?
        if (same) same.centers.push(center);
        else groups.push({ normal, centers: [center] });
    }
    // each group is one face: its middle is the average of its triangles' middles
    return groups.map((g, i) => ({
        value: i + 1,
        normal: g.normal,
        center: g.centers.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(g.centers.length),
    }));
}

// The dice the lab can roll (no d10 yet: it needs a hand-built shape)
const DICE = [4, 6, 8, 12, 20];

// One physics die: thrown from the right side of the tray, tumbles, and reports its top face when it settles.
function PhysicsDie({ sides, start, onLand }: { sides: number; start: [number, number, number]; onLand: (value: number) => void }) {
    const diceColor = useCssColor('--dice-color', 'white');
    const numberColor = useCssColor('--dice-number', 'black');
    const shape = SHAPES[sides] ?? SHAPES[20];
    const faces = useMemo(() => facesOf(shape), [shape]);
    const tilt = useMemo(() => [Math.random() * TURN, Math.random() * TURN, Math.random() * TURN] as [number, number, number], []);
    const throwSpeed = useMemo(() => [-6 - Math.random() * 3, 2, Math.random() * 4 - 2] as [number, number, number], []);
    const spin = useMemo(() => [Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10] as [number, number, number], []);
    const fontSize = sides <= 6 ? 0.35 : sides <= 12 ? 0.24 : 0.18;

    const body = useRef<RapierRigidBody>(null);

    // called when the die settles: find the face pointing most upward
    function readTop() {
        const r = body.current!.rotation();                    // how the die ended up turned
        const turn = new Quaternion(r.x, r.y, r.z, r.w);
        let top = faces[0];
        let bestUp = -Infinity;
        for (const face of faces) {
            const up = face.normal.clone().applyQuaternion(turn).y;   // how much this face points up now
            if (up > bestUp) { bestUp = up; top = face; }
        }
        onLand(top.value);
    }

    return (
        <RigidBody ref={body} onSleep={readTop} colliders={false} position={start} rotation={tilt}
            linearVelocity={throwSpeed} angularVelocity={spin} restitution={0.3} friction={0.7}>
            {/* the collision shape: built only from the die's corners, not the numbers */}
            <ConvexHullCollider args={[shape.attributes.position.array as Float32Array]} />
            <mesh geometry={shape} castShadow>
                {faces.map((face) => (
                    <Text key={face.value} position={face.center.clone().multiplyScalar(1.01)}
                        quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), face.normal)}
                        fontSize={fontSize} color={numberColor}>
                        {face.value}
                    </Text>
                ))}
                <meshPhysicalMaterial color={diceColor} roughness={0.25} metalness={0.2} clearcoat={1} clearcoatRoughness={0.15} />
            </mesh>
        </RigidBody>
    );
}

// Flat outlines of each die for the picker buttons (viewBox 0–100). currentColor = the button's text colour.
const DIE_ICONS: Record<number, ReactNode> = {
    4:  <><polygon points="50,8 92,86 8,86" /><line x1="50" y1="8" x2="50" y2="86" /></>,
    6:  <><rect x="14" y="14" width="72" height="72" rx="8" /></>,
    8:  <><polygon points="50,6 90,50 50,94 10,50" /><line x1="10" y1="50" x2="90" y2="50" /></>,
    12: <><polygon points="50,6 92,37 76,88 24,88 8,37" /><polygon points="50,26 70,42 62,66 38,66 30,42" /></>,
    20: <><polygon points="50,4 90,27 90,73 50,96 10,73 10,27" /><polygon points="50,24 74,64 26,64" /></>,
};

// One button per die: its outline, and "D20" underneath. Each click adds one of that die to the pool.
// A die already in the pool is highlighted and shows how many: "D6 ×2".
function DicePicker({ pool, onPick }: { pool: number[]; onPick: (d: number) => void }) {
    return (
        <div className={styles.picker} role="group" aria-label="Add a die">
            {DICE.map((d) => {
                const count = pool.filter((p) => p === d).length;
                return (
                    <button key={d} type="button"
                        className={count > 0 ? `${styles.die} ${styles.dieOn}` : styles.die}
                        onClick={() => onPick(d)}>
                        <svg viewBox="0 0 100 100" aria-hidden="true">{DIE_ICONS[d]}</svg>
                        <span>D{d}{count > 0 && ` ×${count}`}</span>
                    </button>
                );
            })}
        </div>
    );
}

// The pool in dice notation: [6, 6, 8] -> "2d6 + 1d8"
function notation(pool: number[]) {
    return DICE.filter((d) => pool.includes(d))
        .map((d) => `${pool.filter((p) => p === d).length}d${d}`)
        .join(' + ');
}

export default function DiceLab() {
    const { campId = '' } = useParams();
    const tableColor = useCssColor('--table-color', '#1f4d2b');
    const [feed, setFeed] = useState<FeedLine[]>([]);   // newest first
    const [pool, setPool] = useState<number[]>([]);     // the dice you've picked: [6, 6, 8] = two d6 and a d8
    const [bonus, setBonus] = useState(0);              // added to the total: +3, -1...

    // the throw in the tray right now. A copy of the pool taken when you press Roll, so changing
    // the pool mid-roll doesn't change dice already in the air. id goes up by 1 each Roll:
    // new keys make React build fresh dice.
    const [thrown, setThrown] = useState<{ id: number; dice: number[] }>({ id: 0, dice: [] });
    const results = useRef<(number | null)[]>([]);     // what each thrown die landed on (null = still rolling)
    const sent = useRef(false);                          // this throw already went to the server?
    const [rolling, setRolling] = useState(false);

    // everyone in the campaign hears every roll (including your own)
    useEffect(() => {
        const join = () => socket.emit('join-campaign', campId);
        const addLine = (line: FeedLine) => setFeed((old) => [line, ...old].slice(0, 20));   // newest on top, keep 20
        socket.on('connect', join);
        socket.on('roll-feed', addLine);
        socket.connect();
        if (socket.connected) join();
        return () => {                                   // leaving the page: stop listening
            socket.off('connect', join);
            socket.off('roll-feed', addLine);
            socket.disconnect();
        };
    }, [campId]);

    const roll = () => {
        if (pool.length === 0) return;
        results.current = pool.map(() => null);           // one empty slot per die
        sent.current = false;
        setRolling(true);
        setThrown({ id: thrown.id + 1, dice: [...pool] });
    };

    // die number i has settled. When every die has, send the whole throw once.
    // (A die knocked by another can settle twice: it just updates its slot.)
    const landedOn = (i: number, value: number) => {
        results.current[i] = value;
        if (sent.current || results.current.some((v) => v === null)) return;
        sent.current = true;
        setRolling(false);
        const dice = thrown.dice.map((sides, j) => ({ sides, value: results.current[j]! }));
        api(`/api/campaigns/${campId}/dice`, { method: 'POST', body: { dice, bonus } });
    };

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <div className={styles.rollButton}>
                <button type="button" className={styles.rollButtonRoll} onClick={roll}
                    disabled={pool.length === 0 || rolling}>
                    {rolling ? 'Rolling…' : pool.length === 0 ? 'Pick some dice' : `Roll ${notation(pool)}${bonus ? ` ${bonus > 0 ? '+' : ''}${bonus}` : ''}`}
                </button>

                <DicePicker pool={pool} onPick={(d) => setPool([...pool, d])} />

                <div className={styles.poolRow}>
                    <label>
                        Bonus{' '}
                        <input type="number" value={bonus} min={-100} max={100}
                            onChange={(e) => setBonus(Number(e.target.value) || 0)} />
                    </label>
                    {pool.length > 0 && <button type="button" onClick={() => setPool([])}>Clear dice</button>}
                </div>

                <ul className={styles.feed}>
                    {feed.length === 0 && <li>No rolls yet</li>}
                    {feed.map((line) => (
                        <li key={line.at}>
                            <b>{line.name}</b> rolled {line.dice.map((d) => `d${d.sides}: ${d.value}`).join(', ')}
                            {line.bonus !== 0 && ` ${line.bonus > 0 ? '+' : ''}${line.bonus}`} = <b>{line.total}</b>
                        </li>
                    ))}
                </ul>
            </div>

            <Canvas shadows camera={{ position: [0, 5, 5] }}>
                <Environment resolution={256}>
                    <Lightformer intensity={2} position={[0, 5, -2]} scale={[10, 3, 1]} />
                    <Lightformer intensity={1} position={[-5, 1, 1]} scale={[3, 3, 1]} />
                    <Lightformer intensity={1} position={[5, 1, 1]} scale={[3, 3, 1]} />
                </Environment>
                <ambientLight intensity={1} />
                <directionalLight position={[5, 10, 5]} intensity={0.6} castShadow />

                {/* the table you see (looks only) */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <planeGeometry args={[30, 30]} />
                    <meshPhysicalMaterial color={tableColor} roughness={1} metalness={0.2} clearcoat={1} clearcoatRoughness={0.15} />
                </mesh>

                {/* the physics world: everything inside falls and collides */}
                <Suspense fallback={null}>
                    <Physics gravity={[0, -30, 0]}>
                        {/* the tray: a floor and four invisible walls, one fixed body */}
                        <RigidBody type="fixed">
                            <CuboidCollider args={[15, 0.1, 15]} position={[0, -0.1, 0]} />     {/* floor */}
                            <CuboidCollider args={[6, 2, 0.1]} position={[0, 2, -6]} />          {/* back */}
                            <CuboidCollider args={[6, 2, 0.1]} position={[0, 2, 6]} />           {/* front */}
                            <CuboidCollider args={[0.1, 2, 6]} position={[-6, 2, 0]} />          {/* left */}
                            <CuboidCollider args={[0.1, 2, 6]} position={[6, 2, 0]} />           {/* right */}
                        </RigidBody>
                        {/* one die per entry, spread front to back and stacked a little so they don't start inside each other */}
                        {thrown.dice.map((sides, i) => (
                            <PhysicsDie key={`${thrown.id}-${i}`} sides={sides}
                                start={[4.5, 2 + Math.floor(i / 5) * 1.3, ((i % 5) - 2) * 1.3]}
                                onLand={(value) => landedOn(i, value)} />
                        ))}
                    </Physics>
                </Suspense>

                <OrbitControls maxPolarAngle={Math.PI / 2.3} />
            </Canvas>
        </div>
    );
}
