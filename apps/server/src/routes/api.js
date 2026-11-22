// Every JSON route, mounted at /api in index.js. Each resource has its own router file next to this one;
// this file only puts them together, then turns any crash into a JSON error.
import { Router } from 'express';
import authRouter from './auth.js';
import accountRouter from './account.js';
import rollsRouter from './rolls.js';
import characterFormRouter from './characterForm.js';
import sheetsRouter from './sheets.js';
import charactersRouter from './characters.js';
import inventoryRouter from './inventory.js';
import campaignsRouter from './campaigns.js';
import contentRouter from './content.js';
import monstersRouter from './monsters.js';

const router = Router();

router.use(authRouter);           // /login, /register, /me, /logout
router.use(accountRouter);        // /home, /settings, /profile
router.use(rollsRouter);          // /roll
router.use(characterFormRouter);  // /character-options, /characters (draft), /characters/:id/form, /finish
router.use(sheetsRouter);         // /sheets/character/:id (+ /act, /spellbook, …)
router.use(charactersRouter);     // /characters/:id, equipping, runes
router.use(inventoryRouter);      // /characters/:id/inventory
router.use(campaignsRouter);      // /campaigns
router.use(contentRouter);        // /content
router.use(monstersRouter);       // /monsters, /campaigns/:id/monsters, /campaign_monsters/:id

// If any route above crashes, answer with JSON instead of an HTML error page.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
});

export default router;
