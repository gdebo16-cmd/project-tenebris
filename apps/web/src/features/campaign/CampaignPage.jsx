import {Link, useParams} from 'react-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import { keys, useCampaign, useCampaignMonsters, useHome, useMonsterCatalog } from '../../queries.ts';
import Loader from '../../components/ui/Loader';
import campaignImages from './campaignImages';
import styles from '../../styles/features/campaign/CampaignPage.module.css';


function CampaignPage() {
    const {campId} = useParams();
    const queryClient = useQueryClient();
    const { data, isPending, error } = useCampaign(campId);
    const home = useHome(); // your characters, for the "Your character" picker
    const [picked, setPicked] = useState(null);
    const [campTab, setCampTab] = useState('campaign'); // which section shows on mobile
    const [editing, setEditing] = useState(false); // DM edit-campaign form
    const [form, setForm] = useState({ name: '', description: '', campaign_img_url: null });
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState('');
    const [copied, setCopied] = useState(false);
    const isDm = data?.campaign?.role === 'dm';
    const monsters = useCampaignMonsters(campId, isDm); // DM only: nothing is requested for players
    const catalog = useMonsterCatalog(isDm);
    const [pickMonster, setPickMonster] = useState('');

    // Every tab section gets "container" (phones hide the ones that aren't chosen), its own class,
    // and isActive when it's the chosen tab
    const tabClass = (name, own) => [styles.container, own, campTab === name && styles.isActive].filter(Boolean).join(' ');

    if (error) return <p className={styles.page}>Failure is upon us: {error.message}</p>;
    if (isPending) return <Loader className={styles.page} text='Summoning your stories...'/>;

    const {campaign, members} = data;
    
    const characters = home.data?.characters ?? [];
    const selectedId = picked ?? campaign.character_id ?? '';
    const chooseCharacter = async (e) => {
        const id = Number(e.target.value);
        setPicked(id);
        await api(`/api/campaigns/${campId}/character`, { method: 'PUT', body: { characterId: id } });
        queryClient.invalidateQueries({ queryKey: keys.campaign(campId) }); // refresh the members list
    };

    const startEdit = () => {
        setForm({ name: campaign.name ?? '', description: campaign.description ?? '', campaign_img_url: campaign.campaign_img_url ?? null });
        setEditError('');
        setEditing(true);
    };
    const saveEdit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { setEditError('Campaign name is required.'); return; }
        setSaving(true);
        setEditError('');
        try {
            const body = { name: form.name.trim(), description: form.description, campaign_img_url: form.campaign_img_url };
            await api(`/api/campaigns/${campId}`, { method: 'PATCH', body });
            queryClient.invalidateQueries({ queryKey: keys.campaign(campId) });
            queryClient.invalidateQueries({ queryKey: keys.campaigns });
            queryClient.invalidateQueries({ queryKey: keys.home });
            setEditing(false);
        } catch (err) {
            setEditError(err.message || 'Could not save the campaign.');
        } finally {
            setSaving(false);
        }
    };

    const shareInvite = async () => {
        const url = `${window.location.origin}/join/${campaign.invite_code}`;
        if (navigator.share) {
          try {
            await navigator.share({ title: campaign.name, text: `Join my campaign "${campaign.name}"`, url });
          } catch { /* they closed the share menu */ }
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          window.prompt('Copy this link:', url);
        }
      };

      const addMonster = async () => {
        if (!pickMonster) return;
        try {
            await api(`/api/campaigns/${campId}/monsters`, { method: 'POST', body: { monster_id: Number(pickMonster) } });
            queryClient.invalidateQueries({ queryKey: keys.campaignMonsters(campId) });
            setPickMonster('');
        } catch (err) {
            alert(`Could not add that monster: ${err.message}`);
        }
    };

    return (
        <>
            <header id={styles.siteTitle}>
                <img src="/Logo.png" alt="Eldrid Tales Logo" className={styles.titleLogo} />
                <h1>Campaign</h1>
            </header>
            <main className={styles.page}>
                <nav className={styles.homeTabs}>
                    <button type="button" className={campTab === 'campaign' ? `${styles.homeTab} ${styles.isActive}` : styles.homeTab} onClick={() => setCampTab('campaign')}>Campaign</button>
                    <button type="button" className={campTab === 'invite' ? `${styles.homeTab} ${styles.isActive}` : styles.homeTab} onClick={() => setCampTab('invite')}>Invite / Join</button>
                    <button type="button" className={campTab === 'players' ? `${styles.homeTab} ${styles.isActive}` : styles.homeTab} onClick={() => setCampTab('players')}>Current Players</button>
                    {isDm && (
                    <button type="button" className={campTab === 'monsters' ? `${styles.homeTab} ${styles.isActive}` : styles.homeTab} onClick={() => setCampTab('monsters')}>Monsters</button>
                    )}
                </nav>
                <section className={tabClass('campaign', styles.campaignTile)}>
                    {editing ? (
                    <>
                        <div className={styles.editContainer}>
                            <article className={styles.editTitle}>
                                <h2><strong>Edit Tale</strong></h2>
                            </article>
                            
                            <form onSubmit={saveEdit}>
                                <div className={styles.editTitleInputContainer}>
                                    <label className={styles.editLabel} htmlFor="camp-edit-name">Title</label>
                                    <input id="camp-edit-name" className={styles.editTitleInput} type="text" maxLength={120} value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div className={styles.descriptionEdit}>
                                    <label className={styles.editLabel} htmlFor="camp-edit-desc">Description</label>
                                    <textarea id="camp-edit-desc" className={styles.editDescriptionInput} rows={5} value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })} />
                                </div>
                                
                                <div className={styles.editActions}>
                                    <button type="submit" className={styles.actionButton} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                                    <button type="button" className={styles.actionButton} disabled={saving} onClick={() => setEditing(false)}>Return</button>
                                </div>
                                <div>
                                    <div className={styles.imageGrid}>
                                        {campaignImages.map((img) => (
                                            <button type="button" key={img.url} title={img.label}
                                                className={form.campaign_img_url === img.url ? `${styles.imageChoice} ${styles.isSelected}` : styles.imageChoice}
                                                onClick={() => setForm({ ...form, campaign_img_url: img.url })}>
                                                <img className={styles.imageSelect} src={img.url} alt={img.label} loading="lazy" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {editError && <p role="alert">{editError}</p>}
                            </form>    
                        </div>
                    </>    
                    ) : (
                        <>
                            <h2 className={styles.titleEdit}><strong>{campaign.name}</strong></h2>
                            <div className={styles.imageCampaignContainer}>
                                {campaign.campaign_img_url
                                    ? <img className={styles.imageCampaign} src={campaign.campaign_img_url} alt={`${campaign.name} picture`} />
                                    : <div className={styles.imageCampaign} role="img" aria-label={`${campaign.name} picture`} />}
                                <div className={styles.descriptionEdit}>
                                    <div>
                                        <p className={styles.editLabel}>Description</p>
                                        <p className={styles.editInputDisplay}>{campaign.description || 'No description yet.'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.campaignActionsContainer}>
                                {campaign.role === 'dm' && (
                                    <div className={styles.campaignActionsDM}>
                                        <button type="button" className={styles.campaignActionRealButton} onClick={startEdit}>Edit Tale</button>
                                        <Link className={styles.campaignActionButton} to={`/campaign/${campId}/dm`}>DM page</Link>
                                    </div>
                                    
                                )}
                                <div className={styles.campaignActionsPlayer}>
                                    <Link className={styles.campaignActionButton} to={`/campaign/${campId}/table`}>Play Session</Link>
                                    {campaign.role === 'dm' && <Link className={styles.campaignActionButton} to={`/campaign/${campId}/maps`}>Map Editor</Link>}
                                </div>
                            </div>
                        </>
                    )}
                </section>
                <section className={tabClass('invite', styles.inviteContainer)}>
                    <article className={styles.inviteTile}>
                        <h2 className={styles.campaignTitle}><strong>Invite / Join</strong></h2>
                        {campaign.role === 'dm' && (
                            <div className={styles.inviteSet}>
                                <p className={styles.inviteLabel}>Invite code</p>
                                <p className={styles.inviteCode}>{campaign.invite_code}</p>
                                <button type="button" className={styles.shareButton} onClick={shareInvite}>
                                    {copied ? 'Copied!' : 'Share invite link'}
                                </button>
                            </div>
                        )}
                            <div className={styles.inviteSet}>
                                <label className={styles.inviteLabel2} htmlFor="camp-character">Your character</label>
                                <select id="camp-character" className={styles.inviteSelect} value={selectedId} onChange={chooseCharacter}>
                                    <option value="" disabled>Choose a character</option>
                                    {characters.map((ch) => (
                                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                                    ))}
                                </select>
                            </div>
                    </article>
                </section>
                <section className={tabClass('players', styles.playerContainer)}>
                    <h2 className={styles.playersTitle}><strong>Current Players</strong></h2>
                    <ul className={styles.playersList}>
                        {members.map((mem) => (
                            <li className={styles.playerTile} key={mem.username}>
                                <span className={styles.playerName}>{mem.username}</span>
                                <span className={mem.role === 'dm' ? `${styles.playerRole} ${styles.roleDm}` : styles.playerRole}>{mem.role === 'dm' ? 'DM' : 'Player'}</span>
                                {/* players never see the DM's character status; the DM sees everything */}
                                {!(mem.role === 'dm' && campaign.role !== 'dm') && <span className={styles.playerCharacter}>
                                    {mem.character_name
                                        ? (campaign.role === 'dm'
                                            ? <Link to={`/characters/${mem.character_id}`}>{mem.character_name}</Link>
                                            : mem.character_name)
                                        : (mem.role === 'dm' ? null : <em>No character yet</em>)}
                                </span>}
                            </li>
                        ))}
                    </ul>
                </section>
                {isDm && (
                <section className={tabClass('monsters', styles.monstersContainer)}>
                    <article>
                        <h2 className={styles.monstersTitle}><strong>Monsters</strong></h2>
                    </article>
                    <article className={styles.monstersBody}>
                        <div className={styles.monsterPick}>
                        <select className={styles.monsterSelect} value={pickMonster} onChange={(e) => setPickMonster(e.target.value)}>
                            <option value="">Choose a monster…</option>
                                {(catalog.data || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <button type="button" className={styles.monstersButton} onClick={addMonster} disabled={!pickMonster}>Add Monster</button>
                        </div>
                        <ul className={styles.monsterList}>
                            {(monsters.data || []).map((m) => (
                                <li key={m.id} className={styles.monsterRow}>
                                    <Link className={styles.monsterLink} to={`/monsters/${m.id}`}>{m.name}</Link>
                                </li>
                            ))}
                        </ul>
                        {monsters.data?.length === 0 && <p className={styles.monsterEmpty}>No monsters yet.</p>}
                    </article>
                </section>
                )}
            </main>
            <footer>
            </footer>
        </>
    );
}

export default CampaignPage;
