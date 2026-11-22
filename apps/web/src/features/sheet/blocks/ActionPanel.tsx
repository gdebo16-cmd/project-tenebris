// The action panel: the Actions · Spells · Gear · Features tabs and what shows under each one.
// One component with its own CSS module (ActionPanel.module.css), so it can be placed, moved and
// styled as a single block. Which tab is open is kept here.
import { useState, type CSSProperties } from 'react';
import type { ActRequest } from '@tenebris/rules/actions';
import type { Creature } from '@tenebris/rules/creature';
import { PANEL_TABS, type PanelTab } from '@tenebris/rules/layout';
import type { SheetDo } from '../queries.ts';
import css from './ActionPanel.module.css';
import ActionsBlock from './ActionsBlock.tsx';
import SpellsBlock from './SpellsBlock.tsx';
import SpellBookBlock from './SpellBookBlock.tsx';
import PurseBlock from './PurseBlock.tsx';
import InventoryBlock from './InventoryBlock.tsx';
import FeaturesBlock from './FeaturesBlock.tsx';

const LABELS: Record<PanelTab, string> = { actions: 'Actions', spells: 'Spells', gear: 'Gear', features: 'Features' };

type Props = {
    creature: Creature;
    canEdit: boolean;
    id: string;                                                   // the character's id (for gear, runes and the spell book)
    onAct: (request: ActRequest, prefix?: string) => void;       // ask the server to roll
    onNote: (text: string) => void;                              // a message in the roll feed, no roll
    onDo: (request: SheetDo, prefix?: string) => void;           // cast, use a feature or rune (the server saves it)
    tabs?: readonly PanelTab[];                                  // which tabs, in order (the layout chooses, L6); all four if missing
};

export default function ActionPanel({ creature, canEdit, id, onAct, onNote, onDo, tabs = PANEL_TABS }: Props) {
    const [picked, setPicked] = useState<PanelTab>(tabs[0] ?? 'actions');
    const tab = tabs.includes(picked) ? picked : tabs[0];   // the picked tab may have been taken out of the panel
    const blockProps = { creature, canEdit, onAct, onNote };
    const cast = (actionKey: string, castLevel: number) => onDo({ path: 'cast', body: { actionKey, castLevel } });
    const useFeature = (featureKey: string) => onDo({ path: 'feature', body: { featureKey } });

    return (
        <section className={css.panel} aria-label="Actions, spells, gear and features">
            <nav className={css.tabBar} aria-label="Sheet sections" style={{ '--tab-count': tabs.length } as CSSProperties}>
                {tabs.map((id) => (
                    <button key={id} type="button" className={tab === id ? css.tabActive : css.tab}
                        aria-current={tab === id ? 'page' : undefined} onClick={() => setPicked(id)}>{LABELS[id]}</button>
                ))}
            </nav>

            <div className={css.content}>
                {tab === 'actions' && (
                    <ActionsBlock {...blockProps} id={id} onCast={cast} onUse={useFeature}
                        onRune={(runeKey) => onDo({ path: 'rune', body: { runeKey } })} />
                )}
                {tab === 'spells' && (
                    <>
                        <SpellsBlock {...blockProps} onCast={cast} />
                        <SpellBookBlock creature={creature} canEdit={canEdit} id={id} />
                    </>
                )}
                {tab === 'gear' && (
                    <>
                        <PurseBlock creature={creature} canEdit={canEdit} id={id} onNote={onNote} />
                        <InventoryBlock creature={creature} canEdit={canEdit} id={id} onNote={onNote} />
                    </>
                )}
                {tab === 'features' && <FeaturesBlock creature={creature} canEdit={canEdit} onUse={useFeature} />}
            </div>
        </section>
    );
}
