import type { SheetArmor } from '@tenebris/rules/creature';
import { Description, DetailBox, DetailBoxes, Fact } from './DetailsPanel.tsx';
import { text, yes, type Loose } from './detailsUtil.ts';

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
