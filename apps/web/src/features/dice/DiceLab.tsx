// Dice lab (step 15): you throw real physics dice; what lands goes to the server and into everyone's roll feed.
import { useState, useRef, useEffect, Suspense } from 'react';
import { useParams } from 'react-router';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, MeshTransmissionMaterial, Sky } from '@react-three/drei';
import socket from '../../utils/socket.js';
import { api } from '../../api.ts';
import { useCssColor } from '../../hooks/useCssColor.ts';
import styles from '../../styles/features/dice/DiceLab.module.css';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { PhysicsDie } from '../../components/dice/PhysicsDie.tsx';
import { DicePicker, notation } from '../../components/dice/DicePicker.tsx';

// one line in the roll feed, as the server sends it
type FeedLine = { dice: { sides: number; value: number }[]; bonus: number; total: number; by: number; name: string; at: number };

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
                            <b>{line.name}</b> rolled a <b>{line.total}</b> <br/>{' '}
                            ({notation(line.dice.map((d) => d.sides))}
                            {line.bonus !== 0 && ` ${line.bonus > 0 ? '+' : '-'} ${Math.abs(line.bonus)}`}
                            :  {line.dice.map((d) => d.value).join(' + ')} = {line.total})
                        </li>
                    ))}
                </ul>
            </div>

            <Canvas shadows camera={{ position: [0, 5, 5] }}>
                <Sky distance={450000} sunPosition={[0, 1, 0]} inclination={0} azimuth={0.25} />
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
