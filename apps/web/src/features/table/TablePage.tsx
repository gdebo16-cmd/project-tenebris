import { Suspense } from 'react'
import { useParams } from 'react-router'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useTexture} from '@react-three/drei'
import { type Hex, hexKey, neighbors } from '@tenebris/rules/hex'
import { useScene, usePaint } from './tableQueries.ts'

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

export default function TablePage() {
    const hexes: Hex[] = [{ q: 0, r: 0 }, ...neighbors({ q: 0, r: 0 })];
    const { campId = '' } = useParams();
    const { data } = useScene(campId);
    const terrain = data?.scene?.terrain ?? {};
    const paint = usePaint(campId);
    
    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <Canvas orthographic camera={{ position: [0, 10, 0], zoom: 75 }}>
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 10, 5]} intensity={.5} />
                <Suspense fallback={null}>
                    <MapImage />
                </Suspense>
                {hexes.map((hex) => (
                    <mesh key={hexKey(hex)} position={hexToWorld(hex, 1)} rotation={[0, Math.PI/6, 0]} onClick={() => {
                        if (!data?.isDm || !data.scene) return;                                      
                        paint.mutate({ sceneId: data.scene.id, q: hex.q, r: hex.r, terrain: 'wall' });
                    }}>
                        <cylinderGeometry args={[.99, .99, 0.2, 6]} />
                        <meshStandardMaterial color={TERRAIN_COLORS[terrain[hexKey(hex)]] ?? '#7f77dd'} />
                    </mesh>
                ))}

                <OrbitControls  />
            </Canvas>
        </div>
    );
}