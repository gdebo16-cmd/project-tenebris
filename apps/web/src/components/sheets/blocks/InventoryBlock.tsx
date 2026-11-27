// The Gear tab's equipment: armor, weapons and magical items, each with Equip / Unequip (owner or DM).
// An equipped weapon also offers its options (dual wield, two hands, Soul Brand for a Reaver, sigil mark for a Wraith)
// and a Tome of Inscription Mage can inscribe runes, as on the old sheet. The server checks every change; after each one the
// sheet reloads, so Armor Class and the Actions tab follow. Buying and selling stay on the inventory page.
import { useState } from 'react';
import { Link } from 'react-router';
import { ITEM_SLOTS, weaponOptions, wielderPowers, type ItemRune, type RuneInfo } from '@tenebris/rules/equipment';
import { EMPTY_WEAPON_FILTER, RARITIES, WEAPON_CATEGORIES, filterSortWeapons, type WeaponFilter, type WeaponSort } from '@tenebris/rules/weapons';
import type { SheetArmor, SheetItem, SheetWeapon } from '@tenebris/rules/creature';
import styles from '../../../styles/components/sheets/blocks/InventoryBlock.module.css';
import panelCss from '../../../styles/components/sheets/blocks/ActionPanel.module.css';
import { useGear, useRuneInfo } from '../../../features/sheets/queries.ts';
import RuneControl from './RuneControl.tsx';
import DetailsPanel from './DetailsPanel.tsx';
import { ArmorInfo } from './ArmorInfo.tsx';
import { ItemInfo } from './ItemInfo.tsx';
import { WeaponInfo } from './WeaponInfo.tsx';
import type { BlockProps } from '../../../features/sheets/types.ts';

type Props = Pick<BlockProps, 'creature' | 'canEdit' | 'onNote'> & { id: string };

const runesOf = (item: SheetArmor | SheetWeapon) => (item.runes ?? []) as unknown as ItemRune[];
const armorLabel = (a: SheetArmor) => `${a.armor_type ?? 'armor'}, +${String(a.ac_bonus ?? 0)} AC`;
const weaponLabel = (w: SheetWeapon) => [w.damage_dice, w.weapon_category ?? w.category].filter(Boolean).join(' ');
// Category / rarity filters and a sort for the weapon list, the same picks as the old sheet's filter
function WeaponFilterBar({ value, onChange }: { value: WeaponFilter; onChange: (next: WeaponFilter) => void }) {
    return (
        <div className={styles.filters}>
            <select className={styles.input} aria-label="Weapon category" value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value })}>
                <option value="">All categories</option>
                {WEAPON_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={styles.input} aria-label="Rarity" value={value.rarity} onChange={(e) => onChange({ ...value, rarity: e.target.value })}>
                <option value="">All rarities</option>
                {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className={styles.input} aria-label="Sort weapons" value={value.sort} onChange={(e) => onChange({ ...value, sort: e.target.value as WeaponSort })}>
                <option value="name">Sort: Name</option>
                <option value="category">Sort: Category</option>
                <option value="rarity">Sort: Rarity</option>
            </select>
        </div>
    );
}

const itemLabel = (it: SheetItem) => `${String(it.rarity ?? '')}${Number(it.quantity) > 1 ? ` ×${String(it.quantity)}` : ''}`.trim();

export default function InventoryBlock({ creature, canEdit, id, onNote }: Props) {
    const gear = useGear(id);
    const powers = wielderPowers(creature);
    const runeInfo = useRuneInfo(id, canEdit && powers.runes);
    const info: RuneInfo | undefined = runeInfo.data?.isRuneCaller ? runeInfo.data : undefined;
    const [error, setError] = useState('');
    const [weaponFilter, setWeaponFilter] = useState<WeaponFilter>(EMPTY_WEAPON_FILTER);
    // The armor, weapon or item whose name was clicked (shown in the details panel)
    const [openGear, setOpenGear] = useState<{ kind: 'armor' | 'weapon' | 'item'; id: number } | null>(null);
    const busy = gear.isPending;

    async function send(path: string, body: Record<string, unknown>) {
        setError('');
        try {
            const answer = await gear.mutateAsync({ path, body });
            if (answer.endedOldest) onNote(`Active rune limit reached: your oldest rune (${answer.endedOldest}) ended.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    }

    // Equipped + Unequip, or Equip, the same for every kind
    const equipButton = (kind: 'armor' | 'weapon' | 'item', itemId: number, name: string, equipped: boolean) => canEdit && (
        <button type="button" className={`${styles.button} ${equipped ? '' : styles.primary}`} disabled={busy}
            aria-label={`${equipped ? 'Unequip' : 'Equip'} ${name}`}
            onClick={() => send(`inventory/${kind}/${equipped ? 'unequip' : 'equip'}`, { [`${kind}_id`]: itemId })}>
            {equipped ? 'Unequip' : 'Equip'}
        </button>
    );

    const toggle = (label: string, on: boolean, path: string, flag: string, weaponId: number) => (
        <label className={styles.option}>
            <input type="checkbox" className={styles.optionBox} checked={on} disabled={!canEdit || busy}
                onChange={() => send(`inventory/weapon/${path}`, { weapon_id: weaponId, [flag]: !on })} />
            {label}
        </label>
    );

    const { armor, weapons, items } = creature.gear;
    const magicItems = items.filter((it) => it.item_category === 'magical_item');
    const slotsUsed = magicItems.filter((it) => it.is_equipped).length;
    const shownWeapons = filterSortWeapons(weapons, weaponFilter);
    const openArmor = openGear?.kind === 'armor' ? armor.find((a) => a.id === openGear.id) : undefined;
    const openWeapon = openGear?.kind === 'weapon' ? weapons.find((w) => w.id === openGear.id) : undefined;
    const openItem = openGear?.kind === 'item' ? items.find((it) => it.id === openGear.id) : undefined;
    const openName = openArmor?.name ?? openWeapon?.name ?? openItem?.name;

    return (
        <section className={styles.block} aria-label="Gear">
            <h2 className={`${styles.heading} ${panelCss.title}`}>Gear</h2>
            {error && <p className={styles.error} role="alert">{error}</p>}

            <h3 className={styles.subheading}>Armor</h3>
            {armor.length === 0 && <span className={styles.muted}>No armor yet.</span>}
            {armor.map((a) => (
                <div key={`a${a.id}`} className={`${styles.row} ${styles.gearRow} ${panelCss.row}`}>
                    <div className={styles.gearLine}>
                        <div className={styles.rowText}>
                            <button type="button" className={`${styles.nameButton} ${panelCss.name}`} onClick={() => setOpenGear({ kind: 'armor', id: a.id })}>{a.name}</button>
                            <span className={styles.muted}>{armorLabel(a)}{a.is_equipped ? ' · Equipped' : ''}</span>
                        </div>
                        {equipButton('armor', a.id, a.name, !!a.is_equipped)}
                    </div>
                    {info && (
                        <RuneControl info={info} kind="armor" itemId={a.id} itemName={a.name} itemType={a.armor_type === 'shield' ? 'shield' : 'armor'}
                            itemRunes={runesOf(a)} busy={busy} onSend={send} />
                    )}
                </div>
            ))}

            <h3 className={styles.subheading}>Weapons</h3>
            {weapons.length === 0 && <span className={styles.muted}>No weapons yet.</span>}
            {weapons.length > 0 && <WeaponFilterBar value={weaponFilter} onChange={setWeaponFilter} />}
            {weapons.length > 0 && shownWeapons.length === 0 && <span className={styles.muted}>No weapons match.</span>}
            {shownWeapons.map((w) => {
                const opts = weaponOptions(creature, w);
                const dice = opts.twoHands ? w.versatile_dice : w.damage_dice;
                return (
                    <div key={`w${w.id}`} className={`${styles.row} ${styles.gearRow} ${panelCss.row}`}>
                        <div className={styles.gearLine}>
                            <div className={styles.rowText}>
                                <button type="button" className={`${styles.nameButton} ${panelCss.name}`} onClick={() => setOpenGear({ kind: 'weapon', id: w.id })}>{w.name}</button>
                                <span className={styles.muted}>{weaponLabel(w)}{w.is_equipped ? ' · Equipped' : ''}</span>
                            </div>
                            {equipButton('weapon', w.id, w.name, !!w.is_equipped)}
                        </div>
                        {(opts.dualWield !== null || opts.soulBrand !== null || opts.sigilMark !== null) && (
                            <div className={styles.options} aria-label={`${w.name} options`}>
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
                                        <span className={styles.muted}>{opts.sigilMark ? 'Intellect for attack and damage; Sigil Strike applies.' : 'One weapon at a time.'}</span>
                                    </>
                                )}
                                {opts.soulBrand !== null && (
                                    <>
                                        {toggle('Soul Brand', opts.soulBrand, 'soul-brand', 'soul_branded', w.id)}
                                        <span className={styles.muted}>
                                            {opts.soulBrand ? `Confidence for attack and damage; Soul Strike +${creature.strikes.soulStrikeDice} force.` : 'One weapon at a time.'}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                        {opts.runes && info && (
                            <RuneControl info={info} kind="weapon" itemId={w.id} itemName={w.name} itemType="weapon"
                                itemRunes={runesOf(w)} isRunedWeapon={!!w.is_runed} busy={busy} onSend={send} />
                        )}
                    </div>
                );
            })}

            <h3 className={styles.subheading}>Items: {slotsUsed}/{ITEM_SLOTS} slots</h3>
            {items.length === 0 && <span className={styles.muted}>No items yet.</span>}
            {items.map((it) => (
                <div key={`i${it.id}`} className={`${styles.row} ${panelCss.row}`}>
                    <div className={styles.rowText}>
                        <button type="button" className={`${styles.nameButton} ${panelCss.name}`} onClick={() => setOpenGear({ kind: 'item', id: it.id })}>{it.name}</button>
                        <span className={styles.muted}>{itemLabel(it)}{it.is_equipped ? `${itemLabel(it) ? ' · ' : ''}Equipped` : ''}</span>
                    </div>
                    {it.item_category === 'magical_item' && equipButton('item', it.id, it.name, !!it.is_equipped)}
                </div>
            ))}

            {canEdit && <Link to={`/characters/${creature.id}/inventory`}>Manage inventory</Link>}

            {openName && (
                <DetailsPanel title={openName} onClose={() => setOpenGear(null)}>
                    {openArmor && <ArmorInfo armor={openArmor} />}
                    {openWeapon && <WeaponInfo weapon={openWeapon} />}
                    {openItem && <ItemInfo item={openItem} />}
                </DetailsPanel>
            )}
        </section>
    );
}
