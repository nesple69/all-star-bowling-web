import { Router } from 'express';
import * as contabilitaController from '../controllers/contabilitaController';
import { authenticateToken, isAdmin } from '../middleware/auth';

const router = Router();

// Endpoint per il giocatore (richiede login)
// La rotta sarà montata su /api, quindi questo diventerà /api/giocatori/:id/borsellino
router.get('/giocatori/:id/borsellino', authenticateToken, contabilitaController.getBorsellinoGiocatore);

// Endpoint per la contabilità (solo ADMIN)
// Questi saranno montati sotto /api/contabilita
router.post('/contabilita/ricarica', authenticateToken, isAdmin, contabilitaController.ricaricaBorsellino);
router.post('/contabilita/addebito', authenticateToken, isAdmin, contabilitaController.addebitoManuale);
router.post('/contabilita/rimborso', authenticateToken, isAdmin, contabilitaController.registraRimborso);
router.get('/contabilita/movimenti', authenticateToken, isAdmin, contabilitaController.getAllMovimenti);
router.get('/contabilita/saldi', authenticateToken, isAdmin, contabilitaController.getAllSaldi);
router.put('/contabilita/movimenti/:id', authenticateToken, isAdmin, contabilitaController.updateMovimento);
router.delete('/contabilita/movimenti/:id', authenticateToken, isAdmin, contabilitaController.deleteMovimento);

export default router;
