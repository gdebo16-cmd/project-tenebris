// A sheet's tools (blocks/SheetContext.tsx): the server data and actions a sheet's blocks use, for one character or
// one campaign monster. The sheet pages use these, and so does the DM page for its current monster and player.
// What happens to a roll's text (the roll orb, the DM's feed...) is up to the page: it passes a Reporter.
import type { ActRequest } from '@tenebris/rules/actions';
import { ApiError } from '../../api.ts';
import { useAct, useSheet, useSheetChange, useSheetDo, type SheetDo } from './queries.ts';
import { useMonsterAct, useMonsterChange, useMonsterSheet } from './monsterQueries.ts';
import type { SheetTools } from '../../components/sheets/blocks/SheetContext.tsx';
import type { FeedEntry } from '../../components/sheets/blocks/RollFeed.tsx';

export const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

export type Reporter = {
    done: (text: string) => void;      // the server's text for a roll, a cast, a rest...
    failed: (text: string) => void;    // why it didn't work
    note: (text: string) => void;      // a message in the feed, no roll
    feed: FeedEntry[];                 // what the roll feed block shows
    changed?: () => void;              // after HP, ward, conditions or notes change (the DM page reloads its lists)
};

// One character. id = null: none yet (nothing is requested, tools is null).
export function useCharacterSheetTools(id: string | null, report: Reporter) {
    const key = id ?? '';
    const sheet = useSheet(key, id !== null);
    const act = useAct(key);
    const change = useSheetChange(key);
    const sheetDo = useSheetDo(key);
    if (!id || !sheet.data) return { tools: null, sheet };

    const { creature, canEdit, access } = sheet.data;
    const changeError = [change.hp.error, change.tempHp.error, change.conditions.error].find(Boolean);
    const after = { onSuccess: () => report.changed?.() };
    const tools: SheetTools = {
        kind: 'character',
        id,
        creature,
        canEdit,
        access,
        act: (request: ActRequest, prefix = '') => {
            act.mutateAsync(request).then((r) => report.done(`${prefix}${r.text}`), (err) => report.failed(`Roll failed: ${messageOf(err)}`));
        },
        note: report.note,
        // Feature uses, rests and casting: the server decides and saves
        run: (request: SheetDo, prefix = '') => {
            sheetDo.mutateAsync(request).then((r) => { report.done(`${prefix}${r.text}`); report.changed?.(); }, (err) => report.failed(messageOf(err)));
        },
        busy: sheetDo.isPending,
        hp: (action, amount) => change.hp.mutate({ action, amount }, after),
        ward: (amount) => change.tempHp.mutate(amount, after),
        setConditions: (body) => change.conditions.mutate(body, after),
        saveNotes: () => {},
        savingNotes: false,
        changeError: changeError ? messageOf(changeError) : undefined,
        feed: report.feed,
    };
    return { tools, sheet };
}

// One campaign monster (the DM gets the whole sheet; anyone else a glimpse, and tools stays null).
export function useMonsterSheetTools(id: string | null, report: Reporter) {
    const key = id ?? '';
    const sheet = useMonsterSheet(key, id !== null);
    const act = useMonsterAct(key);
    const change = useMonsterChange(key);
    if (!id || !sheet.data || !('creature' in sheet.data)) return { tools: null, sheet };

    const { creature, canEdit } = sheet.data;
    const changeError = [change.hp.error, change.tempHp.error, change.conditions.error, change.notes.error].find(Boolean);
    const after = { onSuccess: () => report.changed?.() };
    const tools: SheetTools = {
        kind: 'monster',
        id,
        creature,
        canEdit,
        access: 'dm',
        act: (request: ActRequest) => {
            act.mutateAsync(request).then((r) => report.done(r.text), (err) => report.failed(`Roll failed: ${messageOf(err)}`));
        },
        note: report.note,
        run: () => {},   // monsters have no casting, features or rests to run
        busy: false,
        hp: (action, amount) => change.hp.mutate({ action, amount }, after),
        ward: (amount) => change.tempHp.mutate(amount, after),
        setConditions: (body) => change.conditions.mutate(body, after),
        saveNotes: (notes) => change.notes.mutate(notes, after),
        savingNotes: change.notes.isPending,
        changeError: changeError ? messageOf(changeError) : undefined,
        feed: report.feed,
    };
    return { tools, sheet };
}
