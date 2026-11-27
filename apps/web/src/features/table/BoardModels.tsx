// T7: real .glb models from the library, drawn as instances. The mesh is only a picture;
// movement and sight use the model's footprint in @tenebris/rules.
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, type Material } from 'three'
import { type Feature, type Hex, modelOf, modelFile } from '@tenebris/rules/board'
import { useGraphics } from './graphicsSettings.ts'
import { hexToWorld, fixedRandom, liftOf } from './TableScenery.tsx'
import type { ThreeEvent } from '@react-three/fiber'

type Click = (hex: Hex, e: ThreeEvent<MouseEvent>) => void;
type Item = { hex: Hex; feature: Feature; key: string };

export function BoardModels({ features, heights, onHexClick }: { features: Record<string, Feature>; heights: Record<string, number>; onHexClick: Click }) {
    const graphics = useGraphics();
    const byFile = new Map<string, Item[]>();
    for (const [key, feature] of Object.entries(features)) {
        const model = modelOf(feature);
        if (!model) continue;
        const [q, r] = key.split(',').map(Number);
        const file = modelFile(model, graphics.lightModels);
        const list = byFile.get(file) ?? [];
        list.push({ key, feature, hex: { q, r } });
        byFile.set(file, list);
    }
    if (byFile.size === 0) return null;
    return (
        <Suspense fallback={null}>
            {[...byFile.entries()].map(([file, items]) => (
                <ModelInstances key={file} file={file} items={items} heights={heights} onHexClick={onHexClick} />
            ))}
        </Suspense>
    );
}

function ModelInstances({ file, items, heights, onHexClick }: { file: string; items: Item[]; heights: Record<string, number>; onHexClick: Click }) {
    const gltf = useGLTF(file, true, true);
    const parts = useMemo(() => {
        const found: { geometry: Mesh['geometry']; material: Material; matrix: Matrix4 }[] = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((node) => {
            if (!(node instanceof Mesh) || !node.geometry) return;
            const material = Array.isArray(node.material) ? node.material[0] : node.material;
            if (!material) return;
            found.push({ geometry: node.geometry, material, matrix: node.matrixWorld.clone() });
        });
        return found;
    }, [gltf]);
    return (
        <>
            {parts.map((part, i) => (
                <InstancedModels key={i} part={part} items={items} heights={heights} onHexClick={onHexClick} />
            ))}
        </>
    );
}

function InstancedModels({ part, items, heights, onHexClick }: {
    part: { geometry: Mesh['geometry']; material: Material; matrix: Matrix4 };
    items: Item[];
    heights: Record<string, number>;
    onHexClick: Click;
}) {
    const mesh = useRef<InstancedMesh>(null);
    const material = useMemo(() => {
        const mat = part.material.clone();
        if (mat instanceof MeshStandardMaterial) mat.roughness = Math.min(1, mat.roughness);
        return mat;
    }, [part.material]);
    useLayoutEffect(() => () => material.dispose(), [material]);
    useLayoutEffect(() => {
        const inst = mesh.current;
        if (!inst) return;
        const scratch = new Object3D();
        const baked = part.matrix;
        items.forEach((item, i) => {
            const [x, , z] = hexToWorld(item.hex, 1);
            const turn = Math.floor(fixedRandom(item.hex, 31) * 6) * (Math.PI / 3) + fixedRandom(item.hex, 32) * 0.4;
            const scale = item.feature.size ?? 1;
            scratch.position.set(x, 0.1 + liftOf(heights, item.hex), z);
            scratch.rotation.set(0, turn, 0);
            scratch.scale.set(scale, scale, scale);
            scratch.updateMatrix();
            scratch.matrix.multiply(baked);
            inst.setMatrixAt(i, scratch.matrix);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
    }, [items, heights, part.matrix]);
    return (
        <instancedMesh ref={mesh} args={[part.geometry, material, items.length]} castShadow receiveShadow frustumCulled={false}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
                e.stopPropagation();
                const i = e.instanceId;
                if (i == null || i < 0 || i >= items.length) return;
                const item = items[i];
                if (item) onHexClick(item.hex, e);
            }} />
    );
}

export function isModeledFeature(feature: Feature): boolean {
    return !!modelOf(feature);
}
