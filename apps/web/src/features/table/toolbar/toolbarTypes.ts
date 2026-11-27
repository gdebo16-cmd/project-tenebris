import { type ReactNode } from 'react'
import { type SceneData, type Token } from '../hooks/tableQueries.ts'
import { type Tool } from '../hooks/tableTypes.ts'
import { type SceneLook } from '@tenebris/rules/board'

export type ToolbarProps = {
        mode: 'session' | 'editor';
        data: SceneData | undefined;
        tool: Tool; setTool: (t: Tool) => void;
        placing: string; setPlacing: (v: string) => void;
        summonName: string; setSummonName: (v: string) => void;
        summonOwner: string; setSummonOwner: (v: string) => void;
        selectedToken: Token | null;
        onRemove: () => void;
        look: SceneLook;
        onLook: (change: Partial<SceneLook>) => void;
        onResetFog: () => void;
        onClearMap: () => void;
        brush: number; setBrush: (b: number) => void;
        message: string;
        boardSize?: ReactNode;
        children?: ReactNode;
};

export type PanelProps = ToolbarProps & { editing: boolean };