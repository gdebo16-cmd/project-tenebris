import { useState, useEffect, useMemo, type RefObject, useRef, memo, useCallback } from 'react'
import { type Texture, TextureLoader, SRGBColorSpace, CanvasTexture, Group, type MeshStandardMaterial } from 'three'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { type Token } from '../../../../features/table/hooks/tableQueries.ts'
import { type Notice } from '../../../../features/table/hooks/tableTypes.ts'
import { type Hex, findPath } from '@tenebris/rules/board'
import { hexToWorld, liftOf } from '../ground/TableScenery.tsx'
import { Html, Billboard } from '@react-three/drei'
import { HitBurst } from '../moments/BoardMoments.tsx'
import styles from '../../../../styles/components/table/board/tokens/TokenOnBoard.module.css'
import { follow } from '../followTarget.ts'

// Token colours: yours, another player's, a monster (the DM's), a summon
const TOKEN_COLORS = { mine: '#3fae6a', player: '#4d8fe0', monster: '#d0503c', summon: '#e0a63b', down: '#5a5a5a' };

// How full the health ring is. Monsters only send a word, so players never learn their real HP.
const HEALTH_SHARE: Record<string, number> = { Unhurt: 1, Wounded: 0.75, Bloodied: 0.5, 'Near death': 0.25, Down: 0 };

// Load a portrait picture. Broken or blocked links give null (the token shows its colour) instead of crashing the board.
function usePortrait(url: string | null) {
    const [texture, setTexture] = useState<Texture | null>(null);
    useEffect(() => {
        setTexture(null);
        if (!url) return;
        let current = true;                       // ignore a slow load that finishes after the token changed or left
        new TextureLoader().load(url,
            (t) => { if (current) { t.colorSpace = SRGBColorSpace; setTexture(t); } },
            undefined,
            () => { if (current) setTexture(null); });
        return () => { current = false; };
    }, [url]);
    return texture;
}

// The standee's card: a framed picture in the owner's colour, bottom edge at its origin. With no portrait it shows the
// first letter of the name on the owner's colour. The picture is cropped to fill the card without stretching.
const CARD_W = 0.95, CARD_H = 1.3;

function letterCard(name: string, color: string) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 350;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, color); grad.addColorStop(1, '#1a1612');
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = 'bold 170px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((name.trim()[0] ?? '?').toUpperCase(), c.width / 2, c.height / 2);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
}

function StandeeCard({ portrait, name, color, onClick }: {
    portrait: Texture | null; name: string; color: string; onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
    const letter = useMemo(() => letterCard(name, color), [name, color]);
    // crop the portrait like CSS "object-fit: cover": fill the card, cut off what sticks out
    const picture = useMemo(() => {
        if (!portrait) return letter;
        const img = portrait.image as { width: number; height: number };
        const imageAspect = img.width / img.height, cardAspect = CARD_W / CARD_H;
        const t = portrait.clone();
        if (imageAspect > cardAspect) { t.repeat.set(cardAspect / imageAspect, 1); t.offset.set((1 - t.repeat.x) / 2, 0); }
        else { t.repeat.set(1, imageAspect / cardAspect); t.offset.set(0, (1 - t.repeat.y) / 2); }
        t.needsUpdate = true;
        return t;
    }, [portrait, letter]);
    return (
        <group onClick={onClick}>
            {/* the frame, a little bigger than the picture */}
            <mesh position={[0, CARD_H / 2 + 0.02, -0.006]} castShadow>
                <boxGeometry args={[CARD_W + 0.08, CARD_H + 0.08, 0.01]} />
                <meshPhysicalMaterial color={color} metalness={0.5} roughness={0.35} clearcoat={1} />
            </mesh>
            <mesh position={[0, CARD_H / 2 + 0.02, 0]}>
                <planeGeometry args={[CARD_W, CARD_H]} />
                <meshStandardMaterial map={picture} roughness={0.55} />
            </mesh>
        </group>
    );
}

// One token: a coin-edged base with the portrait on top, a health ring, and its name above it.
// It walks along its path when moved, and lifts off the board when selected.
function TokenPiece({ token, mine, selected, labels, walls, heights, notice, onClick }: {
    token: Token; mine: boolean; selected: boolean; labels: RefObject<HTMLDivElement | null>;
    walls: Set<string>; heights: Record<string, number>; notice: Notice | null; onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
    // ---- walking ----
    const piece = useRef<Group>(null);
    const shown = useRef<Hex>({ q: token.q, r: token.r });    // the hex the piece is drawn on right now
    const route = useRef<Hex[]>([]);                           // hexes still to walk through
    const step = useRef(0);                                    // 0 → 1: progress towards the next hex
    const start = useMemo(() => hexToWorld(token, 1), []);    // where it first appears (only used once)

    useEffect(() => {
        const from = shown.current;
        if (from.q === token.q && from.r === token.r) return;
        const path = findPath(from, token, walls, 200);
        route.current = path ? path.slice(1) : [{ q: token.q, r: token.r }];
        step.current = 0;
    }, [token.q, token.r]);

    // ---- lifting when selected, the ring's pulse, the landing bounce ----
    const lift = useRef<Group>(null);
    const ring = useRef<MeshStandardMaterial>(null);
    const bounce = useRef(0);                                  // 1 = just landed, eases back to 0

    useFrame((_, delta) => {
        // lift: ease towards 0.2 up when selected, back down when not
        const l = lift.current;
        if (l) l.position.y += ((selected ? 0.2 : 0) - l.position.y) * Math.min(1, delta * 12);

        // the selection ring breathes slowly, bright enough to glow
        if (ring.current) ring.current.emissiveIntensity = 1.6 + Math.sin(performance.now() / 300) * 0.6;

        // landing: squash a little and spring back (wider and flatter, then normal)
        if (l && bounce.current > 0) {
            bounce.current = Math.max(0, bounce.current - delta * 4);
            const b = Math.sin(bounce.current * Math.PI) * 0.12;
            l.scale.set(1 + b, 1 - b * 1.5, 1 + b);
        }

        // shake for a moment after a hit
        if (l && shake.current > 0) {
            shake.current = Math.max(0, shake.current - delta * 3);
            l.position.x = Math.sin(performance.now() / 18) * 0.06 * shake.current;
        } else if (l) l.position.x = 0;

        // walk: slide towards the next hex, with a small hop each step
        const g = piece.current;
        if (!g) return;
        if (route.current.length === 0) {
            // standing still: settle onto the ground's height (it may have been raised or lowered)
            g.position.y += (0.1 + liftOf(heights, shown.current) - g.position.y) * Math.min(1, delta * 10);
            if (follow.id === token.id) follow.walking = false;
            return;
        }
        step.current = Math.min(1, step.current + delta / 0.15);
        const [ax, , az] = hexToWorld(shown.current, 1);
        const [bx, , bz] = hexToWorld(route.current[0], 1);
        const t = step.current;
        const ground = liftOf(heights, shown.current) + (liftOf(heights, route.current[0]) - liftOf(heights, shown.current)) * t;
        g.position.set(ax + (bx - ax) * t, 0.1 + ground + Math.sin(Math.PI * t) * 0.15, az + (bz - az) * t);
        follow.at.set(g.position.x, 0.1 + ground, g.position.z); follow.walking = true; follow.id = token.id;
        if (t >= 1) {
            shown.current = route.current.shift()!;
            step.current = 0;
            if (route.current.length === 0) bounce.current = 1;   // that was the last hex: land with a bounce
        }
    });

    // ---- looks ----
    const portrait = usePortrait(token.portrait);
    const down = token.health === 'Down';
    const color = down ? TOKEN_COLORS.down
        : token.kind === 'monster' ? TOKEN_COLORS.monster
        : token.kind === 'summon' ? TOKEN_COLORS.summon
        : mine ? TOKEN_COLORS.mine : TOKEN_COLORS.player;
    const share = token.hp ? Math.max(0, token.hp.current) / token.hp.max : HEALTH_SHARE[token.health ?? ''] ?? 1;
    const ringColor = share > 0.5 ? '#4caf50' : share > 0.25 ? '#e0a63b' : '#d0503c';

    // ---- hurt and healed: a burst of light, a shake, and the change floating up ----
    const shake = useRef(0);
    const before = useRef({ hp: token.hp?.current ?? null, health: token.health ?? null });
    const [hits, setHits] = useState<{ id: number; text: string; heal: boolean; plain?: boolean }[]>([]);
    // a miss or a save shows nothing on the HP, so the feed's notice floats up instead (step 17)
    useEffect(() => {
        if (!notice) return;
        const id = Date.now() + Math.random();
        setHits((list) => [...list, { id, text: notice.text, heal: false, plain: true }]);
        const timer = setTimeout(() => setHits((list) => list.filter((h) => h.id !== id)), 1400);
        return () => clearTimeout(timer);
    }, [notice?.id]);
    useEffect(() => {
        const was = before.current;
        const now = { hp: token.hp?.current ?? null, health: token.health ?? null };
        before.current = now;
        let hit: { text: string; heal: boolean } | null = null;
        if (was.hp !== null && now.hp !== null && now.hp !== was.hp) {
            hit = { text: `${now.hp > was.hp ? '+' : ''}${now.hp - was.hp}`, heal: now.hp > was.hp };   // a character: the number
        } else if (was.hp === null && now.hp === null && now.health && was.health && now.health !== was.health) {
            const order = Object.keys(HEALTH_SHARE);                                                 // a monster: only the word
            hit = { text: now.health, heal: order.indexOf(now.health) < order.indexOf(was.health) };
        }
        if (!hit) return;
        const found = hit, id = Date.now();
        if (!found.heal) shake.current = 1;
        setHits((list) => [...list, { id, ...found }]);
        const timer = setTimeout(() => setHits((list) => list.filter((h) => h.id !== id)), 1400);
        return () => clearTimeout(timer);
    }, [token.hp?.current, token.health]);

    // under the name: a character's HP, a monster's health word (players never see its numbers), and conditions
    const health = token.hp ? `${token.hp.current}/${token.hp.max}${token.hp.temp > 0 ? ` +${token.hp.temp}` : ''}` : token.health;
    const details = [health, ...token.conditions].filter(Boolean).join(' · ');
    const label = (at: [number, number, number]) => (
        <Html position={at} center className={styles.label} wrapperClass={styles.labelWrap}
            pointerEvents="none" portal={labels as RefObject<HTMLElement>}>
            <span className={styles.labelName}>{token.name}</span>
            {details && <span className={styles.labelDetails}>{details}</span>}
        </Html>
    );

    return (
        <group ref={piece} position={[start[0], 0.1 + liftOf(heights, token), start[2]]}>
            {hits.map((h) => (
                <group key={h.id}>
                    {!h.plain && <HitBurst heal={h.heal} />}
                    <Html position={[0, CARD_H + 0.8, 0]} center pointerEvents="none" portal={labels as RefObject<HTMLElement>}>
                        <span className={h.plain ? `${styles.hit} ${styles.hitPlain}` : h.heal ? `${styles.hit} ${styles.hitHeal}` : styles.hit}>{h.text}</span>
                    </Html>
                </group>
            ))}
            {/* selected: a glowing gold ring left on the board under the lifted piece */}
            {selected && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
                    <ringGeometry args={[0.8, 0.95, 48]} />
                    <meshStandardMaterial ref={ring} color="#f5d061" emissive="#f5d061" emissiveIntensity={1.6} toneMapped={false} />
                </mesh>
            )}

            <group ref={lift}>
                {/* the stand: a metal disc in the owner's colour */}
                <mesh position={[0, 0.06, 0]} castShadow receiveShadow onClick={onClick}>
                    <cylinderGeometry args={[0.5, 0.55, 0.12, 40]} />
                    <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.35} clearcoat={1} clearcoatRoughness={0.2} />
                </mesh>

                {/* the health ring around the foot of the card: starts at the top and goes round as far as their health */}
                {share > 0 && (
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.122, 0]}>
                        <ringGeometry args={[0.38, 0.48, 40, 1, Math.PI / 2, share * Math.PI * 2]} />
                        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.4} />
                    </mesh>
                )}

                {/* the card: always turned to face the camera. When they're down, it falls over flat. */}
                {down ? (
                    <group position={[0, 0.14, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
                        <StandeeCard portrait={portrait} name={token.name} color={color} onClick={onClick} />
                    </group>
                ) : (
                    <Billboard position={[0, 0.12, 0]}>
                        <StandeeCard portrait={portrait} name={token.name} color={color} onClick={onClick} />
                        {/* the name rides on the card, so it's always just above it on screen */}
                        {label([0, CARD_H + 0.35, 0])}
                    </Billboard>
                )}
            </group>

            {/* a fallen standee's name sits just beyond it */}
            {down && label([0, 0.5, -0.9])}
        </group>
    );
}

// A token on the board, redrawn only when that token (or whether it's selected) changes
export const TokenOnBoard = memo(function TokenOnBoard({ onPick, ...piece }: Omit<Parameters<typeof TokenPiece>[0], 'onClick'> & {
    onPick: (token: Token, e: ThreeEvent<MouseEvent>) => void;
}) {
    const onClick = useCallback((e: ThreeEvent<MouseEvent>) => onPick(piece.token, e), [onPick, piece.token]);
    return <TokenPiece {...piece} onClick={onClick} />;
});
