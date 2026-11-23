// Dice lab (step 15): the server rolls, every browser in the campaign plays the same roll.
import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Environment, Lightformer } from '@react-three/drei';
import { Euler, Mesh, Quaternion, Vector3, IcosahedronGeometry, BufferGeometry, TetrahedronGeometry, BoxGeometry, OctahedronGeometry, DodecahedronGeometry } from 'three';
import socket from '../../utils/socket.js';
import { api } from '../../api.ts';
import { useCssColor } from '../../hooks/useCssColor.ts';
import styles from './dice.module.css';



// What the server sends for every roll (diceController.js)
// One die in a throw, and the whole throw (several dice + a bonus)
type DieRoll = { sides: number; value: number; start: number[]; spin: number };
type Roll = { dice: DieRoll[]; bonus: number; total: number; at: number };


const UP = new Vector3(0, 1, 0);
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

// The turn that makes this face point up (works for any die: give it that die's faces)
function landOn(faces: Face[], value: number): Quaternion {
    const face = faces.find((f) => f.value === value) ?? faces[0];
    return new Quaternion().setFromUnitVectors(face.normal, UP);
}

// The dice the lab can roll (no d10 yet: it needs a hand-built shape)
const DICE = [4, 6, 8, 12, 20];

// One die playing one roll: starts at the server's tilt, turns smoothly until the rolled face is on top
function Die({ die, position }: { die: DieRoll; position: [number, number, number] }) {
    const diceColor = useCssColor('--dice-color', 'white');          // ← moved in here from the top of the file
    const numberColor = useCssColor('--dice-number', 'black');
    const shape = SHAPES[die.sides] ?? SHAPES[20];                    // ← this roll's shape
    const faces = useMemo(() => facesOf(shape), [shape]); 
    const restHeight = faces[0].center.length();   // centre of the die -> middle of a face            // ← its faces, worked out once per shape
    const mesh = useRef<Mesh>(null);
    const from = useRef(new Quaternion());
    const to = useRef(new Quaternion());
    const t = useRef(1);           // 0 = just thrown, 1 = landed

    // a new roll: the server's starting tilt and landing spin, so every screen plays it the same
    useEffect(() => {
        from.current = new Quaternion().setFromEuler(new Euler(die.start[0] * TURN, die.start[1] * TURN, die.start[2] * TURN));
        const spin = new Quaternion().setFromAxisAngle(UP, die.spin * TURN);
        to.current = spin.multiply(landOn(faces, die.value));        // ← this die's faces
        t.current = 0;
    }, [die, faces]);

    useFrame((_, delta) => {      // every frame: a little closer to landed
        if (!mesh.current || t.current >= 1) return;
        t.current = Math.min(1, t.current + delta / 0.4);
        mesh.current.quaternion.slerpQuaternions(from.current, to.current, t.current);
    });

    // smaller dice faces need smaller numbers: a d4's faces are big, a d20's small
    const fontSize = die.sides <= 6 ? 0.35 : die.sides <= 12 ? 0.24 : 0.18;

    return (
        <mesh ref={mesh} geometry={shape} position={[position[0], restHeight, position[2]]} castShadow>                
            {faces.map((face) => (
                <Text key={face.value}
                    position={face.center.clone().multiplyScalar(1.01)}
                    quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), face.normal)}
                    fontSize={fontSize} color={numberColor}>
                    {face.value}
                </Text>
            ))}
            <meshPhysicalMaterial color={diceColor} roughness={0.25} metalness={0.2} clearcoat={1} clearcoatRoughness={0.15} />
        </mesh>
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

// One button per die: its outline, and "D20" underneath
function DicePicker({ sides, onPick }: { sides: number; onPick: (d: number) => void }) {
    return (
        <div className={styles.picker} role="group" aria-label="Which die">
            {DICE.map((d) => (
                <button key={d} type="button" aria-pressed={d === sides}
                    className={d === sides ? `${styles.die} ${styles.dieOn}` : styles.die}
                    onClick={() => onPick(d)}>
                    <svg viewBox="0 0 100 100" aria-hidden="true">{DIE_ICONS[d]}</svg>
                    <span>D{d}</span>
                </button>
            ))}
        </div>
    );
}

export default function DiceLab() {
    const { campId = '' } = useParams();
    const [roll, setRoll] = useState<Roll | null>(null);
    const [sides, setSides] = useState(20);                            // ← which die the Roll button throws

    // everyone in the campaign hears every roll (including your own)
    useEffect(() => {
        const join = () => socket.emit('join-campaign', campId);
        socket.connect();
        if (socket.connected) join();
        socket.on('connect', join);
        socket.on('dice', setRoll);
        return () => {
            socket.off('connect', join);
            socket.off('dice', setRoll);
            socket.disconnect();
        };
    }, [campId]);

    // ask the server to roll; the answer arrives through 'dice' above, the same moment as everyone else's
    const throwDie = () => api(`/api/campaigns/${campId}/dice`, { method: 'POST', body: { dice: [{ sides, count: 1 }] } });   // ← the chosen die

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <div className={styles.rollButton}>    
                <button type="button" className={styles.rollButtonRoll} onClick={throwDie}>Roll</button>                      
                <DicePicker sides={sides} onPick={setSides} />
                
            </div>
            <Canvas shadows camera={{ position: [2, 2, 3] }}>
                <Environment resolution={225}>
                    <Lightformer intensity={2} position={[0, 5, -2]} scale={[10, 3, 1]} />
                    <Lightformer intensity={1} position={[-5, 1, 1]} scale={[3, 3, 1]} />
                    <Lightformer intensity={1} position={[5, 1, 1]} scale={[3, 3, 1]} />
                </Environment>
                <ambientLight intensity={1} />
                <directionalLight position={[5, 10, 5]} intensity={0.6} castShadow />
                {/* an invisible floor that only shows the die's shadow */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                    <planeGeometry args={[30, 30]} />
                    <meshPhysicalMaterial color="#1f4d2b" roughness={10} metalness={0.2} clearcoat={.2} clearcoatRoughness={0.15} />
                </mesh>
                {roll?.dice.map((die, i) => (
                    <Die key={`${roll.at}-${i}`} die={die}
                        position={[(i - (roll.dice.length - 1) / 2) * 1.8, 0, 0]} />   // side by side, centred
                ))}
                <OrbitControls />
            </Canvas>
        </div>
    );
}