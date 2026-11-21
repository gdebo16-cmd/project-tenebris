// One page for a new character and for editing one. The header is always visible; the tab is in the URL.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../api.ts';
import Loader from '../../components/Loader.jsx';
import styles from './CharacterForm.module.css';
import FormHeader from './FormHeader.tsx';
import FormTabs, { isFormTab, type FormTabId } from './FormTabs.tsx';
import { useCharacterForm, useCreateCharacter, useSaveTab } from './queries.ts';
import SpeciesTab from './tabs/SpeciesTab.tsx';
import RoleTab from './tabs/RoleTab.tsx';
import TraitsTab from './tabs/TraitsTab.tsx';
import PersonalityTab from './tabs/PersonalityTab.tsx';
import GearTab from './tabs/GearTab.tsx';

export default function CharacterForm() {
    const { id } = useParams();
    const [params, setParams] = useSearchParams();
    const requested = params.get('tab');
    const tab: FormTabId = isFormTab(requested) ? requested : 'species';

    function selectTab(next: FormTabId) {
        const nextParams = new URLSearchParams(params);
        nextParams.set('tab', next);
        setParams(nextParams, { replace: true });
    }

    return (
        <div className={styles.page}>
            <p className={styles.back}><Link to="/home">Back to home</Link></p>
            <h1 className={styles.title}>{id ? 'Edit character' : 'New character'}</h1>
            {id ? <SavedHeader id={id} /> : <NewHeader />}
            <FormTabs active={tab} onSelect={selectTab} />
            <div className={styles.panel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === 'species' && <SpeciesTab />}
                {tab === 'role' && <RoleTab />}
                {tab === 'traits' && <TraitsTab />}
                {tab === 'personality' && <PersonalityTab />}
                {tab === 'gear' && <GearTab />}
            </div>
        </div>
    );
}

// /characters/new — Save creates the draft, then opens the edit page on the species tab.
function NewHeader() {
    const navigate = useNavigate();
    const create = useCreateCharacter();
    const [name, setName] = useState('');
    const [level, setLevel] = useState('1');
    const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
    const [error, setError] = useState('');

    async function save() {
        setError('');
        try {
            const created = await create.mutateAsync({ name, level: Number(level), portrait_url: portraitUrl });
            navigate(`/characters/${created.id}/edit?tab=species`, { replace: true });
        } catch (err) {
            setError(messageOf(err));
        }
    }

    return (
        <FormHeader
            name={name}
            level={level}
            portraitUrl={portraitUrl}
            summary="Save the header to start the other tabs."
            saving={create.isPending}
            error={error}
            onName={setName}
            onLevel={setLevel}
            onPortrait={setPortraitUrl}
            onSave={save}
        />
    );
}

// /characters/:id/edit — the header loads from the server and saves back to it.
function SavedHeader({ id }: { id: string }) {
    const form = useCharacterForm(id);
    const saveTab = useSaveTab(id, 'header');
    const [name, setName] = useState('');
    const [level, setLevel] = useState('1');
    const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
    const [filled, setFilled] = useState(false);
    const [error, setError] = useState('');

    // Fill the boxes once, from the saved character. Later saves keep what the player just typed.
    useEffect(() => {
        if (!form.data || filled) return;
        setName(form.data.header.name ?? '');
        setLevel(String(form.data.header.level ?? 1));
        setPortraitUrl(form.data.header.portrait_url);
        setFilled(true);
    }, [form.data, filled]);

    async function save() {
        setError('');
        try {
            await saveTab.mutateAsync({ name, level: Number(level), portrait_url: portraitUrl });
        } catch (err) {
            setError(messageOf(err));
        }
    }

    if (form.isPending) return <Loader text="Opening the character…" />;
    if (form.error) return <p className={styles.error} role="alert">{messageOf(form.error)}</p>;

    const summary = form.data.is_draft ? 'Unfinished character' : 'Finished character';
    return (
        <FormHeader
            name={name}
            level={level}
            portraitUrl={portraitUrl}
            summary={summary}
            saving={saveTab.isPending}
            error={error}
            onName={setName}
            onLevel={setLevel}
            onPortrait={setPortraitUrl}
            onSave={save}
        />
    );
}

function messageOf(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}
