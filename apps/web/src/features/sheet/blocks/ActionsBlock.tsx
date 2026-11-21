// Weapons and Fists, each with a to-hit and a damage button. The server works out every bonus and rolls.
// Off-hand (dual wielded) weapons are listed as bonus actions. Strike extras show on the weapons that have them.
import { useState } from 'react';
import { signed } from '@tenebris/rules/math';
import { scaledAt, type ScalingStep } from '@tenebris/rules/spellSlots';
import type { WeaponAction } from '@tenebris/rules/creature';
import styles from '../Sheet.module.css';
import type { BlockProps } from './types.ts';

type Props = BlockProps & { onState: (patch: Record<string, unknown>) => void };

export default function ActionsBlock({ creature, canEdit, onAct, onNote, onState }: Props) {
    // Runic Strike is once per turn; there's no turn tracker yet, so it locks until "New turn"
    const [runicUsed, setRunicUsed] = useState(false);
    // An on-hit feature such as Sigil Strike (spends embers, adds radiant dice to a sigil weapon's damage)
    const hitFeature = creature.features.find((f) => f.on_weapon_hit);
    const hitFeatureCost = hitFeature?.ember_cost == null ? 0
        : scaledAt(hitFeature.cost_scaling as ScalingStep[] | null, 'cost', creature.level, Number(hitFeature.ember_cost));
    const hitFeatureDice = hitFeature ? String(scaledAt(hitFeature.dice_scaling as ScalingStep[] | null, 'dice', creature.level, hitFeature.dice as number) ?? '') : '';

    function useHitFeature(a: WeaponAction) {
        if (!hitFeature) return;
        if (hitFeatureCost > creature.embers.current) return onNote(`Not enough embers for ${hitFeature.name}: need ${hitFeatureCost}, have ${creature.embers.current}.`);
        if (hitFeatureCost) onState({ embers_spent: creature.embers.max - creature.embers.current + hitFeatureCost });
        onAct({ actionKey: a.key, kind: 'damage', featureKey: `${hitFeature.source}-${hitFeature.id}` }, `${a.name}: `);
    }

    const row = (a: WeaponAction) => (
        <div key={a.key} className={styles.row}>
            <div className={styles.rowText}>
                <span className={styles.rowName}>{a.name}</span>
                <span className={styles.muted}>{[a.category, a.hands, a.range, a.stat].filter(Boolean).join(' · ')}</span>
            </div>
            <div className={styles.rowButtons}>
                <button type="button" className={styles.button} disabled={!canEdit} aria-label={`${a.name} to hit`}
                    onClick={() => onAct({ actionKey: a.key, kind: 'hit' }, `${a.name}: `)}>{signed(a.hit)}</button>
                <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canEdit} aria-label={`${a.name} damage`}
                    onClick={() => onAct({ actionKey: a.key, kind: 'damage' }, `${a.name}: `)}>{a.dice}{a.dmgMod ? signed(a.dmgMod) : ''}</button>
                {a.branded && (
                    <button type="button" className={styles.button} disabled={!canEdit} title="Soul Strike: on a hit, spend 1 Temper"
                        onClick={() => onAct({ actionKey: a.key, kind: 'damage', extra: 'soulStrike' }, `${a.name}: `)}>+{creature.strikes.soulStrikeDice} Soul</button>
                )}
                {a.runed && (
                    <>
                        <button type="button" className={styles.button} disabled={!canEdit || runicUsed} title="Runic Strike: once per turn"
                            onClick={() => { setRunicUsed(true); onAct({ actionKey: a.key, kind: 'damage', extra: 'runicStrike' }, `${a.name}: `); }}>
                            {runicUsed ? 'Runic used' : `+${creature.strikes.runicStrikeDice} Runic`}
                        </button>
                        {runicUsed && <button type="button" className={styles.button} onClick={() => setRunicUsed(false)}>New turn</button>}
                    </>
                )}
                {a.sigil && hitFeature && (
                    <button type="button" className={styles.button} disabled={!canEdit} onClick={() => useHitFeature(a)}>
                        +{hitFeatureDice} {hitFeature.name}{hitFeatureCost ? ` (${hitFeatureCost} embers)` : ''}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <section className={styles.block} aria-label="Actions">
            <h2 className={styles.heading}>Actions</h2>
            {creature.actions.map(row)}
            {creature.bonusActions.length > 0 && (
                <>
                    <h2 className={styles.heading}>Bonus actions</h2>
                    {creature.bonusActions.map(row)}
                </>
            )}
            {creature.embers.max > 0 && <span className={styles.muted}>Embers {creature.embers.current} / {creature.embers.max}</span>}
        </section>
    );
}
