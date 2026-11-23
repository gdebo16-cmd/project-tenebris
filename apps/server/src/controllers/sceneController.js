// The table's scenes (step 12): load the active scene, paint terrain. Painting is DM only.
import * as Scenes from '../models/sceneModel.js';
import * as Monsters from '../models/monsterModel.js';   // for memberRole(campId, userId)

const TERRAIN = ['wall', 'water', 'rough', 'ice' ];

// GET /api/campaigns/:id/scene -> { scene, isDm }
export async function getActiveScene(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const campId = Number(req.params.id);
    const role = await Monsters.memberRole(campId, req.session.userId);
    if (!role) return res.status(404).json({ error: 'Campaign not found' });

    let scene = await Scenes.activeScene(campId);
     if (!scene && role === 'dm') {
        scene = await Scenes.createActiveScene(campId, 'Scene 1');
     }
    res.json({ scene, isDm: role === 'dm' });
}

// POST /api/scenes/:id/paint  body { q, r, terrain }  -> the scene's terrain
export async function paint(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const scene = await Scenes.getScene(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    const role = await Monsters.memberRole(scene.campaign_id, req.session.userId);
    if (role !== 'dm') return res.status(403).json({ error: 'You are not the DM' });

    const { q, r, terrain } = req.body;
    if (!Number.isInteger(q) || !Number.isInteger(r)) return res.status(400).json({ error: 'q and r must be whole numbers' });
    if (terrain !== null && !TERRAIN.includes(terrain)) return res.status(400).json({ error: 'Invalid terrain' });

    const key = `${q},${r}`;
    if (terrain === null) delete scene.terrain[key];  
    else scene.terrain[key] = terrain;
    await Scenes.saveTerrain(scene.id, scene.terrain);
    res.json(scene.terrain);
}