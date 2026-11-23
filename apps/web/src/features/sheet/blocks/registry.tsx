// The block list (L2): every block a sheet layout can place. Each entry says what the block is called, which
// sheets have it, which phone tab it goes under, and how to draw it from the sheet context.
// A new block = an entry here + its id in SHEET_BLOCKS (packages/rules/src/layout.ts, which the server checks).
import type { JSX } from 'react';
import { panelTabsOf, SHEET_BLOCKS, SHEET_KINDS, type SheetKind as LayoutKind, type SheetLayout } from '@tenebris/rules/layout';
import { useSheetTools, type SheetTools } from './SheetContext.tsx';
import SheetHeader from './SheetHeader.tsx';
import HealthBlock from './HealthBlock.tsx';
import CoreStatsBlock from './CoreStatsBlock.tsx';
import StatsBlock from './StatsBlock.tsx';
import SkillsBlock from './SkillsBlock.tsx';
import ConditionsBlock from './ConditionsBlock.tsx';
import RestBlock from './RestBlock.tsx';
import ActionPanel from './ActionPanel.tsx';
import ActionsBlock from './ActionsBlock.tsx';
import SpellsBlock from './SpellsBlock.tsx';
import SpellBookBlock from './SpellBookBlock.tsx';
import PurseBlock from './PurseBlock.tsx';
import InventoryBlock from './InventoryBlock.tsx';
import FeaturesBlock from './FeaturesBlock.tsx';
import TraitsBlock from './TraitsBlock.tsx';
import LegendaryBlock from './LegendaryBlock.tsx';
import RollFeed from './RollFeed.tsx';
import { CurrentCreature } from '../../dm/DmContext.tsx';
import { EncounterBlock, InitiativeBlock, NotesBlock, PartyBlock, TableRollsBlock } from '../../dm/DmBlocks.tsx';

// The phone tabs of each kind of layout (decision A: phones follow the layout, grouped under these). null = always shown.
const SHEET_TABS = [
    { id: 'stats', label: 'Stats' },
    { id: 'combat', label: 'Combat' },
    { id: 'condition', label: 'Condition' },
] as const;
export const PHONE_TABS = {
    character: SHEET_TABS,
    monster: SHEET_TABS,
    dm: [
        { id: 'turns', label: 'Turns' },
        { id: 'party', label: 'Party' },
        { id: 'encounter', label: 'Encounter' },
        { id: 'notes', label: 'Notes' },
    ],
} as const satisfies Record<LayoutKind, readonly { id: string; label: string }[]>;
export type PhoneTab = (typeof PHONE_TABS)[LayoutKind][number]['id'];

export type BlockDef = {
    label: string;
    sheets: LayoutKind[];                    // the kinds of layout that can place it (character, monster, dm)
    phoneTab: PhoneTab | null;
    show?: (tools: SheetTools) => boolean;   // e.g. the roll feed only for the DM on a character sheet
    note?: string;                           // shown in the layout editor
    scrolls?: true;                          // a growing list (actions, spells...): never shrunk to fit; what doesn't fit scrolls
    fills?: true;                            // a grid of tiles that stretches to fill the block (its CSS does it): not zoomed
    Component: (props: { layout: SheetLayout }) => JSX.Element | null;
};

const noop = () => {};
const cast = (t: SheetTools) => (actionKey: string, castLevel: number) => t.run({ path: 'cast', body: { actionKey, castLevel } });
const featureUser = (t: SheetTools) => (featureKey: string) => t.run({ path: 'feature', body: { featureKey } });

// The sheet blocks (character and monster sheets)
const SHEET_BLOCK_DEFS = {
    header: {
        label: 'Header', fills: true, sheets: ['character', 'monster'], phoneTab: null,
        Component: () => <SheetHeader creature={useSheetTools().creature} />,
    },
    health: {
        label: 'Health', sheets: ['character', 'monster'], phoneTab: 'condition',
        Component: () => {
            const t = useSheetTools();
            return <HealthBlock creature={t.creature} canEdit={t.canEdit} onHp={t.hp} onWard={t.ward} error={t.changeError} />;
        },
    },
    core: {
        label: 'Armor, speed, initiative', fills: true, sheets: ['character', 'monster'], phoneTab: 'combat',
        Component: () => {
            const t = useSheetTools();
            return <CoreStatsBlock creature={t.creature} canEdit={t.canEdit} onAct={t.act} />;
        },
    },
    stats: {
        label: 'Stats', fills: true, sheets: ['character', 'monster'], phoneTab: 'stats',
        Component: () => {
            const t = useSheetTools();
            return <StatsBlock creature={t.creature} canEdit={t.canEdit} onAct={t.act} />;
        },
    },
    skills: {
        label: 'Skills', fills: true, sheets: ['character', 'monster'], phoneTab: 'stats',
        Component: () => {
            const t = useSheetTools();
            return <SkillsBlock creature={t.creature} canEdit={t.canEdit} onAct={t.act} />;
        },
    },
    conditions: {
        label: 'Conditions', fills: true, sheets: ['character', 'monster'], phoneTab: 'condition',
        Component: () => {
            const t = useSheetTools();
            return <ConditionsBlock creature={t.creature} canEdit={t.canEdit} onChange={t.setConditions} />;
        },
    },
    rest: {
        label: 'Rest', sheets: ['character'], phoneTab: 'condition',
        Component: () => {
            const t = useSheetTools();
            return <RestBlock canEdit={t.canEdit} busy={t.busy} onRest={(type) => t.run({ path: 'rest', body: { type } })} />;
        },
    },
    // The tab group (L6): its tabs are chosen in the layout
    actionPanel: {
        label: 'Action panel (tabs)', scrolls: true, sheets: ['character'], phoneTab: 'combat',
        Component: ({ layout }) => {
            const t = useSheetTools();
            return <ActionPanel creature={t.creature} canEdit={t.canEdit} id={t.id} onAct={t.act} onNote={t.note} onDo={t.run} tabs={panelTabsOf(layout)} />;
        },
    },
    // The panel's tabs as blocks of their own, to place outside the panel (L6)
    actions: {
        label: 'Actions', scrolls: true, sheets: ['character', 'monster'], phoneTab: 'combat',
        Component: () => {
            const t = useSheetTools();
            return t.kind === 'character'
                ? <ActionsBlock creature={t.creature} canEdit={t.canEdit} onAct={t.act} onNote={t.note} id={t.id} onCast={cast(t)} onUse={featureUser(t)}
                    onRune={(runeKey) => t.run({ path: 'rune', body: { runeKey } })} />
                : <ActionsBlock creature={t.creature} canEdit={t.canEdit} onAct={t.act} onNote={t.note} id={t.id} onCast={noop} onUse={noop} onRune={noop} />;
        },
    },
    spells: {
        label: 'Spells and spell book', scrolls: true, sheets: ['character'], phoneTab: 'combat',
        Component: () => {
            const t = useSheetTools();
            return (
                <>
                    <SpellsBlock creature={t.creature} canEdit={t.canEdit} onAct={t.act} onNote={t.note} onCast={cast(t)} />
                    <SpellBookBlock creature={t.creature} canEdit={t.canEdit} id={t.id} />
                </>
            );
        },
    },
    gear: {
        label: 'Money and gear', scrolls: true, sheets: ['character'], phoneTab: 'combat',
        Component: () => {
            const t = useSheetTools();
            return (
                <>
                    <PurseBlock creature={t.creature} canEdit={t.canEdit} id={t.id} onNote={t.note} />
                    <InventoryBlock creature={t.creature} canEdit={t.canEdit} id={t.id} onNote={t.note} />
                </>
            );
        },
    },
    features: {
        label: 'Features', scrolls: true, sheets: ['character', 'monster'], phoneTab: 'combat',
        Component: () => {
            const t = useSheetTools();
            return <FeaturesBlock creature={t.creature} canEdit={t.kind === 'character' && t.canEdit} onUse={t.kind === 'character' ? featureUser(t) : noop} />;
        },
    },
    legendary: {
        label: 'Legendary actions', scrolls: true, sheets: ['monster'], phoneTab: 'combat',
        Component: () => <LegendaryBlock creature={useSheetTools().creature} />,
    },
    traits: {
        label: 'Traits and notes', scrolls: true, sheets: ['monster'], phoneTab: 'stats',
        Component: () => {
            const t = useSheetTools();
            return <TraitsBlock creature={t.creature} canEdit={t.canEdit} saving={t.savingNotes} onSaveNotes={t.saveNotes} />;
        },
    },
    rollFeed: {
        label: 'Roll feed', scrolls: true, sheets: ['character', 'monster'], phoneTab: 'combat', note: 'on a character sheet only the DM sees it',
        show: (t) => t.kind === 'monster' || t.access === 'dm',
        Component: () => <RollFeed entries={useSheetTools().feed} />,
    },
} satisfies Record<string, BlockDef>;

// A sheet block on the DM page, drawn for the current monster or player (dm/DmContext.tsx). Same look and same
// scaling as on the sheet; under the Encounter or Party phone tab.
function current(who: 'monster' | 'player', base: keyof typeof SHEET_BLOCK_DEFS): BlockDef {
    const def: BlockDef = SHEET_BLOCK_DEFS[base];
    const Inner = def.Component;
    return {
        label: `${who === 'monster' ? 'Monster' : 'Player'}: ${def.label}`,
        sheets: ['dm'],
        phoneTab: who === 'monster' ? 'encounter' : 'party',
        ...(def.scrolls ? { scrolls: true as const } : {}),
        ...(def.fills ? { fills: true as const } : {}),
        Component: (props) => <CurrentCreature who={who}><Inner {...props} /></CurrentCreature>,
    };
}

// The DM page's blocks: its own (dm/DmBlocks.tsx), then the current monster's and the current player's
const DM_BLOCK_DEFS = {
    initiative: { label: 'Initiative', scrolls: true, sheets: ['dm'], phoneTab: 'turns', Component: () => <InitiativeBlock /> },
    tableRolls: { label: 'Rolls (the table)', scrolls: true, sheets: ['dm'], phoneTab: 'turns', Component: () => <TableRollsBlock /> },
    party: { label: 'Party', scrolls: true, sheets: ['dm'], phoneTab: 'party', Component: () => <PartyBlock /> },
    encounter: { label: 'Encounter', scrolls: true, sheets: ['dm'], phoneTab: 'encounter', Component: () => <EncounterBlock /> },
    dmNotes: { label: 'Notes', fills: true, sheets: ['dm'], phoneTab: 'notes', Component: () => <NotesBlock /> },
    monHeader: current('monster', 'header'),
    monHealth: current('monster', 'health'),
    monCore: current('monster', 'core'),
    monStats: current('monster', 'stats'),
    monSkills: current('monster', 'skills'),
    monConditions: current('monster', 'conditions'),
    monActions: current('monster', 'actions'),
    monLegendary: current('monster', 'legendary'),
    monFeatures: current('monster', 'features'),
    monTraits: current('monster', 'traits'),
    pcHeader: current('player', 'header'),
    pcHealth: current('player', 'health'),
    pcCore: current('player', 'core'),
    pcStats: current('player', 'stats'),
    pcSkills: current('player', 'skills'),
    pcConditions: current('player', 'conditions'),
    pcActions: current('player', 'actions'),
    pcSpells: current('player', 'spells'),
    pcGear: current('player', 'gear'),
    pcFeatures: current('player', 'features'),
} satisfies Record<string, BlockDef>;

export const BLOCKS = { ...SHEET_BLOCK_DEFS, ...DM_BLOCK_DEFS };

export type BlockId = keyof typeof BLOCKS;

export const isBlockId = (id: string): id is BlockId => id in BLOCKS;
export const blockDef = (id: BlockId): BlockDef => BLOCKS[id];

// The blocks one kind of layout can use: the list the server checks against, in that order
export const blocksFor = (kind: LayoutKind): BlockId[] => SHEET_BLOCKS[kind].filter(isBlockId);

// The two lists must agree; say so loudly while developing if they don't
if (import.meta.env.DEV) {
    for (const kind of SHEET_KINDS) {
        const here = (Object.keys(BLOCKS) as BlockId[]).filter((id) => blockDef(id).sheets.includes(kind)).sort().join();
        const rules = [...SHEET_BLOCKS[kind]].sort().join();
        if (here !== rules) console.error(`Block list mismatch for the ${kind} sheet: registry.tsx has ${here}, SHEET_BLOCKS has ${rules}`);
    }
}
