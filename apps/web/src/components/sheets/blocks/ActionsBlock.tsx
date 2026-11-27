// The Actions tab's four groups, ported from the old sheet, with the server rolling every check.
// Physical: main-hand weapons and Fists. Magical: prepared action spells that are not a bonus or reaction.
// Bonus: off-hand weapons, Call the Brand, Lantern Runes, bonus spells and bonus features.
// Reactions: Mending Runes, reaction spells and reaction features.
// The Spells and Features tabs stay as they are; this tab gathers the same actions by timing.
import { useState } from 'react';
import { signed } from '@tenebris/rules/math';
import { scaledAt, type ScalingStep } from '@tenebris/rules/spellSlots';
import { spellDiceAt, spellHealAt, type SpellAction, type WeaponAction, type CreatureFeature } from '@tenebris/rules/creature';
import { statName } from '@tenebris/rules/stats';
import { weaponOptions, wielderPowers } from '@tenebris/rules/equipment';
import { useGear } from '../../../features/sheets/queries.ts';
import type { UtilityRune } from '@tenebris/rules/runes';
import styles from '../../../styles/components/sheets/blocks/ActionsBlock.module.css';
import panelCss from '../../../styles/components/sheets/blocks/ActionPanel.module.css';
import DetailsPanel, { PanelExtras } from './DetailsPanel.tsx';
import { FeatureInfo, SpellInfo, WeaponInfo } from './details.tsx';
import type { BlockProps } from '../../../features/sheets/types.ts';

type Props = BlockProps & {
    id: string;
    onCast: (actionKey: string, castLevel: number) => void;
    onUse: (featureKey: string) => void;
    onRune: (runeKey: string) => void;
};

type OpenItem = { kind: 'weapon' | 'spell' | 'feature'; key: string };

export default function ActionsBlock({ creature, canEdit, onAct, onNote, onCast, onUse, onRune, id }: Props) {
    const gear = useGear(id);
    const [gearError, setGearError] = useState('');
    const [runicUsed, setRunicUsed] = useState(false);
    const [castLevels, setCastLevels] = useState<Record<string, number>>({});
    const [open, setOpen] = useState<OpenItem | null>(null);
    const [litLanterns, setLitLanterns] = useState<Record<string, boolean>>({});

    const hitFeature = creature.features.find((f) => f.on_weapon_hit);
    const hitFeatureDice = hitFeature ? String(scaledAt(hitFeature.dice_scaling as ScalingStep[] | null, 'dice', creature.level, hitFeature.dice as number) ?? '') : '';
    const { slots, usedSlots, toHit, saveDc } = creature.spellcasting;
    const left = (level: number) => (slots[level - 1] ?? 0) - (usedSlots[level] ?? 0);
    const levelsFor = (s: SpellAction) => {
        if (s.base_level < 1 || !(s.upcasts ?? []).length) return [];
        const out: number[] = [];
        for (let level = s.base_level; level <= slots.length; level++) if (left(level) > 0) out.push(level);
        return out;
    };

    const magicSpells = creature.spells.filter((s) => s.tile === 'action');
    const bonusSpells = creature.spells.filter((s) => s.tile === 'bonus');
    const reactionSpells = creature.spells.filter((s) => s.tile === 'reaction');
    const listed = (type: string) => creature.features.filter((f) => f.action_type === type && !f.on_weapon_hit);
    const bonusFeatures = listed('bonus');
    const reactionFeatures = listed('reaction');
    // Same arrangement as the old tab: bonus/reaction features also stay in those groups.
    // Class Features lists every usable feature except on-hit riders (those stay on the weapon).
    const classFeatures = creature.features.filter((f) =>
        !f.on_weapon_hit && (f.action_type === 'action' || f.action_type === 'bonus' || f.action_type === 'reaction' || f.perRest != null || f.diceNow != null));

    const powers = wielderPowers(creature);
    const brandedWeapon = [...creature.actions, ...creature.bonusActions].find((a) => a.branded);
    const hasCallTheBrand = powers.soulBrand && creature.level >= 2 && !!brandedWeapon;
    const lanterns = creature.utilityRunes.lanterns;
    const mendings = creature.utilityRunes.mending;
    const intMod = creature.stats.find((s) => s.key === 'int')?.mod ?? 0;

    const toggleOpen = (item: OpenItem) => setOpen((now) => (now && now.kind === item.kind && now.key === item.key ? null : item));

    const toggleLantern = (l: UtilityRune) => {
        const on = !litLanterns[l.key];
        setLitLanterns({ ...litLanterns, [l.key]: on });
        onNote(on
            ? `Lantern Rune (${l.item}): bright light 20 ft and dim light 20 ft more (bonus action).`
            : `Lantern Rune (${l.item}): light off (bonus action).`);
    };

    const callTheBrand = () => {
        if (!brandedWeapon) return;
        onNote(`Call the Brand: ${brandedWeapon.name} returns to your hand (bonus action). If someone holds it: Might roll DC ${creature.classDc} (an attuned holder keeps it).`);
    };

    const rollHitFeature = (a: WeaponAction) => {
        if (!hitFeature) return;
        onAct({ actionKey: a.key, kind: 'damage', featureKey: `${hitFeature.source}-${hitFeature.id}` }, `${a.name}: `);
    };

    const sendToggle = async (path: string, body: Record<string, unknown>) => {
        setGearError('');
        try {
            await gear.mutateAsync({ path, body });
        } catch (err) {
            setGearError(err instanceof Error ? err.message : 'Something went wrong');
        }
    };

    const toggle = (label: string, on: boolean, path: string, flag: string, weaponId: number) => (
        <label className={styles.option}>
            <input type="checkbox" className={styles.optionBox} checked={on} disabled={!canEdit || gear.isPending}
                onChange={() => sendToggle(`inventory/weapon/${path}`, { weapon_id: weaponId, [flag]: !on })} />
            {label}
        </label>
    );

    const weaponDetails = (a: WeaponAction) => {
        const w = a.weaponId != null ? creature.gear.weapons.find((item) => item.id === a.weaponId) : undefined;
        const opts = w ? weaponOptions(creature, w) : null;
        const dice = opts?.twoHands ? w?.versatile_dice : w?.damage_dice;
        return (
            <>
                <WeaponInfo weapon={w} action={a} />
                <PanelExtras>
                {a.runed && <p>Runed weapon: Intellect for attack and damage; Runic Strike is on this weapon.</p>}
                {opts && w && (opts.dualWield !== null || opts.soulBrand !== null || opts.sigilMark !== null) && (
                    <div className={styles.options} aria-label={`${a.name} options`}>
                        {opts.dualWield !== null && (
                            <>
                                {toggle('Dual wield', opts.dualWield, 'dual-wield', 'dual_wield', w.id)}
                                {opts.twoHands !== null && toggle('Two hands', opts.twoHands, 'two-hands', 'two_handed', w.id)}
                                <span className={styles.muted}>
                                    {opts.dualWield ? 'Bonus action; no ability modifier on damage.' : opts.twoHands ? `Attack action; two hands (${dice ?? ''}).` : 'Attack action.'}
                                </span>
                            </>
                        )}
                        {opts.sigilMark !== null && (
                            <>
                                {toggle('Sigil mark', opts.sigilMark, 'sigil-mark', 'marked', w.id)}
                                <span className={styles.muted}>{opts.sigilMark ? 'Intellect for attack and damage; Sigil Strike and the Crack bonus apply.' : 'One weapon at a time.'}</span>
                            </>
                        )}
                        {opts.soulBrand !== null && (
                            <>
                                {toggle('Soul Brand', opts.soulBrand, 'soul-brand', 'soul_branded', w.id)}
                                <span className={styles.muted}>{opts.soulBrand ? `Confidence for attack and damage; Soul Strike +${creature.strikes.soulStrikeDice} force.` : 'One weapon at a time.'}</span>
                            </>
                        )}
                    </div>
                )}
                {gearError && <p className={styles.error} role="alert">{gearError}</p>}
                </PanelExtras>
            </>
        );
    };

    const spellDetails = (s: SpellAction) => <SpellInfo spell={s} numbers={{ toHit: s.toHit, saveDc: s.saveDc, tile: s.tile }} />;

    const featureDetails = (f: CreatureFeature) => <FeatureInfo feature={f} />;

    const weaponRow = (a: WeaponAction) => (
        <div key={a.key} className={`${styles.row} ${panelCss.row}`}>
            <div className={styles.rowText}>
                <button type="button" className={`${styles.nameButton} ${panelCss.name}`} onClick={() => toggleOpen({ kind: 'weapon', key: a.key })}>{a.name}</button>
                <span className={styles.muted}>{[a.category, a.hands, a.range, a.stat].filter(Boolean).join(' · ')}</span>
            </div>
            <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                <button type="button" className={styles.button} disabled={!canEdit} aria-label={`${a.name} to hit`}
                    onClick={() => onAct({ actionKey: a.key, kind: 'hit' }, `${a.name}: `)}>{signed(a.hit)}</button>
                <button type="button" className={styles.buttonPrimary} disabled={!canEdit} aria-label={`${a.name} damage`}
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
                    <button type="button" className={styles.button} disabled={!canEdit} onClick={() => rollHitFeature(a)}>
                        +{hitFeatureDice} {hitFeature.name}
                    </button>
                )}
            </div>
        </div>
    );

    const spellRow = (s: SpellAction) => {
        const level = castLevels[s.key] ?? s.base_level;
        const dice = spellDiceAt(s, level);
        const heal = spellHealAt(s, level);
        const levels = levelsFor(s);
        const upcast = levels.length > 1 && (
            <select className={styles.input} aria-label={`${s.name} cast level`} value={level}
                onChange={(e) => setCastLevels({ ...castLevels, [s.key]: Number(e.target.value) })}>
                {levels.map((l) => <option key={l} value={l}>Level {l}</option>)}
            </select>
        );
        const castNow = () => onCast(s.key, level);
        return (
            <div key={s.key} className={`${styles.row} ${panelCss.row}`}>
                <div className={styles.rowText}>
                    <button type="button" className={`${styles.nameButton} ${panelCss.name}`} onClick={() => toggleOpen({ kind: 'spell', key: s.key })}>{s.name}</button>
                    <span className={styles.muted}>
                        {[s.base_level === 0 ? 'Cantrip' : `Level ${s.base_level}`,
                          s.attack_type ? `to hit ${signed(s.toHit)}` : null,
                          s.opponent_save_roll ? `${statName(s.opponent_save_roll)} save ${s.saveDc}` : null,
                          dice ? `${dice}${s.beams > 1 ? ` ×${s.beams} beams` : ''}` : heal ? `heals ${heal}${s.healMod ? signed(s.healMod) : ''}` : null].filter(Boolean).join(' · ')}
                    </span>
                </div>
                <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                    {upcast}
                    {s.attack_type ? (
                        <button type="button" className={styles.button} disabled={!canEdit} aria-label={`${s.name} to hit`}
                            onClick={castNow}>{signed(s.toHit)}</button>
                    ) : s.opponent_save_roll ? (
                        <button type="button" className={styles.button} disabled={!canEdit} aria-label={`${s.name} save DC`}
                            onClick={castNow}>{statName(s.opponent_save_roll)} {s.saveDc}</button>
                    ) : null}
                    {dice ? (
                        <button type="button" className={styles.buttonPrimary} disabled={!canEdit} aria-label={`${s.name} damage`}
                            onClick={() => (s.attack_type || s.opponent_save_roll)
                                ? onAct({ actionKey: s.key, kind: 'damage', castLevel: level }, `${s.name}: `)
                                : castNow()}>{dice}{s.dmgMod ? signed(s.dmgMod) : ''}</button>
                    ) : heal ? (
                        <button type="button" className={styles.buttonPrimary} disabled={!canEdit} aria-label={`${s.name} heal`}
                            onClick={castNow}>{heal}{s.healMod ? signed(s.healMod) : ''}</button>
                    ) : !(s.attack_type || s.opponent_save_roll) ? (
                        <button type="button" className={styles.buttonPrimary} disabled={!canEdit} onClick={castNow}>Cast</button>
                    ) : (
                        <button type="button" className={styles.buttonPrimary} disabled={!canEdit} onClick={castNow}>Cast</button>
                    )}
                </div>
            </div>
        );
    };

    const featureRow = (f: CreatureFeature) => {
        const uses = f.perRest;
        const canUse = canEdit && (uses != null || f.diceNow != null);
        return (
            <div key={f.key} className={`${styles.row} ${panelCss.row}`}>
                <div className={styles.rowText}>
                    <button type="button" className={`${styles.nameButton} ${panelCss.name}`} onClick={() => toggleOpen({ kind: 'feature', key: f.key })}>{f.name}</button>
                    <span className={styles.muted}>
                        {[f.diceNow, uses ? `${uses.left}/${uses.max} uses left · back on a ${uses.rest} rest` : null].filter(Boolean).join(' · ')}
                    </span>
                </div>
                {canUse && (
                    <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                        <button type="button" className={styles.buttonPrimary} disabled={uses != null && uses.left <= 0}
                            aria-label={`Use ${f.name}`} onClick={() => onUse(f.key)}>
                            {uses != null && uses.left <= 0 ? `Used (${uses.rest} rest)` : 'Use'}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const empty = (text: string) => <span className={styles.muted}>{text}</span>;

    // What the details panel shows: the weapon, spell or feature whose name was clicked
    const openWeapon = open?.kind === 'weapon' ? [...creature.actions, ...creature.bonusActions].find((a) => a.key === open.key) : undefined;
    const openSpell = open?.kind === 'spell' ? creature.spells.find((s) => s.key === open.key) : undefined;
    const openFeature = open?.kind === 'feature' ? creature.features.find((f) => f.key === open.key) : undefined;
    const openName = openWeapon?.name ?? openSpell?.name ?? openFeature?.name;

    return (
        <section className={styles.block} aria-label="Actions">
            <div className={styles.physicalActionsBlock}>
                <h2 className={`${styles.title} ${panelCss.title}`}>Actions</h2>
                <h2 className={`${styles.subtitle} ${panelCss.sectionTitle}`}>Physical Actions</h2>
                {creature.actions.map(weaponRow)}
            </div>
            <div className={styles.magicalActionsBlock}>
            <h2 className={`${styles.subtitle} ${panelCss.sectionTitle}`}>Magical Actions</h2>
            {magicSpells.length === 0 ? empty('No spells set as actions yet.') : magicSpells.map(spellRow)}
            </div>
            <div className={styles.bonusActionsBlock}>
            <h2 className={`${styles.subtitle} ${panelCss.sectionTitle}`}>Bonus Actions</h2>
            {creature.bonusActions.map(weaponRow)}
            {hasCallTheBrand && brandedWeapon && (
                <div className={`${styles.row} ${panelCss.row}`}>
                    <div className={styles.rowText}>
                        <span className={`${styles.rowName} ${panelCss.name}`}>Call the Brand ({brandedWeapon.name})</span>
                        <span className={styles.muted}>The branded weapon returns to your hand · holder Might DC {creature.classDc}</span>
                    </div>
                    <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                        <button type="button" className={styles.buttonPrimary} disabled={!canEdit} onClick={callTheBrand}>Call</button>
                    </div>
                </div>
            )}
            {lanterns.map((l) => (
                <div key={l.key} className={`${styles.row} ${panelCss.row}`}>
                    <div className={styles.rowText}>
                        <span className={`${styles.rowName} ${panelCss.name}`}>Lantern Rune ({l.item})</span>
                        <span className={styles.muted}>Bright light 20 ft and dim light 20 ft more</span>
                    </div>
                    <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                        <button type="button" className={styles.button} disabled={!canEdit} onClick={() => toggleLantern(l)}>
                            {litLanterns[l.key] ? 'Light off' : 'Light on'}
                        </button>
                    </div>
                </div>
            ))}
            {bonusSpells.map(spellRow)}
            {bonusFeatures.map(featureRow)}
            {creature.bonusActions.length === 0 && !hasCallTheBrand && lanterns.length === 0 && bonusSpells.length === 0 && bonusFeatures.length === 0 && empty('None.')}
            </div>
            <div className={styles.reactionsBlock}>
            <h2 className={`${styles.subtitle} ${panelCss.sectionTitle}`}>Reactions</h2>
            {mendings.map((m) => {
                const used = !!creature.restUses[m.key];
                return (
                    <div key={m.key} className={`${styles.row} ${panelCss.row}`}>
                        <div className={styles.rowText}>
                            <span className={`${styles.rowName} ${panelCss.name}`}>Mending Rune ({m.item})</span>
                            <span className={styles.muted}>Reduce a hit's damage · 1/long rest</span>
                        </div>
                        <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                            <button type="button" className={styles.buttonPrimary} disabled={!canEdit || used}
                                aria-label={`Mending Rune on ${m.item}`} onClick={() => onRune(m.key)}>
                                {used ? 'Used (long rest)' : `1d6${intMod ? signed(intMod) : ''}`}
                            </button>
                        </div>
                    </div>
                );
            })}
            {reactionSpells.map(spellRow)}
            {reactionFeatures.map(featureRow)}
            {mendings.length === 0 && reactionSpells.length === 0 && reactionFeatures.length === 0 && empty('None.')}
            </div>
            <div className={styles.classFeaturesBlock}>
            <h2 className={`${styles.subtitle} ${panelCss.sectionTitle}`}>Class Features</h2>
            {classFeatures.length === 0 ? empty('None.') : classFeatures.map(featureRow)}
            </div>
            {openName && (
                <DetailsPanel title={openName} onClose={() => setOpen(null)}>
                    {openWeapon && weaponDetails(openWeapon)}
                    {openSpell && spellDetails(openSpell)}
                    {openFeature && featureDetails(openFeature)}
                </DetailsPanel>
            )}
        </section>
    );
}
