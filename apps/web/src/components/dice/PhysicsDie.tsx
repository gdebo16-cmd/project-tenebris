import { useMemo, useRef } from 'react';
import { Text, MeshTransmissionMaterial, MeshReflectorMaterial, MeshPortalMaterial, MeshWobbleMaterial, MeshDistortMaterial, MeshRefractionMaterial, MeshDiscardMaterial } from '@react-three/drei';
import { Quaternion, Vector3, IcosahedronGeometry, BufferGeometry, TetrahedronGeometry, BoxGeometry, OctahedronGeometry, DodecahedronGeometry } from 'three';
import { useCssColor } from '../../hooks/useCssColor.ts';
import { RigidBody, ConvexHullCollider, type RapierRigidBody } from '@react-three/rapier';



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
export function PhysicsDie({ sides, start, onLand }: { sides: number; start: [number, number, number]; onLand: (value: number) => void }) {
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
                <meshStandardMaterial color={diceColor} roughness={0.5} metalness={0.5}  />
            </mesh>
        </RigidBody>
    );
}
