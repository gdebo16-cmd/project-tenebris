// Proficiencies from the role, then a weapon, armor and items, and the default money (drafts pick one of three).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../../api.ts';
import formStyles from '../../../styles/features/character-form/CharacterForm.module.css';
import styles from '../../../styles/components/character-form/tabs/GearTab.module.css';
import { useCharacterForm, useDefaultGear, useFinish, useSaveTab } from '../../../features/character-form/queries.ts';
import { COINS, MONEY_PRESETS, MONEY_PRESET_KEYS, type MoneyPresetKey, type Purse } from '@tenebris/rules/money';
import type { CharacterFormData } from '../../../features/character-form/types.ts';
import { messageOf } from '../../../features/character-form/messageOf.ts';

type Props = { id: string };

export default function GearTab({ id }: Props) {
    return <GearFields id={id} />;
}

function GearFields({ id }: { id: string }) {
    const form = useCharacterForm(id);
    const save = useSaveTab(id, 'gear');
    const fill = useDefaultGear(id);
    const finish = useFinish(id);
    const navigate = useNavigate();
    const [weaponId, setWeaponId] = useState('');
    const [armorId, setArmorId] = useState('');
    const [itemIds, setItemIds] = useState<number[]>([]);
    const [moneyPreset, setMoneyPreset] = useState<MoneyPresetKey | null>(null);
    const [filled, setFilled] = useState(false);
    const [error, setError] = useState('');
    const [missing, setMissing] = useState<string[]>([]);

    useEffect(() => {
        if (!form.data || filled) return;
        apply(form.data);
        setFilled(true);
    }, [form.data, filled]);

    if (form.error) return <p className={formStyles.error} role="alert">{messageOf(form.error)}</p>;
    if (form.isPending || !form.data) return null;

    const gear = form.data.gear;
    if (!form.data.role.role_id) return <p>Pick a role first. Then you can choose gear.</p>;

    const roleId = form.data.role.role_id;
    const roleName = form.data.options.roles.find((item) => item.id === roleId)?.name ?? 'Your role';
    const weapon = gear.weapons.find((item) => String(item.id) === weaponId);
    const armor = gear.armor.find((item) => String(item.id) === armorId);

    function apply(data: CharacterFormData) {
        setWeaponId(data.gear.weapon_id == null ? '' : String(data.gear.weapon_id));
        setArmorId(data.gear.armor_id == null ? '' : String(data.gear.armor_id));
        setItemIds(data.gear.item_ids);
        setMoneyPreset(data.gear.money_preset);
    }

    // The pick is sent with Save and with Finish; only a draft may pick
    const moneyBody = gear.can_pick_money && moneyPreset ? { money_preset: moneyPreset } : {};

    async function onSave() {
        setError('');
        setMissing([]);
        try {
            const saved = await save.mutateAsync({ weapon_id: Number(weaponId), armor_id: armorId || null, item_ids: itemIds, ...moneyBody });
            apply(saved);
        } catch (err) { setError(messageOf(err)); }
    }

    async function onDefault() {
        setError('');
        setMissing([]);
        try { apply(await fill.mutateAsync()); }
        catch (err) { setError(messageOf(err)); }
    }

    async function onFinish() {
        setError('');
        setMissing([]);
        try {
            await finish.mutateAsync(moneyBody);
            navigate(`/characters/${id}`);
        } catch (err) {
            setError(messageOf(err));
            setMissing(err instanceof ApiError ? err.missing : []);
        }
    }

    // Items are chips: tap to add, tap again to take it back out.
    function toggleItem(itemId: number) {
        setItemIds((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);
    }

    return (
        <form className={styles.gear} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <section className={styles.profCard}>
                <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>Proficiencies</h2>
                    <span className={styles.canUse}>{roleName} can use:</span>
                </div>
                <div className={styles.profGroups}>
                    <ChipGroup title="Armor" names={gear.proficiencies.armor} />
                    <ChipGroup title="Weapons" names={gear.proficiencies.weapons} />
                    <ChipGroup title="Tools" names={gear.proficiencies.tools} />
                </div>
                <p className={styles.note}>Callings do not add proficiencies yet.</p>
            </section>
            <section className={styles.gearCard}>
                <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>Gear</h2>
                    <button type="button" className={styles.accentButton} disabled={fill.isPending} onClick={onDefault}>Auto default</button>
                </div>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Weapon</span>
                    <select className={styles.select} aria-label="Weapon" value={weaponId} onChange={(event) => setWeaponId(event.target.value)}>
                        <option value="">Choose a weapon</option>
                        {gear.weapons.map((item) => (
                            <option key={item.id} value={item.id}>{item.name} {item.proficient ? '✓' : '✗'}</option>
                        ))}
                    </select>
                    {weapon && <span className={weapon.proficient ? styles.proficient : styles.notProficient}>{weapon.proficient ? 'Proficient' : 'Not proficient'}</span>}
                </label>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Armor</span>
                    <select className={styles.select} aria-label="Armor" value={armorId} onChange={(event) => setArmorId(event.target.value)}>
                        <option value="">No armor</option>
                        {gear.armor.map((item) => (
                            <option key={item.id} value={item.id}>{item.name} {item.proficient ? '✓' : '✗'}</option>
                        ))}
                    </select>
                    {armor && <span className={armor.proficient ? styles.proficient : styles.notProficient}>{armor.proficient ? 'Proficient' : 'Not proficient'}</span>}
                </label>
                {gear.can_pick_money ? (
                    <fieldset className={styles.money}>
                        <legend className={styles.fieldLabel}>Default money</legend>
                        <div className={styles.presets}>
                            {MONEY_PRESET_KEYS.map((key) => (
                                <button key={key} type="button" aria-pressed={moneyPreset === key}
                                    className={moneyPreset === key ? styles.presetOn : styles.preset}
                                    onClick={() => setMoneyPreset(key)}>
                                    <span className={styles.presetName}>{MONEY_PRESETS[key].label}</span>
                                    <span className={styles.note}>{coinText(MONEY_PRESETS[key].purse)}</span>
                                </button>
                            ))}
                        </div>
                    </fieldset>
                ) : (
                    <p className={styles.note}>Money: {coinText(gear.purse)}. Change it on the sheet.</p>
                )}
            </section>
            <section className={styles.itemsCard}>
                <h2 className={styles.cardTitle}>Items</h2>
                <div className={styles.itemChips} role="group" aria-label="Items">
                    {gear.items.map((item) => {
                        const on = itemIds.includes(item.id);
                        return (
                            <button key={item.id} type="button" className={on ? styles.itemOn : styles.item} aria-pressed={on} onClick={() => toggleItem(item.id)}>
                                {item.name}
                            </button>
                        );
                    })}
                </div>
                <p className={styles.note}>Auto default fills this tab only, with the role and calling starting kit.</p>
            </section>
            <div className={styles.actions}>
                {error && <p className={formStyles.error} role="alert">{error}</p>}
                {missing.length > 0 && (
                    <ul className={styles.missing}>
                        {missing.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                )}
                <div className={styles.actionButtons}>
                    <button type="submit" className={styles.secondary} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
                    <button type="button" className={styles.finish} disabled={finish.isPending} onClick={onFinish}>Create character</button>
                </div>
            </div>
        </form>
    );
}

function ChipGroup({ title, names }: { title: string; names: string[] }) {
    return (
        <div className={styles.profGroup}>
            <h3 className={styles.groupTitle}>{title}</h3>
            <ul className={styles.chips}>
                {names.length ? names.map((name) => <li key={name} className={styles.chip}>{name}</li>) : <li className={styles.chip}>None</li>}
            </ul>
        </div>
    );
}

// "10 copper, 10 silver" (coins that are 0 are left out)
function coinText(purse: Purse): string {
    const parts = COINS.filter((c) => purse[c] > 0).map((c) => `${purse[c]} ${c}`);
    return parts.length ? parts.join(', ') : 'none';
}

