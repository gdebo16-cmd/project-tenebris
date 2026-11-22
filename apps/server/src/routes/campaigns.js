// Campaigns: listing, creating, joining, changing and deleting them, and picking your character for one.
import { Router } from 'express';
import { createCampaign, deleteCampaign, getCampaign, updateCampaign, listCampaigns, joinCampaign, setCampaignCharacter } from '../controllers/apiCampaignController.js';

const router = Router();

router.get('/campaigns', listCampaigns);
router.post('/campaigns', createCampaign);
router.post('/campaigns/join', joinCampaign);
router.get('/campaigns/:id', getCampaign);
router.patch('/campaigns/:id', updateCampaign);
router.delete('/campaigns/:id', deleteCampaign);
router.put('/campaigns/:id/character', setCampaignCharacter);

export default router;
