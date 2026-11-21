import { Link, useParams, useNavigate } from 'react-router';
import usePageStyle from '../hooks/usePageStyle';
import sheetCss from '../styles/charSheet.css?inline';
import sheetSubpageCss from '../styles/sheet-subpage.css?inline';
import ItemShop from '../features/inventory/ItemShop';

// Replaces views/inventory.ejs. The list itself lives in ItemShop.
function InventoryPage() {
    usePageStyle(sheetCss + sheetSubpageCss, 'subpage');
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <>
            <header>
                <h1 id="inventory-title">Inventory</h1>
                <p id="inventory-link"><Link to={`/characters/${id}`}>Back to character sheet</Link></p>
            </header>
            <main className="subpage-main">
                <ItemShop characterId={id} onDone={() => navigate(`/characters/${id}`)} />
            </main>
        </>
    );
}

export default InventoryPage;