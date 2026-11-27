import type { CreatureFeature } from '@tenebris/rules/creature';
import { Description, DetailBox, DetailBoxes, Fact } from './DetailsPanel.tsx';
import { text } from './detailsUtil.ts';

// ---- Features (role, calling, species, gifts, monster abilities) ----

export function FeatureInfo({ feature }: { feature: CreatureFeature }) {
    const f = feature;
    return (
        <>
            <DetailBoxes>
                <DetailBox heading="Feature Details">
                    <Fact label="Timing" value={text(f.action_type)} />
                    <Fact label="Dice" value={f.diceNow} />
                    <Fact label="Uses" value={f.perRest ? `${f.perRest.left}/${f.perRest.max} left Â· back on a ${f.perRest.rest} rest` : null} />
                    <Fact label="Recharge" value={text(f.recharge)} />
                    <Fact label="From" value={text(f.source)} />
                </DetailBox>
            </DetailBoxes>
            <Description text={f.description} />
        </>
    );
}
