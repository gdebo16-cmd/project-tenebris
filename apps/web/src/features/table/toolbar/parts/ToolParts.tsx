import { useState } from 'react'
import { BRUSHES } from '../../hooks/tableTypes.ts'
import { ToggleButton } from './ToggleButton.tsx'
import { ButtonRow } from './ButtonRow.tsx'
import { ActionButton } from './ActionButton.tsx'

export const titled = (word: string) => word[0].toUpperCase() + word.slice(1);

export function BrushRow({ brush, setBrush }: { brush: number; setBrush: (b: number) => void }) {
    return (
        <ButtonRow label="Brush:">
            {BRUSHES.map(([label, rings]) => (
                <ToggleButton key={rings} pressed={brush === rings} onClick={() => setBrush(rings)}>{label}</ToggleButton>
            ))}
        </ButtonRow>
    );
}

export function ClearMapRow({ onClearMap }: { onClearMap: () => void }) {
    const [sure, setSure] = useState(false);
    return sure ? (
        <ButtonRow>
            <ActionButton danger onClick={() => { setSure(false); onClearMap(); }}>Yes, clear everything</ActionButton>
            <ActionButton onClick={() => setSure(false)}>Keep it</ActionButton>
        </ButtonRow>
    ) : (
        <ButtonRow>
            <ActionButton onClick={() => setSure(true)}>Clear map</ActionButton>
        </ButtonRow>
    );
}
