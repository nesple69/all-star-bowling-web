import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface BackupData {
    stagione: any;
    giocatori: any[];
    tornei: any[];
    movimentiContabili: any[];
}

export async function generaBackupPDF(stagioneId: string): Promise<Buffer> {
    // Recupera tutti i dati della stagione
    const data = await recuperaDatiStagione(stagioneId);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        aggiungiHeader(doc, data.stagione);

        // Sezione Giocatori
        aggiungiSezioneGiocatori(doc, data.giocatori);

        // Sezione Tornei
        aggiungiSezioneTornei(doc, data.tornei);

        // Sezione Contabilità
        aggiungiSezioneContabilita(doc, data.movimentiContabili);

        // Footer inline (su ultima pagina)
        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica').fillColor('gray');
        doc.text(
            `Documento generato il ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}`,
            { align: 'center' }
        );

        doc.end();
    });
}

async function recuperaDatiStagione(stagioneId: string): Promise<BackupData> {
    const stagione = await prisma.stagione.findUnique({
        where: { id: stagioneId },
    });

    if (!stagione) {
        throw new Error('Stagione non trovata');
    }

    // Giocatori attivi (tutti i giocatori che hanno partecipato a tornei della stagione)
    const tornei = await prisma.torneo.findMany({
        where: { stagioneId },
        include: {
            turni: {
                include: {
                    iscrizioni: {
                        include: {
                            giocatore: true,
                        },
                    },
                },
            },
            risultati: {
                include: {
                    giocatore: true,
                    partite: true,
                },
            },
        },
        orderBy: { dataInizio: 'asc' },
    });

    // Estrai giocatori univoci
    const giocatoriMap = new Map();
    tornei.forEach(torneo => {
        torneo.risultati.forEach(risultato => {
            if (risultato.giocatore && !giocatoriMap.has(risultato.giocatore.id)) {
                giocatoriMap.set(risultato.giocatore.id, risultato.giocatore);
            }
        });
    });

    const giocatori = Array.from(giocatoriMap.values());

    // Movimenti contabili della stagione
    const movimentiContabili = await prisma.movimentoContabile.findMany({
        where: {
            data: {
                gte: stagione.dataInizio,
                lte: stagione.dataFine,
            }
        },
        orderBy: { data: 'asc' },
    });

    return {
        stagione,
        giocatori,
        tornei,
        movimentiContabili,
    };
}

function aggiungiHeader(doc: PDFKit.PDFDocument, stagione: any) {
    doc.fontSize(20).font('Helvetica-Bold').text('BACKUP STAGIONE AGONISTICA', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).text(stagione.nome, { align: 'center' });
    doc.fontSize(10).font('Helvetica')
        .text(
            `Periodo: ${format(new Date(stagione.dataInizio), 'dd/MM/yyyy', { locale: it })} - ${format(new Date(stagione.dataFine), 'dd/MM/yyyy', { locale: it })}`,
            { align: 'center' }
        );

    if (stagione.attiva) {
        doc.fontSize(10).fillColor('green').text('STAGIONE ATTIVA', { align: 'center' });
        doc.fillColor('black');
    }

    doc.moveDown(2);
}

function aggiungiSezioneGiocatori(doc: PDFKit.PDFDocument, giocatori: any[]) {
    doc.fontSize(14).font('Helvetica-Bold').text('GIOCATORI ISCRITTI', { underline: true });
    doc.moveDown(0.5);

    if (giocatori.length === 0) {
        doc.fontSize(10).font('Helvetica-Oblique').text('Nessun giocatore registrato.');
        doc.font('Helvetica');
        doc.moveDown(2);
        return;
    }

    doc.fontSize(9).font('Helvetica');

    // Header tabella
    const startY = doc.y;
    const colWidths = { nome: 120, tessera: 80, categoria: 60, sesso: 40, certificato: 100 };
    let x = 50;

    doc.font('Helvetica-Bold');
    doc.text('Nome Cognome', x, startY, { width: colWidths.nome, continued: false });
    x += colWidths.nome;
    doc.text('Tessera', x, startY, { width: colWidths.tessera, continued: false });
    x += colWidths.tessera;
    doc.text('Cat.', x, startY, { width: colWidths.categoria, continued: false });
    x += colWidths.categoria;
    doc.text('M/F', x, startY, { width: colWidths.sesso, continued: false });
    x += colWidths.sesso;
    doc.text('Certificato Scad.', x, startY, { width: colWidths.certificato, continued: false });

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    // Righe
    doc.font('Helvetica');
    giocatori.forEach((g, index) => {
        if (doc.y > 700) {
            doc.addPage();
            doc.fontSize(9);
        }

        x = 50;
        const rowY = doc.y;

        doc.text(`${g.nome} ${g.cognome}`, x, rowY, { width: colWidths.nome, continued: false });
        x += colWidths.nome;
        doc.text(g.numeroTessera || 'N/A', x, rowY, { width: colWidths.tessera, continued: false });
        x += colWidths.tessera;
        doc.text(g.categoria || '-', x, rowY, { width: colWidths.categoria, continued: false });
        x += colWidths.categoria;
        doc.text(g.sesso || '-', x, rowY, { width: colWidths.sesso, continued: false });
        x += colWidths.sesso;
        doc.text(
            g.scadenzaCertificatoMedico
                ? format(new Date(g.scadenzaCertificatoMedico), 'dd/MM/yyyy', { locale: it })
                : 'N/A',
            x,
            rowY,
            { width: colWidths.certificato, continued: false }
        );

        doc.moveDown(0.7);
    });

    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Bold').text(`Totale Giocatori: ${giocatori.length}`);
    doc.moveDown(2);
}

function aggiungiSezioneTornei(doc: PDFKit.PDFDocument, tornei: any[]) {
    if (doc.y > 600) {
        doc.addPage();
    }

    doc.fontSize(14).font('Helvetica-Bold').text('TORNEI DELLA STAGIONE', { underline: true });
    doc.moveDown(0.5);

    if (tornei.length === 0) {
        doc.fontSize(10).font('Helvetica-Oblique').text('Nessun torneo organizzato.');
        doc.font('Helvetica');
        doc.moveDown(2);
        return;
    }

    doc.fontSize(9).font('Helvetica');

    tornei.forEach((torneo, index) => {
        if (doc.y > 680) {
            doc.addPage();
            doc.fontSize(9);
        }

        doc.font('Helvetica-Bold').fontSize(11).text(`${index + 1}. ${torneo.titolo}`);
        doc.font('Helvetica').fontSize(9);
        doc.text(`Data: ${format(new Date(torneo.dataInizio), 'dd/MM/yyyy', { locale: it })} | Luogo: ${torneo.luogo || 'N/A'}`);
        doc.text(`Tipologia: ${torneo.tipologia || 'N/A'} | Partecipanti: ${torneo.risultati.length}`);

        if (torneo.completato) {
            doc.fillColor('green').text('COMPLETATO', { continued: false });
            doc.fillColor('black');
        } else {
            doc.fillColor('orange').text('IN CORSO', { continued: false });
            doc.fillColor('black');
        }

        // Primi 3 classificati
        if (torneo.risultati.length > 0) {
            const classificati = torneo.risultati
                .sort((a: any, b: any) => (a.posizione || 999) - (b.posizione || 999))
                .slice(0, 3);

            doc.moveDown(0.3);
            doc.fontSize(8).text('Primi classificati:', { continued: false });
            classificati.forEach((r: any) => {
                if (r.giocatore) {
                    doc.text(
                        `  ${r.posizione}° - ${r.giocatore.nome} ${r.giocatore.cognome} (${r.totaleBirilli || 0} birilli, media: ${r.media?.toFixed(2) || 0})`,
                        { continued: false }
                    );
                }
            });
        }

        doc.moveDown(1);
    });

    doc.fontSize(10).font('Helvetica-Bold').text(`Totale Tornei: ${tornei.length}`);
    doc.moveDown(2);
}

function aggiungiSezioneContabilita(doc: PDFKit.PDFDocument, movimenti: any[]) {
    if (doc.y > 600) {
        doc.addPage();
    }

    doc.fontSize(14).font('Helvetica-Bold').text('MOVIMENTI CONTABILI', { underline: true });
    doc.moveDown(0.5);

    if (movimenti.length === 0) {
        doc.fontSize(10).font('Helvetica-Oblique').text('Nessun movimento registrato.');
        doc.font('Helvetica');
        doc.moveDown(2);
        return;
    }

    doc.fontSize(9).font('Helvetica');

    // Header tabella
    const startY = doc.y;
    const colWidths = { data: 70, tipo: 60, descrizione: 200, importo: 70 };
    let x = 50;

    doc.font('Helvetica-Bold');
    doc.text('Data', x, startY, { width: colWidths.data, continued: false });
    x += colWidths.data;
    doc.text('Tipo', x, startY, { width: colWidths.tipo, continued: false });
    x += colWidths.tipo;
    doc.text('Descrizione', x, startY, { width: colWidths.descrizione, continued: false });
    x += colWidths.descrizione;
    doc.text('Importo (€)', x, startY, { width: colWidths.importo, continued: false });

    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.3);

    // Righe
    doc.font('Helvetica');
    let totaleEntrate = 0;
    let totaleUscite = 0;

    movimenti.forEach((m) => {
        if (doc.y > 700) {
            doc.addPage();
            doc.fontSize(9);
        }

        x = 50;
        const rowY = doc.y;

        doc.text(format(new Date(m.data), 'dd/MM/yyyy', { locale: it }), x, rowY, { width: colWidths.data, continued: false });
        x += colWidths.data;
        doc.text(m.tipo, x, rowY, { width: colWidths.tipo, continued: false });
        x += colWidths.tipo;
        doc.text(m.descrizione || '-', x, rowY, { width: colWidths.descrizione, continued: false });
        x += colWidths.descrizione;

        const importo = parseFloat(m.importo?.toString() || '0');
        if (m.tipo === 'ENTRATA') {
            totaleEntrate += importo;
            doc.fillColor('green');
        } else {
            totaleUscite += importo;
            doc.fillColor('red');
        }
        doc.text(`${m.tipo === 'USCITA' ? '-' : '+'}€${importo.toFixed(2)}`, x, rowY, { width: colWidths.importo, continued: false });
        doc.fillColor('black');

        doc.moveDown(0.7);
    });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold');
    doc.fillColor('green').text(`Totale Entrate: €${totaleEntrate.toFixed(2)}`);
    doc.fillColor('red').text(`Totale Uscite: €${totaleUscite.toFixed(2)}`);
    doc.fillColor('black');
    const saldo = totaleEntrate - totaleUscite;
    doc.text(`Saldo: €${saldo.toFixed(2)}`, { underline: true });

    doc.moveDown(2);
}


export async function generaDatabaseDump(): Promise<{ filename: string; data: Buffer }> {
    // Questa funzione viene gestita tramite child_process nelle routes
    // Qui restituisco solo un placeholder
    throw new Error('Database dump deve essere gestito tramite routes con pg_dump');
}
