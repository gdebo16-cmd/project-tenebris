import { Link, useMatch } from 'react-router';
import { useCampaign } from '../queries.ts';
import { useMonsterSheet } from '../features/sheet/monsterQueries.ts';
import styles from './Sidebar.module.css';

// The "this tale" part of the sidebar: on a campaign's pages (/campaign/5, /campaign/5/dm)
// and on a monster sheet (/monsters/9, which belongs to a campaign). The DM also gets the DM page.
export default function SidebarCampaign() {
    const campaign = useMatch('/campaign/:campId/*');
    const monster = useMatch('/monsters/:id');
    const campId = campaign?.params.campId;
    const monsterId = monster?.params.id;
    if (campId && /^\d+$/.test(campId)) return <CampaignLinks campId={campId} />;
    if (monsterId && /^\d+$/.test(monsterId)) return <MonsterCampaign id={monsterId} />;
    return null;
}

// A monster sheet: only the DM gets the full sheet, and it says which campaign the monster is in
function MonsterCampaign({ id }) {
    const sheet = useMonsterSheet(id);
    const campId = sheet.data && 'creature' in sheet.data ? sheet.data.creature.monster?.campaignId : undefined;
    return campId ? <CampaignLinks campId={String(campId)} /> : null;
}

function CampaignLinks({ campId }) {
    const camp = useCampaign(campId);
    const info = camp.data?.campaign;
    if (!info) return null;
    return (
        <>
            <h3 className={styles.groupTitle}>{info.name}</h3>
            <Link className={styles.link} to={`/campaign/${campId}`}>Tale page</Link>
            {info.role === 'dm' && <Link className={styles.link} to={`/campaign/${campId}/dm`}>DM page</Link>}
        </>
    );
}
