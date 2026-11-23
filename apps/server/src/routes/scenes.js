// The table (steps 12–13): scenes, terrain and tokens. Who may do what is in sceneController.js.
import { Router } from 'express';
import { getActiveScene, paint, placeToken, moveToken, removeToken } from '../controllers/sceneController.js';

const router = Router();

router.get('/campaigns/:id/scene', getActiveScene);
router.post('/scenes/:id/paint', paint);
router.post('/scenes/:id/tokens', placeToken);
router.post('/tokens/:id/move', moveToken);
router.delete('/tokens/:id', removeToken);

export default router;
