import { useState } from 'react'
import { SHAPE_FEATURE_KINDS, BOARD_MODELS } from '@tenebris/rules/board'
import { FEATURE_LOOK } from '../../board/models/BoardFeatures.tsx'
import { type Tool } from '../../../../features/table/hooks/tableTypes.ts'
import { type PanelProps } from '../../../../features/table/hooks/toolbarTypes.ts'
import { ToolButton } from '../parts/ToolButton.tsx'
import { ToggleButton } from '../parts/ToggleButton.tsx'
import { ButtonRow } from '../parts/ButtonRow.tsx'
import { Section } from '../parts/Section.tsx'
import { Field } from '../parts/Field.tsx'
import { ActionButton } from '../parts/ActionButton.tsx'
import { BrushRow, titled } from '../parts/ToolParts.tsx'
import styles from '../Toolbar.module.css'
import controls from '../TableControls.module.css'

function LibraryObjects({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
    const [query, setQuery] = useState('');
    const needle = query.trim().toLowerCase();
    const groups = new Map<string, typeof BOARD_MODELS[number][]>();
    for (const model of BOARD_MODELS) {
        if (needle && !`${model.name} ${model.category ?? ''}`.toLowerCase().includes(needle)) continue;
        const category = model.category ?? 'props';
        const list = groups.get(category) ?? [];
        list.push(model);
        groups.set(category, list);
    }
    const size = tool.type === 'feature' ? tool.size : 1;
    const color = tool.type === 'feature' ? tool.color : '#ffd08a';
    return (
        <>
            <h3 className={styles.sectionTitle}>Library</h3>
            <ButtonRow>
                <input className={controls.input} type="search" value={query} placeholder="Search objects"
                    aria-label="Search objects" onChange={(e) => setQuery(e.target.value)} />
            </ButtonRow>
            <div className={styles.objectList}>
                {[...groups.entries()].map(([category, models]) => (
                    <div key={category}>
                        <h3 className={styles.sectionTitle}>{titled(category)}</h3>
                        <ButtonRow>
                            {models.map((model) => (
                                <ToggleButton key={model.id}
                                    pressed={tool.type === 'feature' && tool.kind === 'model' && tool.model === model.id}
                                    onClick={() => setTool({ type: 'feature', kind: 'model', model: model.id, size, color })}>
                                    {model.name}
                                </ToggleButton>
                            ))}
                        </ButtonRow>
                    </div>
                ))}
            </div>
        </>
    );
}

export function ObjectsPanel({ editing, data, tool, setTool, brush, setBrush, placing, setPlacing, summonName, setSummonName, summonOwner, setSummonOwner, selectedToken, onRemove }: PanelProps) {
    const featureSize = tool.type === 'feature' ? tool.size : 1;
    const featureColor = tool.type === 'feature' ? tool.color : '#ffd08a';
    return (
        <Section id="board-tab-panel-objects" labelledBy="board-tab-objects">
            {editing && (
                <>
                    <h3 className={styles.sectionTitle}>Features</h3>
                    <ButtonRow>
                        {SHAPE_FEATURE_KINDS.map((k) => (
                            <ToggleButton key={k} pressed={tool.type === 'feature' && tool.kind === k}
                                onClick={() => setTool({ type: 'feature', kind: k, size: featureSize, color: featureColor })}>{FEATURE_LOOK[k].label}</ToggleButton>
                        ))}
                        <ToggleButton pressed={tool.type === 'feature' && tool.kind === null}
                            onClick={() => setTool({ type: 'feature', kind: null, size: featureSize, color: featureColor })}>Remove</ToggleButton>
                        {tool.type === 'feature' && (
                            <Field label="Size">
                                <input className={styles.inputRange} type="range" min={0.5} max={2} step={0.1} value={tool.size}
                                    onChange={(e) => setTool({ ...tool, size: Number(e.target.value) })} />
                            </Field>
                        )}
                        {tool.type === 'feature' && tool.kind === 'light' && (
                            <Field label="Colour">
                                <input className={styles.inputColor} type="color" value={tool.color} onChange={(e) => setTool({ ...tool, color: e.target.value })} />
                            </Field>
                        )}
                    </ButtonRow>
                    {tool.type === 'feature' && (
                        <BrushRow brush={brush} setBrush={setBrush} />
                    )}
                    <LibraryObjects tool={tool} setTool={setTool} />
                </>
            )}
            <h3 className={styles.sectionTitle}>Place</h3>
            <ButtonRow>
                <ToolButton label="Place" t={{ type: 'place' }} tool={tool} setTool={setTool} />
                {tool.type === 'place' && (
                    <>
                        <select className={controls.select} value={placing} aria-label="What to place" onChange={(e) => setPlacing(e.target.value)}>
                            <option className={controls.option} value="">Choose…</option>
                            <optgroup label="Party">
                                {data?.placeable?.party.map((p) => <option className={controls.option} key={p.characterId} value={`character:${p.characterId}`}>{p.name} ({p.username})</option>)}
                            </optgroup>
                            <optgroup label="Monsters">
                                {data?.placeable?.monsters.map((m) => <option className={controls.option} key={m.id} value={`monster:${m.id}`}>{m.name}</option>)}
                            </optgroup>
                            <option className={controls.option} value="summon">A summon or pet…</option>
                        </select>
                        {placing === 'summon' && (
                            <>
                                <input className={controls.input} type="text" maxLength={60} placeholder="Summon's name" aria-label="Summon's name"
                                    value={summonName} onChange={(e) => setSummonName(e.target.value)} />
                                <select className={controls.select} value={summonOwner} aria-label="Summon's owner" onChange={(e) => setSummonOwner(e.target.value)}>
                                    <option className={controls.option} value="">Owner: the DM</option>
                                    {data?.placeable?.party.map((p) => <option className={controls.option} key={p.ownerId} value={p.ownerId}>Owner: {p.username}</option>)}
                                </select>
                            </>
                        )}
                    </>
                )}
            </ButtonRow>
            {selectedToken && (
                <ButtonRow>
                    <ActionButton onClick={onRemove}>Remove {selectedToken.name}</ActionButton>
                </ButtonRow>
            )}
        </Section>
    );
}
