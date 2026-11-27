import type { SheetItem } from '@tenebris/rules/creature';
import { Description, DetailBox, DetailBoxes, Fact } from './DetailsPanel.tsx';
import { text, yes, type Loose } from './detailsUtil.ts';

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
