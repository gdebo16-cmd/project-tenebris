// Proficiencies from the role, then a weapon, armor and items, and the default money (drafts pick one of three).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../../../api.ts';
import formStyles from '../CharacterForm.module.css';
import styles from './GearTab.module.css';
import { useCharacterForm, useDefaultGear, useFinish, useSaveTab } from '../queries.ts';
import { COINS, MONEY_PRESETS, MONEY_PRESET_KEYS, type MoneyPresetKey, type Purse } from '@tenebris/rules/money';
import type { CharacterFormData } from '../types.ts';

type Props = { id?: string };

export default function GearTab({ id }: Props) {
    if (!id) return <p>Save the header first. Then you can pick gear.</p>;
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

    function addItem(value: string) {
        const itemId = Number(value);
        if (!itemId || itemIds.includes(itemId)) return;
        setItemIds((current) => [...current, itemId]);
    }

    return (
        <form className={styles.gear} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <section className={styles.prof}>
                <h2 className={styles.note}>Proficiencies</h2>
                <p>Armor: {list(gear.proficiencies.armor)}</p>
                <p>Weapons: {list(gear.proficiencies.weapons)}</p>
                <p>Tools: {list(gear.proficiencies.tools)}</p>
                <p className={styles.note}>Callings do not add proficiencies yet.</p>
            </section>
            <label className={styles.field}>
                Weapon
                <select aria-label="Weapon" value={weaponId} onChange={(event) => setWeaponId(event.target.value)}>
                    <option value="">Choose a weapon</option>
                    {gear.weapons.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} {item.proficient ? '✓' : '✗'}</option>
                    ))}
                </select>
                {weapon && <span className={styles.note}>{weapon.proficient ? '✓ Proficient with this weapon' : '✗ Not proficient with this weapon'}</span>}
            </label>
            <label className={styles.field}>
                Armor
                <select aria-label="Armor" value={armorId} onChange={(event) => setArmorId(event.target.value)}>
                    <option value="">No armor</option>
                    {gear.armor.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} {item.proficient ? '✓' : '✗'}</option>
                    ))}
                </select>
                {armor && <span className={styles.note}>{armor.proficient ? '✓ Proficient with this armor' : '✗ Not proficient with this armor'}</span>}
            </label>
            <label className={styles.field}>
                Item
                <select aria-label="Item" value="" onChange={(event) => addItem(event.target.value)}>
                    <option value="">Add an item</option>
                    {gear.items.filter((item) => !itemIds.includes(item.id)).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                </select>
            </label>
            {itemIds.length > 0 && (
                <ul className={styles.chosen}>
                    {itemIds.map((itemId) => (
                        <li key={itemId}>
                            {gear.items.find((item) => item.id === itemId)?.name ?? 'Item'}
                            <button type="button" className={styles.secondary} onClick={() => setItemIds((current) => current.filter((id) => id !== itemId))}>Remove</button>
                        </li>
                    ))}
                </ul>
            )}
            {gear.can_pick_money ? (
                <fieldset className={styles.money}>
                    <legend className={styles.note}>Default money</legend>
                    <div className={styles.presets}>
                        {MONEY_PRESET_KEYS.map((key) => (
                            <button key={key} type="button" aria-pressed={moneyPreset === key}
                                className={`${styles.preset} ${moneyPreset === key ? styles.presetOn : ''}`}
                                onClick={() => setMoneyPreset(key)}>
                                <span className={styles.presetName}>{MONEY_PRESETS[key].label}</span>
                                <span className={styles.note}>{coinText(MONEY_PRESETS[key].purse)}</span>
                            </button>
                        ))}
                    </div>
                </fieldset>
            ) : (
                <p>Money: {coinText(gear.purse)}. Change it on the sheet.</p>
            )}
            <div className={styles.actions}>
                <button type="button" className={styles.secondary} disabled={fill.isPending} onClick={onDefault}>Auto default</button>
                <button type="submit" className={formStyles.save} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
                <button type="button" className={styles.secondary} disabled={finish.isPending} onClick={onFinish}>Finish</button>
            </div>
            {error && <p className={formStyles.error} role="alert">{error}</p>}
            {missing.length > 0 && (
                <ul className={styles.missing}>
                    {missing.map((line) => <li key={line}>{line}</li>)}
                </ul>
            )}
        </form>
    );
}

// "10 copper, 10 silver" (coins that are 0 are left out)
function coinText(purse: Purse): string {
    const parts = COINS.filter((c) => purse[c] > 0).map((c) => `${purse[c]} ${c}`);
    return parts.length ? parts.join(', ') : 'none';
}

function list(names: string[]): string {
    return names.length ? names.join(', ') : 'None';
}

function messageOf(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}
