// The table (steps 12–13): scenes, terrain and tokens. Who may do what is in sceneController.js.
import { Router } from 'express';
import { getActiveScene, paint, setLook, placeToken, moveToken, removeToken, resetFog, addOverlay, removeOverlay, clearMap,
    listBoards, createBoard, editBoard, renameBoard, deleteBoard, setLiveBoard } from '../controllers/sceneController.js';
import { getActions, act } from '../controllers/tableActController.js';

const router = Router();

router.get('/campaigns/:id/scene', getActiveScene);
router.post('/scenes/:id/paint', paint);
router.post('/scenes/:id/clear', clearMap);
// the board library (map editor) and the live board (play session)
router.get('/campaigns/:id/scenes', listBoards);
router.post('/campaigns/:id/scenes', createBoard);
router.put('/campaigns/:id/active-scene', setLiveBoard);
router.get('/scenes/:id/edit', editBoard);
router.patch('/scenes/:id', renameBoard);
router.delete('/scenes/:id', deleteBoard);           // start the map over (DM)
router.put('/scenes/:id/look', setLook);
router.post('/scenes/:id/tokens', placeToken);
router.post('/tokens/:id/move', moveToken);
router.delete('/tokens/:id', removeToken);
router.post('/scenes/:id/fog/reset', resetFog);              // step 18
router.post('/scenes/:id/overlays', addOverlay);             // step 17: spell areas and other shapes
router.delete('/overlays/:id', removeOverlay);
router.get('/tokens/:id/actions', getActions);               // step 17: acting on the table
router.post('/tokens/:id/act', act);

export default router;
