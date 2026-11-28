import { useState, type ReactNode } from 'react'
import { type SceneLook, SCENE_MOODS, SCENE_WEATHERS, BOARD_STYLES, styleOf, GRID_MODES, gridOf } from '@tenebris/rules/board'
import { type PanelProps } from '../../../../features/table/hooks/toolbarTypes.ts'
import { ToggleButton } from '../parts/ToggleButton.tsx'
import { ButtonRow } from '../parts/ButtonRow.tsx'
import { Section } from '../parts/Section.tsx'
import { Field } from '../parts/Field.tsx'
import { ActionButton } from '../parts/ActionButton.tsx'
import { titled } from '../parts/ToolParts.tsx'
import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'
import controls from '../../../../styles/components/table/toolbar/TableControls.module.css'

function SceneLookSection({ mode, look, onLook, onResetFog }: { mode: 'session' | 'editor'; look: SceneLook; onLook: (change: Partial<SceneLook>) => void; onResetFog: () => void }) {
    const editing = mode === 'editor';
    return (
        <>
            <h2 className={styles.panelTitle}>Set the Scene</h2>
            <h3 className={styles.sectionTitle}>Mood</h3>
            <ButtonRow className={styles.surfaceButtonRow} role="group" aria-label="Mood">
                {SCENE_MOODS.map((m) => (
                    <ToggleButton className={styles.surfaceButton} pressed={look.mood === m} onClick={() => onLook({ mood: m })} key={m}>{titled(m)}</ToggleButton>
                ))}
            </ButtonRow>
            <ButtonRow className={styles.surfaceButtonRow} role="group" aria-label="Weather">
                <h3 className={styles.sectionTitle}>Weather</h3>
                {SCENE_WEATHERS.map((w) => (
                    <ToggleButton className={styles.surfaceButton} pressed={look.weather === w} onClick={() => onLook({ weather: w })} key={w}>{titled(w)}</ToggleButton>
                ))}
            </ButtonRow>
            <ButtonRow className={styles.surfaceButtonRow}>
                <h3 className={styles.sectionTitle}>Room and candles</h3>
                <ToggleButton className={styles.surfaceButton} pressed={look.room ?? false} onClick={() => onLook({ room: !look.room })}>Room and candles</ToggleButton>
                {!editing && (
                    <ToggleButton className={styles.surfaceButton} pressed={look.fog ?? false} onClick={() => onLook({ fog: !look.fog })}>Fog</ToggleButton>
                )}
                {!editing && look.fog && <ActionButton  onClick={onResetFog}>Cover the map again</ActionButton>}
            </ButtonRow>
        </>
    );
}

function SceneBoardSection({ mode, look, onLook, boardSize }: { mode: 'session' | 'editor'; look: SceneLook; onLook: (change: Partial<SceneLook>) => void; boardSize?: ReactNode }) {
    const editing = mode === 'editor';
    const [url, setUrl] = useState(look.map?.url ?? '');
    const [size, setSize] = useState(look.map?.size ?? 30);
    return (
        <>
            <h3 className={styles.sectionTitle}>Board</h3>
            <ButtonRow role="group" aria-label="Board style">
                {BOARD_STYLES.map((s) => (
                    <ToggleButton className={styles.surfaceButton} pressed={styleOf(look) === s} onClick={() => onLook({ style: s })} key={s}>{titled(s)}</ToggleButton>
                ))}
            </ButtonRow>
            <ButtonRow className={styles.surfaceButtonRow} role="group" aria-label="Grid">
                <h3 className={styles.sectionTitle}>Grid</h3>
                {GRID_MODES.map((g) => (
                    <ToggleButton className={styles.surfaceButton} pressed={gridOf(look) === g} onClick={() => onLook({ grid: g })} key={g}>{titled(g)}</ToggleButton>
                ))}
            </ButtonRow>
            {boardSize}
            {editing && (
                <form className={styles.surfaceButtonRow} onSubmit={(e) => { e.preventDefault(); onLook({ map: { url: url.trim(), size } }); }}>
                    <input className={styles.input} type="url" placeholder="Map picture link (https://…)" aria-label="Map picture link"
                        value={url} onChange={(e) => setUrl(e.target.value)} />
                    <Field label="Width">
                        <input className={styles.inputRange} type="range" min={10} max={80} step={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
                    </Field>
                    <button type="submit" className={styles.send} disabled={!url.trim()} aria-label="Show map">→</button>
                    {look.map && <ActionButton onClick={() => { setUrl(''); onLook({ map: null }); }}>Remove map</ActionButton>}
                </form>
            )}
        </>
    );
}

export function ScenePanel({ mode, look, onLook, onResetFog, boardSize }: PanelProps) {
    return (
        <Section id="board-tab-panel-scene" labelledBy="board-tab-scene">
            <SceneLookSection mode={mode} look={look} onLook={onLook} onResetFog={onResetFog} />
            <SceneBoardSection mode={mode} look={look} onLook={onLook} boardSize={boardSize} />
        </Section>
    );
}
