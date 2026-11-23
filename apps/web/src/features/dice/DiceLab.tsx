// Dice lab (step 15): the server rolls, every browser in the campaign plays the same roll.
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { Euler, Mesh, Quaternion, Vector3 } from 'three';
import socket from '../../utils/socket.js';
import { api } from '../../api.ts';
import styles from './dice.module.css';

// What the server sends for every roll (diceController.js)
type Roll = { sides: number; value: number; start: number[]; spin: number; at: number };

// A d6: each face's number, the direction it points, and how to turn a number so it lies flat on that face
const D6_FACES = [
    { value: 1, normal: [0, 1, 0],  rotation: [-Math.PI / 2, 0, 0] },   // top
    { value: 6, normal: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] },    // bottom (opposite 1)
    { value: 2, normal: [1, 0, 0],  rotation: [0, Math.PI / 2, 0] },    // right
    { value: 5, normal: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },   // left
    { value: 3, normal: [0, 0, 1],  rotation: [0, 0, 0] },              // front (+z)
    { value: 4, normal: [0, 0, -1], rotation: [0, Math.PI, 0] },        // back (-z)
];

const UP = new Vector3(0, 1, 0);
const TURN = Math.PI * 2;          // a full circle, in radians

// The turn that makes this number's face point up
function landOn(value: number): Quaternion {
    const face = D6_FACES.find((f) => f.value === value)!;
    return new Quaternion().setFromUnitVectors(new Vector3(...face.normal), UP);
}

// One die playing one roll: starts at the server's tilt, turns smoothly until the rolled face is on top
function Die({ roll }: { roll: Roll }) {
    const mesh = useRef<Mesh>(null);
    const from = useRef(new Quaternion());
    const to = useRef(new Quaternion());
    const t = useRef(1);           // 0 = just thrown, 1 = landed

    // a new roll: the server's starting tilt and landing spin, so every screen plays it the same
    useEffect(() => {
        from.current = new Quaternion().setFromEuler(new Euler(roll.start[0] * TURN, roll.start[1] * TURN, roll.start[2] * TURN));
        const spin = new Quaternion().setFromAxisAngle(UP, roll.spin * TURN);
        to.current = spin.multiply(landOn(roll.value));
        t.current = 0;
    }, [roll]);

    useFrame((_, delta) => {      // every frame: a little closer to landed
        if (!mesh.current || t.current >= 1) return;
        t.current = Math.min(1, t.current + delta / 0.4);
        mesh.current.quaternion.slerpQuaternions(from.current, to.current, t.current);
    });

    return (
        <mesh ref={mesh}>
            {D6_FACES.map((face) => (
                <Text key={face.value}
                    position={[face.normal[0] * 0.51, face.normal[1] * 0.51, face.normal[2] * 0.51]}
                    rotation={face.rotation as [number, number, number]}
                    fontSize={0.4} color="black">
                    {face.value}
                </Text>
            ))}
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="white" />
        </mesh>
    );
}

export default function DiceLab() {
    const { campId = '' } = useParams();
    const [roll, setRoll] = useState<Roll | null>(null);

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
    const throwDie = () => api(`/api/campaigns/${campId}/dice`, { method: 'POST', body: { sides: 6 } });

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <button type="button" className={styles.rollButton} onClick={throwDie}>Roll</button>
            <Canvas camera={{ position: [2, 2, 3] }}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[5, 10, 5]} intensity={1} />
                {roll && <Die roll={roll} />}
                <OrbitControls />
            </Canvas>
        </div>
    );
}