// Portrait, name, "species · role (calling) · level", and the role's rune.
// A monster shows "type · Threat n · XP" (and its pack name when the DM gave it a nickname) instead.
import styles from './SheetHeader.module.css';
import type { BlockProps } from './types.ts';

export default function SheetHeader({ creature }: Pick<BlockProps, 'creature'>) {
    const m = creature.monster;
    const role = creature.role ? `${creature.role}${creature.calling ? ` (${creature.calling})` : ''}` : null;
    const subtitle = m
        ? [m.packName !== creature.name ? m.packName : null, m.type, `Threat ${m.threat}`, `${m.xp.toLocaleString()} XP`].filter(Boolean).join(' · ')
        : [creature.species, role, `Level ${creature.level}`].filter(Boolean).join(' · ');
    return (
        <section className={styles.headerBlock} aria-label={m ? 'Monster' : 'Character'}>
            <div className={styles.header}>
                <img className={styles.portrait} src={creature.portrait ?? '/default-character.png'} alt={`Portrait of ${creature.name}`} />
                <div className={styles.headerText}>
                    <h1 className={styles.title}>{creature.name}</h1>
                    <p className={styles.muted}>{subtitle}</p>
                </div>
                {creature.role && <img className={styles.rune} src={`/glyphs/classes/thumbs/${creature.role.toLowerCase()}.webp`} alt={`${creature.role} rune`} />}
            </div>
        </section>
    );
}
