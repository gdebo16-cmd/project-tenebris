// Role, calling (from level 3), skills and the role's create-time picks. The server checks the save.
import { useEffect, useState } from 'react';
import { CALLING_LEVEL } from '@tenebris/rules/characterOptions';
import { ApiError } from '../../../api.ts';
import formStyles from '../CharacterForm.module.css';
import styles from './RoleTab.module.css';
import { useCharacterForm, useCharacterOptions, useSaveTab } from '../queries.ts';
import type { Options } from '@tenebris/rules/characterForm';

type RoleChoice = Options['roles'][number];
type FeatureChoice = Options['features'][number];
type CallingChoice = Options['callings'][number];

function runeThumb(key: string): string {
    return `/glyphs/classes/thumbs/${key}.webp`;
}
function runeFull(key: string): string {
    return `/glyphs/classes/${key}.png`;
}

type Props = { id: string };

export default function RoleTab({ id }: Props) {
    return <RoleFields id={id} />;
}

function RoleFields({ id }: { id: string }) {
    const form = useCharacterForm(id);
    const save = useSaveTab(id, 'role');
    const [roleId, setRoleId] = useState('');
    const [callingId, setCallingId] = useState('');
    const [skills, setSkills] = useState<string[]>([]);
    const [picks, setPicks] = useState<Record<string, string[]>>({});
    const [artOpen, setArtOpen] = useState(false);
    const [roleGuideOpen, setRoleGuideOpen] = useState(false);
    const [callingGuideOpen, setCallingGuideOpen] = useState(false);
    const [filled, setFilled] = useState(false);
    const [error, setError] = useState('');

    const level = form.data?.header.level ?? 1;
    // Ask again as the player changes role or calling, so the skill list and pickers match this save.
    const live = useCharacterOptions({
        level,
        role_id: roleId ? Number(roleId) : undefined,
        calling_id: callingId ? Number(callingId) : undefined,
    });

    useEffect(() => {
        if (!form.data || filled) return;
        const saved = form.data.role;
        const fixed = form.data.options.skills?.fixed ?? [];
        setRoleId(saved.role_id == null ? '' : String(saved.role_id));
        setCallingId(saved.calling_id == null ? '' : String(saved.calling_id));
        setSkills((saved.skill_proficiencies ?? []).filter((skill) => !fixed.includes(skill)));
        setPicks(saved.feature_choices ?? {});
        setFilled(true);
    }, [form.data, filled]);

    // The header save clears a calling once the level drops below 3. Hide it here too.
    useEffect(() => {
        if (level < CALLING_LEVEL) {
            setCallingId('');
            setCallingGuideOpen(false);
        }
    }, [level]);

    if (form.error) return <p className={formStyles.error} role="alert">{messageOf(form.error)}</p>;
    if (form.isPending || !form.data) return null;

    const options = roleId && live.data ? live.data : form.data.options;
    const role = options.roles.find((item) => String(item.id) === roleId) ?? null;

    function pickRole(next: RoleChoice) {
        setRoleId(String(next.id));
        setCallingId('');
        setSkills([]);
        setPicks({});
        setArtOpen(false);
        setRoleGuideOpen(false);
        setCallingGuideOpen(false);
        setError('');
    }

    function pickCalling(next: CallingChoice) {
        setCallingId(String(next.id));
        setSkills([]);
        setPicks((current) => dropCallingPicks(current))
        setCallingGuideOpen(false);
        setError('');
    }

    function toggleSkill(name: string) {
        setSkills((current) => current.includes(name) ? current.filter((skill) => skill !== name) : [...current, name]);
    }

    function togglePick(feature: FeatureChoice, option: string) {
        setPicks((current) => {
            const chosen = current[feature.key] ?? [];
            if (chosen.includes(option)) return { ...current, [feature.key]: chosen.filter((item) => item !== option) };
            if (chosen.length >= feature.choose) return current;
            return { ...current, [feature.key]: [...chosen, option] };
        });
    }

    async function onSave() {
        setError('');
        try {
            await save.mutateAsync({
                role_id: Number(roleId),
                calling_id: callingId ? Number(callingId) : null,
                skills,
                feature_choices: picks,
            });
        } catch (err) {
            setError(messageOf(err));
        }
    }

    const skillRule = options.skills;
    const chosenCount = skills.length;

    return (
        <form className={styles.role} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <div className={styles.roleContainer}>
            <span className={styles.roletitle}>Role</span>
            {role && (
                <div className={styles.picked}>
                    <button type="button" className={styles.artButton} aria-expanded={artOpen} aria-label={artOpen ? 'Hide the full rune' : 'Show the full rune'} onClick={() => setArtOpen((open) => !open)}>
                        <img className={artOpen ? styles.fullArt : styles.thumb} src={artOpen ? runeFull(role.key) : runeThumb(role.key)} alt="" />
                    </button>
                    <div>
                        <p className={styles.meta}>{role.name}</p>
                        <p className={styles.meta}>Hit die {role.hit_die}</p>
                        <p className={styles.meta}>Primary stat {role.primary_stat}</p>
                    </div>
                </div>
            )}
            {role && (
                <>
                    <button type="button" className={roleGuideOpen ? styles.guideOpen : styles.guideButton} aria-expanded={roleGuideOpen} aria-controls="role-guide" onClick={() => setRoleGuideOpen((open) => !open)}>
                        Learn about your role
                    </button>
                    {roleGuideOpen && <GuideList id="role-guide" guide={options.roleGuide} level={level} empty="This role has no features listed yet." />}
                </>
            )}
            
            <ul className={styles.list}>
                {options.roles.map((item) => {
                    const selected = String(item.id) === roleId;
                    return (
                        <li className={styles.roleTile} key={item.id}>
                            <button type="button" className={selected ? styles.roleSelected : styles.roleButton} aria-pressed={selected} onClick={() => pickRole(item)}>
                                <img className={styles.icon} src={runeThumb(item.key)} alt="" />
                                <div className={styles.roleInfo}>
                                    <p className={styles.roleName}>{item.name}</p>
                                    <p className={styles.roleHitDie}>Hit die: {item.hit_die}</p>
                                    <p className={styles.rolePrimaryStat}>Primary stat: {item.primary_stat}</p>
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
            </div>
            <div className={styles.choicesContainer}>
                <div className={styles.callingContainer}>
                    <span className={styles.callingTitle}>Calling</span>                  
                    <ul className={styles.CallList}>
                        {options.callings.map((call) => {
                            const selected = String(call.id) === callingId;
                            return (
                            <li className={styles.callTile} key={call.id}>
                                <button type="button" className={selected ? styles.callSelected : styles.callButton} aria-pressed={selected} onClick={() => pickCalling(call)}>
                                    <p className={styles.callName}>{call.name}</p>
                                </button>
                                </li>
                                );
                            })}
                    </ul>
                    {callingId && (
                        <>
                            <button type="button" className={callingGuideOpen ? styles.guideOpen : styles.guideButton} aria-expanded={callingGuideOpen} aria-controls="calling-guide" onClick={() => setCallingGuideOpen((open) => !open)}>
                                Learn about your calling
                            </button>
                            {callingGuideOpen && <GuideList id="calling-guide" guide={options.callingGuide} level={level} empty="This calling has no features listed yet." />}
                        </>
                    )}
                </div>
                <div className={styles.skillsContainer}>
                    <span className={styles.skillsTitle}>Skills</span>
                    <p className={styles.heading}>Choose {skillRule?.choose} · {chosenCount} chosen</p>
                    {skillRule && (
                        <ul className={styles.skillList}>
                            
                            {skillRule.fixed.map((name) => (
                                <li key={name} className={styles.skillTile}>
                                    <p className={styles.skillName}>{name}</p>
                                </li>
                            ))}
                            {skillRule.from.map((name) => {
                                const on = skills.includes(name);
                                const full = !on && chosenCount >= skillRule.choose;
                                return (
                                    <li key={name} className={full ? styles.skillTileDisabled : styles.skillTile}>
                                        <button type="button" className={full ? styles.skillButtonDisabled : on ? styles.skillSelected : styles.skillButton} disabled={full} aria-pressed={on} onClick={() => toggleSkill(name)}>
                                            <p className={styles.skillName}>{name}</p>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        )}
                    </div>

                <div className={styles.featuresContainer}>
                    <span className={styles.featuresTitle}>Features</span>
                    {options.features.map((feature) => {
                        const chosen = picks[feature.key] ?? [];
                        return (
                            <fieldset key={feature.key} className={styles.choices}>
                                <legend className={styles.heading}>{feature.name}: choose {feature.choose} · {chosen.length} chosen</legend>
                                {feature.options.map((option) => {
                                    const on = chosen.includes(option);
                                    return (
                                        <label key={option} className={styles.choice}>
                                            <input type="checkbox" checked={on} disabled={!on && chosen.length >= feature.choose} onChange={() => togglePick(feature, option)} />
                                            {option}
                                        </label>
                                    );
                                })}
                            </fieldset>
                        );
                    })}
                </div>
            </div>
            <div className={styles.buttonsContainer}>
                <button type="submit" className={styles.save} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
                {error && <p className={formStyles.error} role="alert">{error}</p>}
            </div>
        </form>
    );
}


type FeatureGuide = Options['roleGuide'];

function GuideList({ id, guide, level, empty }: { id: string; guide: FeatureGuide; level: number; empty: string }) {
    if (!guide || guide.levels.length === 0) {
        return <div id={id} className={styles.guidePanel}><p className={styles.guideEmpty}>{empty}</p></div>;
    }
    return (
        <div id={id} className={styles.guidePanel}>
            {guide.description && <p className={styles.guideBlurb}>{guide.description}</p>}
            <ol className={styles.guideList}>
                {guide.levels.map((step) => (
                    <li key={step.level} className={step.level <= level ? styles.guideLevelReached : styles.guideLevel}>
                        <p className={styles.guideLevelLabel}>Level {step.level}</p>
                        {step.features.map((feature, index) => (
                            <div key={`${feature.name}-${index}`} className={styles.guideFeature}>
                                <p className={styles.guideFeatureName}>{feature.name}</p>
                                {feature.description ? <p className={styles.guideFeatureText}>{feature.description}</p> : null}
                            </div>
                        ))}
                    </li>
                ))}
            </ol>
        </div>
    );
}

function dropCallingPicks(picks: Record<string, string[]>): Record<string, string[]> {
    const next: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(picks)) {
        if (!key.startsWith('subclass:')) next[key] = values;
    }
    return next;
}

function messageOf(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}
