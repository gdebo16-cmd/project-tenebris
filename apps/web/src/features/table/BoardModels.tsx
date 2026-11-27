// T7: real .glb models from the library, drawn as instances. The mesh is only a picture;
// movement and sight use the model's footprint in @tenebris/rules.
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { DoubleSide, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, type Material } from 'three'
import { type Feature, type Hex, modelOf, modelFile } from '@tenebris/rules/board'
import { useGraphics } from './graphicsSettings.ts'
import { hexToWorld, fixedRandom, liftOf } from './TableScenery.tsx'
import type { ThreeEvent } from '@react-three/fiber'

type Click = (hex: Hex, e: ThreeEvent<MouseEvent>) => void;
type Item = { hex: Hex; feature: Feature; key: string };
type Part = { geometry: Mesh['geometry']; material: Material; matrix: Matrix4 };

// Bump this when the baked .glb files change so the browser and useGLTF don't keep an old copy.
const MODEL_ASSET_VERSION = 'foliage3';

const CUTOUT_NAME = /leaf|twig|needl|foliage|grass|fern|petal|moss|shrub|nettle|plant|celand|dandel/i;

function isMeshNode(node: unknown): node is Mesh {
    return !!node && typeof node === 'object' && (node as Mesh).isMesh === true && !!(node as Mesh).geometry;
}

// Leaf cards are thin single-sided planes. Instanced drawing must keep every primitive's own
// material, draw both sides, and use alphaTest (not blending) or the canopy is discarded.
function prepareBoardMaterial(source: Material): Material {
    const mat = source.clone();
    if (mat instanceof MeshStandardMaterial || (mat as MeshStandardMaterial).isMeshStandardMaterial) {
        const std = mat as MeshStandardMaterial;
        std.roughness = Math.min(1, std.roughness);
        const cutout = std.alphaTest > 0 || std.transparent || CUTOUT_NAME.test(std.name || '');
        if (cutout) {
            std.side = DoubleSide;
            if (std.alphaTest <= 0) std.alphaTest = 0.45;
            std.transparent = false;
            std.depthWrite = true;
        }
        if (std.map) {
            std.map.premultiplyAlpha = false;
            std.map.needsUpdate = true;
        }
    }
    return mat;
}

function collectParts(root: Object3D): Part[] {
    const found: Part[] = [];
    root.updateMatrixWorld(true);
    root.traverse((node) => {
        if (!isMeshNode(node)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        const groups = node.geometry.groups ?? [];
        if (groups.length > 0 && materials.length > 1) {
            for (const group of groups) {
                const material = materials[group.materialIndex ?? 0];
                if (!material) continue;
                const geometry = node.geometry.clone();
                geometry.clearGroups();
                geometry.setDrawRange(group.start, group.count);
                found.push({ geometry, material, matrix: node.matrixWorld.clone() });
            }
        } else if (materials[0]) {
            found.push({ geometry: node.geometry, material: materials[0], matrix: node.matrixWorld.clone() });
        }
    });
    return found;
}

export function BoardModels({ features, heights, onHexClick }: { features: Record<string, Feature>; heights: Record<string, number>; onHexClick: Click }) {
    const graphics = useGraphics();
    const byFile = new Map<string, Item[]>();
    for (const [key, feature] of Object.entries(features)) {
        const model = modelOf(feature);
        if (!model) continue;
        const [q, r] = key.split(',').map(Number);
        const file = modelFile(model, graphics.lightModels) + '?v=' + MODEL_ASSET_VERSION;
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
    const parts = useMemo(() => collectParts(gltf.scene), [gltf]);
    return (
        <>
            {parts.map((part, i) => (
                <InstancedModels key={i} part={part} items={items} heights={heights} onHexClick={onHexClick} />
            ))}
        </>
    );
}

function InstancedModels({ part, items, heights, onHexClick }: {
    part: Part;
    items: Item[];
    heights: Record<string, number>;
    onHexClick: Click;
}) {
    const mesh = useRef<InstancedMesh>(null);
    const material = useMemo(() => prepareBoardMaterial(part.material), [part.material]);
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