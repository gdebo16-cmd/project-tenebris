// Campaign Scene Routes                                          
import { Router } from 'express';
import { getActiveScene, paint } from '../controllers/sceneController.js';

const router = Router();

router.get('/campaigns/:id/scene', getActiveScene);
router.post('/scenes/:id/paint', paint);

export default router;