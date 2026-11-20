import { modOf, signed, capitalize } from '@tenebris/rules/math';
import { rollD20 } from '../dice';

// Click a box to roll a d20 + that stat's modifier
// "bottom" replaces the score shown at the bottom (Speed shows distance instead)
function StatBox({ label, score, bottom, onRoll }) {
    const roll = () => rollD20(modOf(score)).then((r) => onRoll(`${capitalize(label)} roll: ${r.total}`), (err) => onRoll(`Roll failed: ${err.message}`));

    return (
        <article className='stat-tile' onClick={roll}>
            <p className='tile-component label-component tile-top stat-tile-label'>{label}</p>
            <p className='tile-component modifier-component stat-tile-modifier'>{signed(modOf(score))}</p>
            <p className='tile-component value-component tile-bottom stat-tile-value'>{bottom ?? score}</p>
        </article>
    );
}

export default StatBox;
