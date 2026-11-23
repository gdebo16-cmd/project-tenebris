import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { MapControls, useTexture} from '@react-three/drei'
import { type Hex, hexKey, neighbors } from '@tenebris/rules/hex'

function hexToWorld(hex: Hex, size: number): [number, number, number] {
    const x = 1.5 * size * hex.q
    const z = (Math.sqrt(3) * size * (hex.r + hex.q/2))
    return [x, 0, z]
}

function MapImage() {
    const texture = useTexture('/utils/frozenmap1.png');
    const height = 20 * ((texture.image as HTMLImageElement).height / (texture.image as HTMLImageElement).width);
    return (
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.11, 0]}>
            <planeGeometry args={[20, height]} />
            <meshBasicMaterial map={texture} />
        </mesh>
    )
}

export default function TablePage() {
    const hexes: Hex[] = [{ q: 0, r: 0 }, ...neighbors({ q: 0, r: 0 })];

    
    return (
        <div style={{ width: '100%', height: '80vh' }}>
            <Canvas orthographic camera={{ position: [0, 10, 0], zoom: 50 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 10, 5]} intensity={1} />
                <Suspense fallback={null}>
                    <MapImage />
                </Suspense>
                {hexes.map((hex) => (
                    <mesh key={hexKey(hex)} position={hexToWorld(hex, 1)} rotation={[0, Math.PI/6, 0]}>
                        <cylinderGeometry args={[.99, .99, 0.2, 6]} />
                        <meshStandardMaterial color="#7f77dd" />
                    </mesh>
                ))}

                <MapControls enableRotate={false} />
            </Canvas>
        </div>
    );
}