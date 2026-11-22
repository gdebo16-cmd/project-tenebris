// Species, sub-species or variant, eyes, size and an optional look. The server checks the save.
import { useEffect, useState } from 'react';
import { ApiError } from '../../../api.ts';
import formStyles from '../CharacterForm.module.css';
import styles from './SpeciesTab.module.css';
import { useCharacterForm, useSaveTab } from '../queries.ts';

// A variant's own picture: igni + Ember -> /races/igni-ember.png (Art's files, all lowercase)
function variantImage(key: string, variant: string): string {
    return `/races/${key}-${variant.toLowerCase().replace(/\s+/g, '-')}.png`;
}

// /races/human.png -> /races/thumbs/human.webp. The list never loads the big PNG.
function thumbnail(image: string): string {
    return image.replace(/\/([^/]+)\.png$/, '/thumbs/$1.webp');
}

type Props = { id: string };

export default function SpeciesTab({ id }: Props) {
    return <SpeciesFields id={id} />;
}

function SpeciesFields({ id }: { id: string }) {
    const form = useCharacterForm(id);
    const save = useSaveTab(id, 'species');
    const [speciesId, setSpeciesId] = useState('');
    const [subspeciesId, setSubspeciesId] = useState('');
    const [variant, setVariant] = useState('');
    const [sizeId, setSizeId] = useState('');
    const [eyeColor, setEyeColor] = useState('');
    const [look, setLook] = useState('');
    const [artOpen, setArtOpen] = useState(false);
    const [brokenArt, setBrokenArt] = useState('');
    const [filled, setFilled] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!form.data || filled) return;
        const saved = form.data.species;
        setSpeciesId(saved.species_id == null ? '' : String(saved.species_id));
        setSubspeciesId(saved.subspecies_id == null ? '' : String(saved.subspecies_id));
        setVariant(saved.variant ?? '');
        setSizeId(saved.size_id == null ? '' : String(saved.size_id));
        setEyeColor(saved.eye_color ?? '');
        setLook(saved.look_description ?? '');
        setFilled(true);
    }, [form.data, filled]);

    if (form.isPending || !form.data) return null;
    if (form.error) return <p className={formStyles.error} role="alert">{messageOf(form.error)}</p>;

    const options = form.data.options;
    const species = options.species.find((item) => String(item.id) === speciesId) ?? null;
    const sub = species?.subspecies.find((item) => String(item.id) === subspeciesId) ?? null;
    // The sub-species or picked variant replaces the species picture. A variant with no file yet falls back.
    const variantArt = species && !sub && variant ? variantImage(species.key, variant) : null;
    const image = sub?.image ?? (variantArt && variantArt !== brokenArt ? variantArt : null) ?? species?.image ?? null;

    function pickSpecies(nextId: string) {
        setSpeciesId(nextId);
        setSubspeciesId('');
        setVariant('');
        setSizeId('');
        setArtOpen(false);
    }

    async function onSave() {
        setError('');
        try {
            await save.mutateAsync({
                species_id: Number(speciesId),
                subspecies_id: subspeciesId ? Number(subspeciesId) : null,
                size_id: Number(sizeId),
                variant: variant || null,
                eye_color: eyeColor,
                look_description: look,
            });
        } catch (err) {
            setError(messageOf(err));
        }
    }

    return (
        <form className={styles.species} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <div className={styles.artRow}>
            <label className={styles.art}>
                {image && (
                    <button
                        type="button"
                        className={styles.artButton}
                        aria-expanded={artOpen}
                        aria-label={artOpen ? 'Hide the full picture' : 'Show the full picture'}
                        onClick={() => setArtOpen((open) => !open)}
                    >
                        <img className={styles.fullArt} src={image} alt="" onError={() => { if (image === variantArt) setBrokenArt(image); }} />
                    </button>
                )}
                </label>
                <label className={styles.field}>
                    <span className={styles.label}>Species</span>
                    <select className={styles.select} aria-label="Species" value={speciesId} onChange={(event) => pickSpecies(event.target.value)}>
                        <option value="">Choose a species</option>
                        {options.species.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                    {species && species.subspecies.length > 0 && (
                        <Choice label="Sub-species" value={subspeciesId} onChange={(value) => { setSubspeciesId(value); setArtOpen(false); }} options={species.subspecies.map((item) => ({ value: String(item.id), label: item.name }))} />
                    )}
                    {species && species.subspecies.length === 0 && species.variants.length > 0 && (
                        <Choice label="Variant" value={variant} onChange={(value) => { setVariant(value); setArtOpen(false); }} options={species.variants.map((name) => ({ value: name, label: name }))} />
                    )}
                </label>

            </div>
            <div className={styles.lookRow}>
                {species && (
                    <div className={styles.field} role="group" aria-label="Size">
                        <span className={styles.label}>Size</span>
                        <div className={styles.sizeButtons}>
                            {species.sizes.map((item) => {
                                const on = String(item.id) === sizeId;
                                return (
                                    <button key={item.id} type="button" className={on ? styles.sizeSelected : styles.sizeButton} aria-pressed={on} onClick={() => setSizeId(String(item.id))}>
                                        {item.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                <Choice label="Eye color" value={eyeColor} onChange={setEyeColor} options={options.eyeColors.map((name) => ({ value: name, label: name }))} />
                <label className={styles.field}>
                    <span className={styles.label}>Look</span>
                    <textarea className={styles.look} aria-label="Look" value={look} onChange={(event) => setLook(event.target.value)} placeholder="Optional" />
                </label>
            </div>
            <div className={styles.saveRow}>
                <button type="submit" className={styles.save} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
                {error && <p className={formStyles.error} role="alert">{error}</p>}
            </div>
        </form>
    );
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
    return (
        <label className={styles.field}>
            <span className={styles.label}>{label}</span>
            <select className={styles.select} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
                <option value="">Choose</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        </label>
    );
}

function messageOf(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}
