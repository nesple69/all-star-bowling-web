import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

// Endpoint per la dashboard (pubblico per dati aggregati, protetto con optionalAuthenticate per dati sensibili admin)
router.get('/stats', optionalAuthenticate, getDashboardStats);

export default router;
