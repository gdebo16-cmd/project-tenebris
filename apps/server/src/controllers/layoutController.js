// Sheet layouts (L4). The player's own arrangement of each kind of sheet, saved to the account.
// The layout is checked with the same rules the browser uses (@tenebris/rules/layout) before it's saved.
import { checkLayout, isSheetKind, SHEET_BLOCKS } from '@tenebris/rules/layout';
import * as Layouts from '../models/layoutModel.js';

const notLoggedIn = (res) => res.status(401).json({ error: 'Not logged in' });

// GET /api/layouts -> { character?: layout, monster?: layout }  (a saved layout that no longer checks out is left out)
export async function getLayouts(req, res) {
    if (!req.session.userId) return notLoggedIn(res);
    const saved = await Layouts.getLayouts(req.session.userId);
    const out = {};
    for (const [kind, layout] of Object.entries(saved)) {
        if (!isSheetKind(kind)) continue;
        const checked = checkLayout(layout, SHEET_BLOCKS[kind]);
        if ('layout' in checked) out[kind] = checked.layout;
    }
    res.json(out);
}

// PUT /api/layouts/:kind   body: a layout  -> the saved layout
export async function saveLayout(req, res) {
    if (!req.session.userId) return notLoggedIn(res);
    const { kind } = req.params;
    if (!isSheetKind(kind)) return res.status(404).json({ error: 'No such sheet' });
    const checked = checkLayout(req.body, SHEET_BLOCKS[kind]);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    await Layouts.saveLayout(req.session.userId, kind, checked.layout);
    res.json(checked.layout);
}

// DELETE /api/layouts/:kind  -> back to the default layout
export async function resetLayout(req, res) {
    if (!req.session.userId) return notLoggedIn(res);
    const { kind } = req.params;
    if (!isSheetKind(kind)) return res.status(404).json({ error: 'No such sheet' });
    await Layouts.saveLayout(req.session.userId, kind, null);
    res.json({ ok: true });
}
