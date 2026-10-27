import { Router } from 'express';
import { authenticateToken, isCoachOrAdmin } from '../middleware/auth';
import * as coachController from '../controllers/coachController';

const router = Router();

// Tutte le rotte sotto /api/coach sono protette per COACH o ADMIN
router.use(authenticateToken, isCoachOrAdmin);

router.get('/tornei/:id/formazioni', coachController.getFormazioniCoach);
router.post('/tornei/:id/conferma-squadre', coachController.confermaSquadreCoach);
router.delete('/squadre/:squadraId', coachController.annullaSquadraCoach);

export default router;
