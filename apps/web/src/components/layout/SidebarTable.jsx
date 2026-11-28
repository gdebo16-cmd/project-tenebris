import { Link, useMatch } from 'react-router';
import { useCampaign } from '../../queries.ts';
import styles from '../../styles/components/layout/Sidebar.module.css';

// The "table" part of the sidebar: only on the table, map editor and dice pages (/campaign/5/table, /maps, /dice).
export default function SidebarTable() {
    const table = useMatch('/campaign/:campId/table');
    const maps = useMatch('/campaign/:campId/maps/*');
    const dice = useMatch('/campaign/:campId/dice');
    const campId = (table || maps || dice)?.params.campId;
    if (!campId || !/^\d+$/.test(campId)) return null;
    return <TableLinks campId={campId} />;
}

function TableLinks({ campId }) {
    const camp = useCampaign(campId);
    const isDm = camp.data?.campaign?.role === 'dm';
    return (
        <>
            <h3 className={styles.group}>Table</h3>
            <Link className={styles.link} to={`/campaign/${campId}/table`}>Table</Link>
            {isDm && <Link className={styles.link} to={`/campaign/${campId}/maps`}>Map editor</Link>}
            <Link className={styles.link} to={`/campaign/${campId}/dice`}>Dice lab</Link>
        </>
    );
}