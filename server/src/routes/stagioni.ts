import { Router } from 'express';
import * as stagioniController from '../controllers/stagioniController';
import { authenticateToken, isAdmin } from '../middleware/auth';

const router = Router();

// Endpoint Pubblici
router.get('/', stagioniController.getStagioni);
router.get('/attiva', stagioniController.getStagioneAttiva);

// Endpoint Protetti (Solo ADMIN)
router.post('/', authenticateToken, isAdmin, stagioniController.createStagione);
router.post('/rinnovi-bulk', authenticateToken, isAdmin, stagioniController.bulkRinnovoTesserati);
router.put('/:id', authenticateToken, isAdmin, stagioniController.updateStagione);
router.delete('/:id', authenticateToken, isAdmin, stagioniController.deleteStagione);

export default router;
