import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TipoMovimento, Prisma } from '@prisma/client';
import { computeSaldoFromMovimenti, MovimentoInput } from '../src/controllers/contabilitaController';

describe('Logica Contabile & Borsellino (computeSaldoFromMovimenti)', () => {
    it('deve calcolare saldo zero per una lista vuota di movimenti', () => {
        const saldo = computeSaldoFromMovimenti([]);
        assert.equal(saldo.toNumber(), 0);
    });

    it('deve incrementare il saldo con movimenti di tipo RICARICA', () => {
        const movimenti: MovimentoInput[] = [
            { tipo: TipoMovimento.RICARICA, importo: 50.00 },
            { tipo: TipoMovimento.RICARICA, importo: '25.50' },
        ];
        const saldo = computeSaldoFromMovimenti(movimenti);
        assert.equal(saldo.toNumber(), 75.50);
    });

    it('deve decrementare il saldo per ISCRIZIONE_TORNEO, ADDEBITO_MANUALE e ACQUISTO_MAGLIA', () => {
        const movimenti: MovimentoInput[] = [
            { tipo: TipoMovimento.RICARICA, importo: 100.00 },
            { tipo: TipoMovimento.ISCRIZIONE_TORNEO, importo: 30.00 },
            { tipo: TipoMovimento.ACQUISTO_MAGLIA, importo: 25.00 },
            { tipo: TipoMovimento.ADDEBITO_MANUALE, importo: 10.00 },
        ];
        const saldo = computeSaldoFromMovimenti(movimenti);
        assert.equal(saldo.toNumber(), 35.00);
    });

    it('non deve alterare il saldo per movimenti di tipo RIMBORSO (spese cassa associazione)', () => {
        const movimenti: MovimentoInput[] = [
            { tipo: TipoMovimento.RICARICA, importo: 50.00 },
            { tipo: TipoMovimento.RIMBORSO, importo: 40.00 },
        ];
        const saldo = computeSaldoFromMovimenti(movimenti);
        assert.equal(saldo.toNumber(), 50.00);
    });

    it('deve gestire correttamente importi negativi passati in input usando valore assoluto', () => {
        const movimenti: MovimentoInput[] = [
            { tipo: TipoMovimento.RICARICA, importo: -50.00 },
            { tipo: TipoMovimento.ISCRIZIONE_TORNEO, importo: -20.00 },
        ];
        const saldo = computeSaldoFromMovimenti(movimenti);
        assert.equal(saldo.toNumber(), 30.00);
    });

    it('deve preservare la precisione decimale esatta senza errori floating point IEEE 754', () => {
        const movimenti: MovimentoInput[] = [
            { tipo: TipoMovimento.RICARICA, importo: 0.1 },
            { tipo: TipoMovimento.RICARICA, importo: 0.2 },
        ];
        const saldo = computeSaldoFromMovimenti(movimenti);
        assert.equal(saldo.toString(), '0.3');
    });
});
