import { modOf, signed, healthInit } from '@tenebris/rules/math';
import { rollD20 } from '../dice';

// Click the box to roll a d20 + initiative
function Initiative({ character, hp, onRoll }) {
    const init = modOf(character.dex) + healthInit(hp, character.max_hp);

    return (
        <section className='container' id='initiative-container'>
            <article className='tile initiative-tile' id='initiative-tile-container' onClick={() => rollD20(init).then((r) => onRoll(`Initiative: ${r.total}`), (err) => onRoll(`Roll failed: ${err.message}`))}>
                <p className='tile-component label-component tile-top' id='initiative-tile-label'>Initiative</p>
                <p className='tile-component value-component' id='initiative-tile-value'>{signed(init)}</p>
            </article>
        </section>
    );
}

export default Initiative;
