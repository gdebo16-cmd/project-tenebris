import { signed } from '@tenebris/rules/math';
import type { SheetWeapon, WeaponAction } from '@tenebris/rules/creature';
import { Description, DetailBox, DetailBoxes, Fact } from './DetailsPanel.tsx';
import { text, type Loose } from './detailsUtil.ts';

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
