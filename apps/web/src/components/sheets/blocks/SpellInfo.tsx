import { signed } from '@tenebris/rules/math';
import { statName } from '@tenebris/rules/stats';
import { Description, DetailBox, DetailBoxes, Fact } from './DetailsPanel.tsx';
import { text, yes } from './detailsUtil.ts';

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
