// One page for a new character and for editing one. The header is always visible; the tab is in the URL.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../api.ts';
import Loader from '../../components/ui/Loader.jsx';
import styles from '../../styles/features/character-form/CharacterForm.module.css';
import FormHeader from '../../components/character-form/FormHeader.tsx';
import FormTabs, { isFormTab, type FormTabId } from '../../components/character-form/FormTabs.tsx';
import { useCharacterForm, useCreateCharacter, useSaveTab } from './queries.ts';
import SpeciesTab from '../../components/character-form/tabs/SpeciesTab.tsx';
import RoleTab from '../../components/character-form/tabs/RoleTab.tsx';
import TraitsTab from '../../components/character-form/tabs/TraitsTab.tsx';
import PersonalityTab from '../../components/character-form/tabs/PersonalityTab.tsx';
import GearTab from '../../components/character-form/tabs/GearTab.tsx';

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

    if (!id) {
        return (
            <div className={styles.page}>
                <p className={styles.back}><Link to="/home">Back to home</Link></p>
                <h1 className={styles.title}>New character</h1>
                <NewCharacter tab={tab} />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <p className={styles.back}><Link to="/home">Back to home</Link></p>
            <h1 className={styles.title}>Edit character</h1>
            <SavedHeader id={id} />
            <FormTabs active={tab} onSelect={selectTab} />
            <div className={styles.panel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === 'species' && <SpeciesTab id={id} />}
                {tab === 'role' && <RoleTab id={id} />}
                {tab === 'traits' && <TraitsTab id={id} />}
                {tab === 'personality' && <PersonalityTab id={id} />}
                {tab === 'gear' && <GearTab id={id} />}
            </div>
        </div>
    );
}

// /characters/new: makes the draft straight away (no name yet: the server calls it "One with no name"),
// then opens its edit page on the requested tab. The ref stops StrictMode's second effect run from
// making a second draft.
function NewCharacter({ tab }: { tab: FormTabId }) {
    const navigate = useNavigate();
    const create = useCreateCharacter();
    const started = useRef(false);
    const [error, setError] = useState('');

    async function start() {
        setError('');
        try {
            const created = await create.mutateAsync({ name: '', level: 1, portrait_url: null });
            navigate(`/characters/${created.id}/edit?tab=${tab}`, { replace: true });
        } catch (err) {
            setError(messageOf(err));
        }
    }

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (error) {
        return (
            <div role="alert">
                <p className={styles.error}>Couldn't start a new character: {error}</p>
                <button type="button" className={styles.save} onClick={() => void start()} disabled={create.isPending}>Try again</button>
            </div>
        );
    }
    return <Loader text="Starting a new character…" />;
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

    // Saves on its own: the name when the box loses focus (or Enter), level and portrait as soon as they change.
    // Level and portrait pass the new value in, because the state hasn't updated yet when this runs.
    type HeaderChange = { name?: string; level?: string; portrait_url?: string | null };
    async function save(change: HeaderChange = {}) {
        const next = {
            name: change.name ?? name,
            level: Number(change.level ?? level),
            portrait_url: change.portrait_url !== undefined ? change.portrait_url : portraitUrl,
        };
        const saved = form.data?.header;
        if (saved && next.name === (saved.name ?? '') && next.level === saved.level && next.portrait_url === saved.portrait_url) return;
        setError('');
        try {
            await saveTab.mutateAsync(next);
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
            savedLevel={form.data.header.level}
            portraitUrl={portraitUrl}
            summary={summary}
            saving={saveTab.isPending}
            error={error}
            onName={setName}
            onLevel={(next) => { setLevel(next); void save({ level: next }); }}
            onPortrait={(next) => { setPortraitUrl(next); void save({ portrait_url: next }); }}
            onSave={() => void save()}
        />
    );
}

function messageOf(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}
