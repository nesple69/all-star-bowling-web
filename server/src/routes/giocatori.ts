import { Router } from 'express';
import { body } from 'express-validator';
import * as giocatoriController from '../controllers/giocatoriController';
import { authenticateToken, isAdmin, optionalAuthenticate } from '../middleware/auth';

const router = Router();

// Endpoint di lettura (supportano autenticazione opzionale per dati aggiuntivi autorizzati)
router.get('/', optionalAuthenticate, giocatoriController.getAllGiocatori);
router.get('/stats', giocatoriController.getGiocatoriStats);
router.get('/:id', optionalAuthenticate, giocatoriController.getGiocatoreById);

// Endpoint riservati agli ADMIN
router.post(
    '/',
    authenticateToken,
    isAdmin,
    [
        body('email').isEmail().withMessage('Email valida richiesta'),
        body('nome').notEmpty().withMessage('Nome richiesto'),
        body('cognome').notEmpty().withMessage('Cognome richiesto'),
        body('dataNascita').isISO8601().withMessage('Data di nascita valida richiesta'),
        body('categoria').notEmpty().withMessage('Categoria richiesta')
    ],
    giocatoriController.createGiocatore
);

router.put(
    '/:id',
    authenticateToken,
    isAdmin,
    giocatoriController.updateGiocatore
);

router.patch(
    '/:id/toggle-attivo',
    authenticateToken,
    isAdmin,
    giocatoriController.toggleStatoAttivo
);

router.patch(
    '/:id/registra-sollecito-certificato',
    authenticateToken,
    isAdmin,
    giocatoriController.registraSollecitoCertificato
);

router.delete(
    '/:id',
    authenticateToken,
    isAdmin,
    giocatoriController.deleteGiocatore
);

export default router;
