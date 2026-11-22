// The logged-in player's own pages: home, settings (and deleting the account), profile.
import { Router } from 'express';
import { home, getSettings, updateSettings, getProfile, updateProfile, deleteAccount } from '../controllers/apiUserController.js';

const router = Router();

router.get('/home', home);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.delete('/settings', deleteAccount);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

export default router;
