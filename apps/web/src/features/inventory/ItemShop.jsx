import { useState } from 'react';
import useFetch from '../../hooks/useFetch';
import TabList from '../../components/ui/TabList';
import { sendJson } from '../../utils/api';
import Loader from '../../components/ui/Loader';
import ItemDetails from './ItemDetails';
import WeaponFilter from '../../components/ui/WeaponFilter';
import ArmorFilter from '../../components/ui/ArmorFilter';
import { filterSortWeapons, EMPTY_WEAPON_FILTER } from '../../utils/weapons';
import { filterSortArmor, EMPTY_ARMOR_FILTER } from '../../utils/armor';
import styles from './ItemShop.module.css';

const TABS = [
    { id: 'armor', label: 'Armor' },
    { id: 'weapons', label: 'Weapons' },
    { id: 'items', label: 'Items' },
];

// 'potion' + 'health' -> 'Health Potions'; scrolls and common items have no subtype
const CATEGORY_LABELS = { potion: 'Potions', spell_scroll: 'Spell Scrolls', magical_item: 'Magical Items', common_item: 'Common Items' };
// item filter: same shape as the armor/weapon filters ({ category, rarity, sort })
const EMPTY_ITEM_FILTER = { category: '', rarity: '', sort: 'name' };
const ITEM_RARITIES = ['Common', 'Magical', 'Arcane', 'Mythical', 'Object of Power'];
const rank = (list, v) => { const i = list.indexOf(v); return i < 0 ? list.length : i; };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const itemGroupLabel = (it) => (it.item_subtype ? `${cap(it.item_subtype)} ${CATEGORY_LABELS[it.item_category] ?? ''}`.trim() : (CATEGORY_LABELS[it.item_category] ?? cap(it.item_category ?? 'Other')));

// The "shop": every armor and weapon, with Add / Remove buttons.
// Used on the /inventory page.
// onDone runs when you click "Done browsing".
function ItemShop({ characterId, onDone }) {
    const { data, setData, loading, error } = useFetch(`/api/characters/${characterId}/inventory`);
    const [tab, setTab] = useState('armor');
    const [saveError, setSaveError] = useState('');
    const [weaponFilter, setWeaponFilter] = useState(EMPTY_WEAPON_FILTER);
    const [armorFilter, setArmorFilter] = useState(EMPTY_ARMOR_FILTER);
    const [itemFilter, setItemFilter] = useState(EMPTY_ITEM_FILTER);
    const [openItem, setOpenItem] = useState(null);   // { kind: 'armor' | 'weapon', data }


    // kind is 'armor', 'weapon' or 'item', action is 'add' or 'remove'
    const changeItem = async (kind, itemId, action) => {
        const url = `/api/characters/${characterId}/inventory/${kind}${action === 'remove' ? '/remove' : ''}`;
        try {
            const owned = await sendJson(url, 'POST', { [`${kind}_id`]: itemId });
            setData((prev) => ({ ...prev, ...owned })); // swap in the new owned id lists
            setSaveError('');
        } catch (err) {
            setSaveError(err.message);
        }
    };

    // one Add/Remove button, shared by both lists
    const itemButton = (kind, itemId, owned) => (
        owned ? (
            <>
                <form className={styles.shopForm} onSubmit={(e) => { e.preventDefault(); changeItem(kind, itemId, 'remove'); }}>
                    <button type="submit" className={styles.shopBtn}>Remove</button>
                </form>
            </>
        ) : (
            <form className={styles.shopForm} onSubmit={(e) => { e.preventDefault(); changeItem(kind, itemId, 'add'); }}>
                <button type="submit" className={styles.shopBtn}>Add</button>
            </form>
        )
    );

    if (loading) return <Loader />;
    if (error) return <p>Failure is upon us: {error}</p>;

    const { armor, weapons, items = [], ownedArmorIds, ownedWeaponIds, ownedItemIds = [] } = data;
    // filter options come from the data; group order follows the server's category/subtype sort
    const itemTypes = [...new Set(items.map(itemGroupLabel))];
    const itemRarities = [...new Set(items.map((it) => it.rarity))].sort((a, b) => rank(ITEM_RARITIES, a) - rank(ITEM_RARITIES, b));
    const setItem = (key) => (e) => setItemFilter({ ...itemFilter, [key]: e.target.value });
    const shownItems = items
        .filter((it) => (!itemFilter.category || itemGroupLabel(it) === itemFilter.category) && (!itemFilter.rarity || it.rarity === itemFilter.rarity))
        .sort((a, b) => itemTypes.indexOf(itemGroupLabel(a)) - itemTypes.indexOf(itemGroupLabel(b))
            || (itemFilter.sort === 'rarity' ? rank(ITEM_RARITIES, a.rarity) - rank(ITEM_RARITIES, b.rarity) : 0)
            || a.name.localeCompare(b.name));
    // group consecutive rows under one heading
    const itemGroups = [];
    shownItems.forEach((it) => {
        const label = itemGroupLabel(it);
        const last = itemGroups[itemGroups.length - 1];
        if (last && last[0] === label) last[1].push(it); else itemGroups.push([label, [it]]);
    });

    // details popup: shared with the Inventory tab (read-only here: shop rows aren't owned yet)
    const itemDetails = openItem && <ItemDetails item={openItem} onClose={() => setOpenItem(null)} typeLabel={itemGroupLabel} />;

    return (
        <>
            <section>
                <h3 className={styles.shopTitle}>Item Shop</h3>
                <button type="button" className={styles.shopButton} onClick={onDone}>Done browsing</button>
                {saveError && <p>{saveError}</p>}
            </section>
            
            <section className={`${styles.panelShell} ${styles.itemShop}`}>
            <TabList tabs={TABS} active={tab} onChange={setTab} prefix="inv-" />

            <article role="tabpanel" id="inv-panel-armor" className={styles.actionContainer} aria-labelledby="inv-tab-armor" hidden={tab !== 'armor'}>
                <h3 className={styles.actionTitle}>Armor</h3>
                <ArmorFilter value={armorFilter} onChange={setArmorFilter} className={styles.filterContainer} selectClassName={styles.field} />
                <ul className={styles.actionSet}>
                    {filterSortArmor(armor, armorFilter).map((a) => (
                        <li key={a.id} className={styles.actionItem}>
                            <button type="button" className={styles.captionBtn} onClick={() => setOpenItem({ kind: 'armor', data: a })}>{a.name}</button>
                            {itemButton('armor', a.id, ownedArmorIds.includes(Number(a.id)))}
                        </li>
                    ))}
                </ul>
            </article>

            <article role="tabpanel" id="inv-panel-weapons" className={styles.actionContainer} aria-labelledby="inv-tab-weapons" hidden={tab !== 'weapons'}>
                <h3 className={styles.actionTitle}>Weapons</h3>
                <WeaponFilter value={weaponFilter} onChange={setWeaponFilter} className={styles.filterContainer} selectClassName={styles.field} />
                <ul className={styles.actionSet}>
                    {filterSortWeapons(weapons, weaponFilter).map((w) => (
                        <li key={w.id} className={styles.actionItem}>
                            <button type="button" className={styles.captionBtn} onClick={() => setOpenItem({ kind: 'weapon', data: w })}>{w.name}</button>
                            {itemButton('weapon', w.id, ownedWeaponIds.includes(Number(w.id)))}
                        </li>
                    ))}
                </ul>
            </article>

            <article role="tabpanel" id="inv-panel-items" className={styles.actionContainer} aria-labelledby="inv-tab-items" hidden={tab !== 'items'}>
                <h3 className={styles.actionTitle}>Items</h3>
                <div className={styles.filterContainer}>
                    <select className={styles.field} aria-label="Item type" value={itemFilter.category} onChange={setItem('category')}>
                        <option value="">All types</option>
                        {itemTypes.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className={styles.field} aria-label="Rarity" value={itemFilter.rarity} onChange={setItem('rarity')}>
                        <option value="">All rarities</option>
                        {itemRarities.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select className={styles.field} aria-label="Sort items" value={itemFilter.sort} onChange={setItem('sort')}>
                        <option value="name">Sort: Name</option>
                        <option value="rarity">Sort: Rarity</option>
                    </select>
                </div>
                {itemGroups.map(([group, list]) => (
                    <section key={group}>
                        <h3 className={styles.actionTitle}>{group}</h3>
                        <ul className={styles.actionSet}>
                            {list.map((it) => (
                                <li key={it.id} className={styles.actionItem}>
                                    <button type="button" className={styles.captionBtn} onClick={() => setOpenItem({ kind: 'item', data: it })}>{it.name}</button>
                                    {itemButton('item', it.id, ownedItemIds.includes(Number(it.id)))}
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </article>
            </section>
            {itemDetails}
        </>
    );
}

export default ItemShop;