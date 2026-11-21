import { Link, useParams, useNavigate } from 'react-router';
import ItemShop from '../features/inventory/ItemShop';
import styles from './InventoryPage.module.css';

// Replaces views/inventory.ejs. The list itself lives in ItemShop.
function InventoryPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <>
            <header>
                <h1>Inventory</h1>
                <p><Link to={`/characters/${id}`}>Back to character sheet</Link></p>
            </header>
            <main className={styles.page}>
                <ItemShop characterId={id} onDone={() => navigate(`/characters/${id}`)} />
            </main>
        </>
    );
}

export default InventoryPage;