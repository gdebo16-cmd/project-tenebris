// What the details panel shows for each kind of thing. Plain display: no buttons, no server calls.
// Fields the server didn't send are simply left out.
import { signed } from '@tenebris/rules/math';
import { statName } from '@tenebris/rules/stats';
import type { CreatureFeature, SheetArmor, SheetItem, SheetWeapon, WeaponAction } from '@tenebris/rules/creature';
import { Description, DetailBox, DetailBoxes, Fact } from './DetailsPanel.tsx';

type Loose = Record<string, unknown>;
const text = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const yes = (v: unknown) => v === true;

// ---- Weapons: the owned weapon (Gear tab) and/or its action numbers (Actions tab, monsters) ----

export function WeaponInfo({ weapon, action }: { weapon?: SheetWeapon; action?: WeaponAction }) {
    const w = (weapon ?? {}) as SheetWeapon & Loose;
    const props = w.properties ?? [];
    const range = action?.range
        ?? (w.range_normal ? `${w.range_normal}/${w.range_long ?? w.range_normal} ft` : props.includes('reach') ? '10 ft (reach)' : '5 ft');
    const hands = action?.hands
        ?? (props.includes('two-handed') ? 'Two hands' : props.includes('versatile') ? 'One or two hands' : 'One hand');
    const damage = action
        ? `${action.dice}${action.dmgMod ? signed(action.dmgMod) : ''}${action.damageType ? ` ${action.damageType}` : ''}`
        : w.damage_dice ? `${w.damage_dice}${w.damage_type ? ` ${w.damage_type}` : ''}` : null;
    return (
        <>
            <DetailBoxes>
                <DetailBox heading="Weapon Details">
                    <Fact label="Range" value={range} />
                    <Fact label="Damage" value={damage} />
                    {w.versatile_dice && <Fact label="Two hands" value={w.versatile_dice} />}
                    <Fact label="Hands" value={hands} />
                    <Fact label="Category" value={action?.category ?? text(w.weapon_category)} />
                    {w.attack_bonus ? <Fact label="Magic" value={signed(Number(w.attack_bonus))} /> : null}
                    <Fact label="Rarity" value={action?.rarity ?? text(w.rarity)} />
                </DetailBox>
                {action && (
                    <DetailBox heading="Attack">
                        <Fact label="To hit" value={signed(action.hit)} />
                        <Fact label="Stat" value={action.stat} />
                        {action.riders.map((r) => <Fact key={r.name + r.type} label={r.name} value={`+${r.dice} ${r.type}`} />)}
                        {action.dual && <Fact label="Off hand" value="Bonus action, no ability modifier on damage" />}
                    </DetailBox>
                )}
            </DetailBoxes>
            <Description text={action?.description ?? w.description} />
        </>
    );
}

// ---- Armor and shields ----

export function ArmorInfo({ armor }: { armor: SheetArmor }) {
    const a = armor as SheetArmor & Loose;
    return (
        <>
            <DetailBoxes>
                <DetailBox heading="Armor Details">
                    <Fact label="Type" value={text(a.armor_type)} />
                    <Fact label="AC" value={a.ac_bonus != null ? `+${String(a.ac_bonus)}` : null} />
                    <Fact label="Endurance cap" value={text(a.con_cap)} />
                    {yes(a.stealth_disadvantage) && <Fact label="Stealth" value="Disadvantage" />}
                    <Fact label="Rarity" value={text(a.rarity)} />
                    {a.is_equipped && <Fact label="Worn" value="Yes" />}
                </DetailBox>
            </DetailBoxes>
            <Description text={a.description} />
        </>
    );
}

// ---- Items ----

export function ItemInfo({ item }: { item: SheetItem }) {
    const it = item as SheetItem & Loose;
    const category = text(it.item_category)?.replace(/_/g, ' ');
    return (
        <>
            <DetailBoxes>
                <DetailBox heading="Item Details">
                    <Fact label="Type" value={category} />
                    <Fact label="Rarity" value={text(it.rarity)} />
                    {Number(it.quantity) > 1 && <Fact label="Quantity" value={String(it.quantity)} />}
                    <Fact label="Spell" value={text(it.spell_name)} />
                    <Fact label="Uses" value={it.uses != null ? `${String(it.uses)}${it.recharge ? ` (${String(it.recharge)})` : ''}` : null} />
                    {yes(it.consumable) && <Fact label="Consumable" value="Yes" />}
                    <Fact label="Weight" value={it.weight_lb != null ? `${Number(it.weight_lb)} lb` : null} />
                    {it.is_equipped && <Fact label="Equipped" value="Yes" />}
                </DetailBox>
            </DetailBoxes>
            <Description text={it.description} />
        </>
    );
}

// ---- Spells: a learned spell, a spell-book entry, or a prepared action spell with its numbers ----

type SpellLike = { name: string; base_level: number; [field: string]: unknown };
type SpellNumbers = { toHit?: number; saveDc?: number; tile?: string };

export function SpellInfo({ spell, numbers }: { spell: SpellLike; numbers?: SpellNumbers }) {
    const s = spell;
    const range = s.range != null && s.range !== '' ? (Number(s.range) ? `${String(s.range)} ft` : String(s.range)) : 'Reach';
    const duration = s.duration == null ? null : Number(s.duration) === 0 ? 'Instant' : `${String(s.duration)} turns`;
    const castTime = `${s.casting_time ? String(s.casting_time) : '1'} turn(s)`;
    const timing = numbers?.tile === 'bonus' ? 'Bonus action' : numbers?.tile === 'reaction' ? 'Reaction'
        : s.action_type === 'bonus' ? 'Bonus action' : s.action_type === 'reaction' ? 'Reaction' : null;
    return (
        <>
            <DetailBoxes>
                <DetailBox heading="Spell Details">
                    <Fact label="Level" value={s.base_level === 0 ? 'Cantrip' : String(s.base_level)} />
                    <Fact label="Range" value={range} />
                    <Fact label="Duration" value={duration} />
                    <Fact label="Cast time" value={castTime} />
                    <Fact label="Timing" value={timing} />
                    {s.attack_type && numbers?.toHit != null ? <Fact label="To hit" value={signed(numbers.toHit)} /> : null}
                    {s.opponent_save_roll ? (
                        <Fact label="Save" value={`${statName(String(s.opponent_save_roll))}${numbers?.saveDc != null ? ` DC ${numbers.saveDc}` : ''}`} />
                    ) : null}
                    <Fact label="Damage" value={text(s.base_damage_dice)} />
                    <Fact label="Heals" value={text(s.heal_dice)} />
                </DetailBox>
                <DetailBox heading="Incantation">
                    <Fact label="State" value={text(s.state_name)} />
                    <Fact label="Element" value={text(s.element_name)} />
                    <Fact label="Alignment" value={text(s.alignment_name)} />
                    {yes(s.is_racial) && <Fact label="Source" value="Race starter spell" />}
                    {yes(s.is_bonus) && <Fact label="Source" value="Bonus spell" />}
                </DetailBox>
            </DetailBoxes>
            <Description text={s.description} />
        </>
    );
}

// ---- Features (role, calling, species, gifts, monster abilities) ----

export function FeatureInfo({ feature }: { feature: CreatureFeature }) {
    const f = feature;
    return (
        <>
            <DetailBoxes>
                <DetailBox heading="Feature Details">
                    <Fact label="Timing" value={text(f.action_type)} />
                    <Fact label="Dice" value={f.diceNow} />
                    <Fact label="Uses" value={f.perRest ? `${f.perRest.left}/${f.perRest.max} left · back on a ${f.perRest.rest} rest` : null} />
                    <Fact label="Recharge" value={text(f.recharge)} />
                    <Fact label="From" value={text(f.source)} />
                </DetailBox>
            </DetailBoxes>
            <Description text={f.description} />
        </>
    );
}
