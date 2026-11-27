import { WEAPON_CATEGORIES, RARITIES } from '../../utils/weapons';

// Category / rarity filters and a sort picker for any weapon list. value = { category, rarity, sort }.
// The parent styles it: className goes on the wrapper, selectClassName on each select.
function WeaponFilter({ value, onChange, showRarity = true, className, selectClassName }) {
    const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
    return (
        <div className={className}>
            <select className={selectClassName} aria-label="Weapon category" value={value.category} onChange={set('category')}>
                <option value="">All categories</option>
                {WEAPON_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {showRarity && (
                <select className={selectClassName} aria-label="Rarity" value={value.rarity} onChange={set('rarity')}>
                    <option value="">All rarities</option>
                    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
            )}
            <select className={selectClassName} aria-label="Sort weapons" value={value.sort} onChange={set('sort')}>
                <option value="name">Sort: Name</option>
                <option value="category">Sort: Category</option>
                {showRarity && <option value="rarity">Sort: Rarity</option>}
            </select>
        </div>
    );
}

export default WeaponFilter;
