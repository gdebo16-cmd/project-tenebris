// What the character carries: equipped gear first, then items. Buying and equipping stay on the inventory page.
import { Link } from 'react-router';
import styles from '../Sheet.module.css';
import type { BlockProps } from './types.ts';

export default function InventoryBlock({ creature, canEdit }: Pick<BlockProps, 'creature' | 'canEdit'>) {
    const gear = [...creature.gear.weapons, ...creature.gear.armor];
    return (
        <section className={styles.block} aria-label="Gear">
            <h2 className={styles.heading}>Gear</h2>
            {gear.length === 0 && creature.gear.items.length === 0 && <span className={styles.muted}>Nothing carried.</span>}
            {gear.map((g) => (
                <div key={`${'armor_type' in g ? 'a' : 'w'}${g.id}`} className={styles.row}>
                    <span className={styles.rowText}>{g.name}</span>
                    <span className={styles.muted}>{g.is_equipped ? 'Equipped' : 'Carried'}</span>
                </div>
            ))}
            {creature.gear.items.map((item) => (
                <div key={`i${item.id}`} className={styles.row}>
                    <span className={styles.rowText}>{item.name}</span>
                    <span className={styles.muted}>{item.quantity ? `×${String(item.quantity)}` : item.is_equipped ? 'Equipped' : ''}</span>
                </div>
            ))}
            {canEdit && <Link to={`/characters/${creature.id}/inventory`}>Manage inventory</Link>}
        </section>
    );
}
