import { Router } from 'express';
import * as torneiController from '../controllers/torneiController';
import * as iscrizioniController from '../controllers/iscrizioniController';
import { authenticateToken, isAdmin, optionalAuthenticate } from '../middleware/auth';

const router = Router();

// --- Endpoint Pubblici ---
router.get('/public', torneiController.getTorneiPublici);
router.get('/public/:id', torneiController.getTorneoPublicById);
router.get('/public/:id/disponibilita', iscrizioniController.getDisponibilitaTurni);
router.get('/public/:id/iscritti', iscrizioniController.getIscrizioniPublic);
router.get('/classifiche', torneiController.getClassifiche);
router.get('/lookup-tessera/:tessera', optionalAuthenticate, iscrizioniController.lookupTessera);
router.post('/iscriviti', optionalAuthenticate, iscrizioniController.iscriviGiocatore);

// --- Endpoint Protetti (Solo ADMIN) ---
router.get('/', authenticateToken, isAdmin, torneiController.getTorneiAdmin);
router.get('/:id', authenticateToken, isAdmin, torneiController.getTorneoById);

router.post('/',
    authenticateToken,
    isAdmin,
    torneiController.upload.any(),
    torneiController.createTorneo
);

router.put('/:id',
    authenticateToken,
    isAdmin,
    torneiController.upload.any(),
    torneiController.updateTorneo
);

router.delete('/:id', authenticateToken, isAdmin, torneiController.deleteTorneo);

// --- Gestione Iscrizioni (ADMIN) ---
router.get('/:id/iscrizioni', authenticateToken, isAdmin, iscrizioniController.getIscrizioniTorneo);
router.patch('/iscrizioni/:id/stato', authenticateToken, isAdmin, iscrizioniController.updateStatoIscrizione);
router.put('/iscrizioni/:id', authenticateToken, isAdmin, iscrizioniController.modificaIscrizione);
router.delete('/iscrizioni/:id', authenticateToken, isAdmin, iscrizioniController.cancellaIscrizione);

// Gestione Giorni/Turni
router.post('/:id/giorni', authenticateToken, isAdmin, torneiController.addGiornoTorneo);
router.put('/:id/giorni/:giornoId', authenticateToken, isAdmin, torneiController.updateGiornoTorneo);
router.delete('/:id/giorni/:giornoId', authenticateToken, isAdmin, torneiController.deleteGiornoTorneo);

// Gestione Risultati (Scorecard)
router.get('/:id/risultati', authenticateToken, isAdmin, torneiController.getRisultatiTorneoAdmin);
router.post('/:id/risultati', authenticateToken, isAdmin, torneiController.upsertRisultato);
router.delete('/:id/risultati/:risultatoId', authenticateToken, isAdmin, torneiController.deleteRisultato);

export default router;
