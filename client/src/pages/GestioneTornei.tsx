import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import {
    Trophy, Plus, Edit2, Trash2, Calendar,
    MapPin, Settings, AlertCircle, Users, ChevronUp,
    CheckCircle2, XCircle, MessageCircle, Save, X, Pencil, Download, UserCheck, Search, FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Torneo {
    id: string;
    nome: string;
    tipologia: string;
    sede: string;
    dataInizio: string;
    dataFine: string | null;
    completato: boolean;
    costoIscrizione: number;
    locandina?: string | null;
    stagione: {
        nome: string;
    };
    _count: {
        iscrizioni: number;
        risultati: number;
    };
}

interface Iscrizione {
    id: string;
    stato: string;
    note: string | null;
    createdAt: string;
    giocatore: {
        id: string;
        nome: string;
        cognome: string;
        telefono: string | null;
        sesso: string;
        categoria: string;
    };
    turno: {
        id: string;
        giorno: string;
        orarioInizio: string;
        postiDisponibili: number;
        sede?: { id: string; nome: string } | null;
    };
    secondoTurno?: {
        id: string;
        giorno: string;
        orarioInizio: string;
    } | null;
    sede?: {
        id: string;
        nome: string;
    } | null;
    torneo: {
        sede: string;
    };
}

interface DisponibilitaTurno {
    id: string;
    giorno: string;
    orarioInizio: string;
    postiDisponibili: number;
}

const STATO_COLORS: Record<string, string> = {
    PENDENTE: 'bg-amber-100 text-amber-700',
    CONFERMATA: 'bg-green-100 text-green-700',
    MODIFICATA: 'bg-blue-100 text-blue-700',
    RIFIUTATA: 'bg-red-100 text-red-700',
};

const STATO_LABELS: Record<string, string> = {
    PENDENTE: 'Pendente',
    CONFERMATA: 'Confermata',
    MODIFICATA: 'Modificata',
    RIFIUTATA: 'Rifiutata',
};

const buildWhatsAppLink = (telefono: string | null, messaggio: string): string | null => {
    if (!telefono) return null;
    const cleaned = telefono.replace(/\D/g, '');
    const numero = cleaned.startsWith('39') ? cleaned : `39${cleaned}`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(messaggio)}`;
};

const GestioneTornei: React.FC = () => {
    const [selectedStagione, setSelectedStagione] = useState('');

    // Pannello iscrizioni espandibile
    const [expandedTorneo, setExpandedTorneo] = useState<string | null>(null);
    const [iscrizioni, setIscrizioni] = useState<Iscrizione[]>([]);
    const [turniTorneo, setTurniTorneo] = useState<DisponibilitaTurno[]>([]);
    const [loadingIscrizioni, setLoadingIscrizioni] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [modificaTurnoId, setModificaTurnoId] = useState<Record<string, string>>({});

    // --- Stagioni Logic ---
    const [showStagioneModal, setShowStagioneModal] = useState(false);
    const [editingStagioneId, setEditingStagioneId] = useState<string | null>(null);
    const [newStagione, setNewStagione] = useState({
        nome: '',
        dataInizio: format(new Date(), 'yyyy-MM-dd'),
        dataFine: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
        attiva: false
    });
    const [statusStagione, setStatusStagione] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    // --- Rinnovi Squadra Modal State ---
    const [showRinnoviModal, setShowRinnoviModal] = useState(false);
    const [giocatoriRinnovo, setGiocatoriRinnovo] = useState<any[]>([]);
    const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
    const [sentWhatsAppMap, setSentWhatsAppMap] = useState<Record<string, boolean>>({});
    const [searchRinnovi, setSearchRinnovi] = useState('');
    const [isLoadingRinnovi, setIsLoadingRinnovi] = useState(false);
    const [isSavingRinnovi, setIsSavingRinnovi] = useState(false);

    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const calculateQuotaRinnovo = (g: any) => {
        let saldoNum = 0;
        if (typeof g.saldo === 'number') {
            saldoNum = g.saldo;
        } else if (g.saldo && typeof g.saldo.saldoAttuale !== 'undefined') {
            saldoNum = Number(g.saldo.saldoAttuale);
        }
        const quotaAffiliazione = 60;
        const targetBorsellino = 50;
        const quotaBorsellino = Math.max(0, targetBorsellino - saldoNum);
        const totale = quotaAffiliazione + quotaBorsellino;
        return { saldoNum, quotaAffiliazione, quotaBorsellino, totale };
    };

    const generateWhatsAppRenewalMessage = (g: any, isRenewing: boolean) => {
        const { saldoNum, quotaBorsellino, totale } = calculateQuotaRinnovo(g);
        const saldoFormat = Math.abs(saldoNum).toFixed(2).replace('.', ',');
        const quotaBorsellinoFormat = quotaBorsellino.toFixed(2).replace('.', ',');
        const totaleFormat = totale.toFixed(2).replace('.', ',');

        if (isRenewing) {
            // Messaggio per chi RINNOVA
            return `Ciao *${g.nome}*! ⭐

È tempo di ripartire con la nuova stagione agonistica *2026/2027* con l'All Star Team! 🎳

Per confermare il tuo tesseramento, ti chiediamo di effettuare un versamento complessivo di *${totaleFormat} €*, così suddiviso:

🔹 *60,00 €*: Quota affiliazione e tesseramento stagione 2026/27
🔹 *${quotaBorsellinoFormat} €*: Integrazione fondo gare/tornei _(il tuo saldo attuale nel borsellino è di ${saldoNum.toFixed(2).replace('.', ',')} €)_

🏦 *DATI PER IL BONIFICO:*
• *IBAN:* IT63G0503470951000000001300
• *Beneficiario:* ASD All Star Team
• *Importo:* *${totaleFormat} €*
• *Causale:* Tesseramento stagione agonistica 2026/27 - ${g.cognome} ${g.nome}

Appena effettuato il bonifico, inviaci pure la ricevuta/contabile qui su WhatsApp.
Grazie e in bocca al lupo per la nuova stagione! 🏆`;
        } else {
            // Messaggio per chi NON RINNOVA (Chiusura & Rimborso / Pareggio / Debito)
            if (saldoNum > 0) {
                return `Ciao *${g.nome}*! ⭐

Ti ringraziamo per il percorso sportivo condiviso con l'All Star Team nella passata stagione agonistica! 🎳

Avendo preso nota che non rinnoverai il tesseramento per la stagione *2026/2027*, ti comunichiamo che provvederemo al più presto a rimborsarti la quota residua presente nel tuo borsellino elettronico pari a *${saldoFormat} €* e a chiudere la tua posizione contabile.

Per procedere con il bonifico di rimborso a tuo favore, ti chiediamo cortesemente di comunicarci qui su WhatsApp:
• Il tuo codice *IBAN*
• L'intestatario del conto corrente

Grazie ancora di tutto e ti auguriamo il meglio per il tuo futuro sportivo e personale! 🏆
ASD All Star Team`;
            } else if (saldoNum < 0) {
                return `Ciao *${g.nome}*! ⭐

In merito alla chiusura della tua posizione con l'All Star Team per la stagione 2026/2027, ti ricordiamo che risulta un saldo contabile a debito di *${saldoFormat} €* da regolarizzare per poter chiudere la scheda socio.

🏦 *DATI PER IL BONIFICO:*
• *IBAN:* IT63G0503470951000000001300
• *Beneficiario:* ASD All Star Team
• *Importo:* *${saldoFormat} €*
• *Causale:* Saldo chiusura contabile - ${g.cognome} ${g.nome}

Appena effettuato il versamento, inviaci pure la contabile qui su WhatsApp.
Grazie per la collaborazione!
ASD All Star Team`;
            } else {
                return `Ciao *${g.nome}*! ⭐

Ti ringraziamo per il percorso sportivo condiviso con l'All Star Team nella passata stagione agonistica! 🎳

Avendo preso nota che non rinnoverai il tesseramento per la stagione *2026/2027*, ti confermiamo che la tua posizione contabile risulta regolarmente chiusa e in perfetto pareggio (saldo 0,00 €).

Grazie ancora di tutto e ti auguriamo il meglio per il tuo futuro sportivo e personale! 🏆
ASD All Star Team`;
            }
        }
    };

    const handleSendWhatsAppRenewal = (e: React.MouseEvent, g: any, isRenewing: boolean) => {
        e.stopPropagation();
        if (!g.telefono) {
            alert(`Nessun numero di telefono registrato per ${g.cognome} ${g.nome}. Aggiorna la scheda giocatore per inserirlo.`);
            return;
        }
        const msg = generateWhatsAppRenewalMessage(g, isRenewing);
        const cleaned = g.telefono.replace(/\D/g, '');
        const numero = cleaned.startsWith('39') ? cleaned : `39${cleaned}`;
        const url = `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        setSentWhatsAppMap(prev => ({ ...prev, [g.id]: true }));
    };

    const handleOpenRinnoviModal = async () => {
        setIsLoadingRinnovi(true);
        setShowRinnoviModal(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/giocatori`, { headers });
            const list: any[] = res.data;
            setGiocatoriRinnovo(list);
            const map: Record<string, boolean> = {};
            list.forEach(g => {
                map[g.id] = g.attivo !== false;
            });
            setSelectedMap(map);
        } catch (err: any) {
            alert('Errore nel caricamento dei giocatori.');
        } finally {
            setIsLoadingRinnovi(false);
        }
    };

    const handleSaveRinnovi = async () => {
        setIsSavingRinnovi(true);
        try {
            const rinnovatiIds: string[] = [];
            const nonRinnovatiIds: string[] = [];

            giocatoriRinnovo.forEach(g => {
                if (selectedMap[g.id]) {
                    rinnovatiIds.push(g.id);
                } else {
                    nonRinnovatiIds.push(g.id);
                }
            });

            await axios.post(`${API_BASE_URL}/api/stagioni/rinnovi-bulk`, {
                rinnovatiIds,
                nonRinnovatiIds
            }, { headers });

            alert(`✅ Rinnovi confermati con successo!\n\n• ${rinnovatiIds.length} Atleti Attivi in Rosa\n• ${nonRinnovatiIds.length} Atleti Archiviati nello Storico.`);
            setShowRinnoviModal(false);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Errore nel salvataggio dei rinnovi.');
        } finally {
            setIsSavingRinnovi(false);
        }
    };

    const handleSelectAllRinnovi = (value: boolean) => {
        const newMap = { ...selectedMap };
        giocatoriRinnovo.forEach(g => {
            newMap[g.id] = value;
        });
        setSelectedMap(newMap);
    };

    const filteredGiocatoriRinnovo = giocatoriRinnovo.filter(g => {
        const text = `${g.nome} ${g.cognome} ${g.numeroTessera || ''}`.toLowerCase();
        return text.includes(searchRinnovi.toLowerCase());
    });

    const fetchTorneiData = async () => {
        if (!token) throw new Error('Sessione scaduta. Effettua nuovamente il login.');
        const url = selectedStagione ? `${API_BASE_URL}/api/tornei?stagioneId=${selectedStagione}` : `${API_BASE_URL}/api/tornei`;
        const response = await axios.get(url, { headers });
        return response.data as Torneo[];
    };

    const fetchStagioniData = async () => {
        const res = await axios.get(`${API_BASE_URL}/api/stagioni`);
        return res.data as any[];
    };

    const { data: stagioni = [], refetch: fetchStagioni } = useQuery({
        queryKey: ['stagioni'],
        queryFn: fetchStagioniData,
    });

    const { data: tornei = [], isLoading, error: queryError, refetch: refetchTornei } = useQuery({
        queryKey: ['adminTornei', selectedStagione],
        queryFn: fetchTorneiData,
        enabled: !!token,
        retry: false
    });

    const error = queryError ?
        ((queryError as any).response?.status === 401 ? 'Sessione scaduta. Effettua nuovamente il login.' : 'Impossibile caricare la lista dei tornei.')
        : '';

    useEffect(() => {
        if (stagioni.length > 0 && !selectedStagione) {
            const stagioneAttiva = stagioni.find((s: any) => s.attiva);
            if (stagioneAttiva) {
                setSelectedStagione(stagioneAttiva.id);
            }
        }
    }, [stagioni, selectedStagione]);

    const handleOpenEditStagione = (stagione: any) => {
        setEditingStagioneId(stagione.id);
        setNewStagione({
            nome: stagione.nome,
            dataInizio: format(new Date(stagione.dataInizio), 'yyyy-MM-dd'),
            dataFine: format(new Date(stagione.dataFine), 'yyyy-MM-dd'),
            attiva: stagione.attiva
        });
        setShowStagioneModal(true);
    };

    const handleCreateStagione = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingStagioneId) {
                // Modifica
                await axios.put(`${API_BASE_URL}/api/stagioni/${editingStagioneId}`, newStagione, { headers });
                setStatusStagione({ type: 'success', message: 'Stagione aggiornata!' });
            } else {
                // Creazione
                await axios.post(`${API_BASE_URL}/api/stagioni`, newStagione, { headers });
                setStatusStagione({ type: 'success', message: 'Stagione creata!' });
            }
            setNewStagione({
                nome: '',
                dataInizio: format(new Date(), 'yyyy-MM-dd'),
                dataFine: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
                attiva: false
            });
            setEditingStagioneId(null);
            setTimeout(() => {
                setShowStagioneModal(false);
                setStatusStagione({ type: null, message: '' });
            }, 1000);
            fetchStagioni();
        } catch (err: any) {
            setStatusStagione({ type: 'error', message: err.response?.data?.message || 'Errore.' });
        }
    };

    const handleDeleteStagione = async (id: string, nome: string) => {
        // Doppia conferma
        if (!window.confirm(`⚠️ ATTENZIONE: Eliminare la stagione "${nome}"?\n\nQuesta azione eliminerà anche tutti i tornei associati!`)) return;
        if (!window.confirm(`🚨 CONFERMA DEFINITIVA: Sei assolutamente sicuro di voler eliminare la stagione "${nome}" e TUTTI i suoi tornei?\n\nQuesta operazione è IRREVERSIBILE!`)) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/stagioni/${id}`, { headers });
            // Se la stagione eliminata era quella selezionata, resetta il filtro
            if (selectedStagione === id) {
                setSelectedStagione('');
            }
            await fetchStagioni();
            await refetchTornei();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Errore nell\'eliminazione.');
        }
    };

    const handleSetAttiva = async (stagione: any) => {
        try {
            await axios.put(`${API_BASE_URL}/api/stagioni/${stagione.id}`, {
                ...stagione,
                attiva: true
            }, { headers });
            await fetchStagioni();
            alert(`✅ La stagione "${stagione.nome}" è ora la stagione ATTIVA su tutto il portale per tutti gli utenti!`);
        } catch (err: any) {
            alert(err.response?.data?.message || "Errore durante l'attivazione della stagione.");
        }
    };

    const handleDownloadBackup = async (stagioneId: string, stagioneName: string) => {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/backup/genera/${stagioneId}`,
                {
                    headers,
                    responseType: 'blob'
                }
            );

            // Crea link temporaneo e triggera il download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `backup-${stagioneName}-${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            alert('✅ Backup PDF scaricato!');
        } catch (err: any) {
            alert('❌ Errore nel download del backup.');
        }
    };


    // --- Eliminazione e Tornei ---

    const handleDelete = async (id: string, nome: string) => {
        if (!window.confirm(`Sei sicuro di voler eliminare il torneo "${nome}"? Questa azione eliminerà anche tutti i turni associati.`)) {
            return;
        }
        try {
            await axios.delete(`${API_BASE_URL}/api/tornei/${id}`, { headers });
            await refetchTornei();
        } catch (err) {
            alert('Errore durante l\'eliminazione del torneo.');
        }
    };

    // --- Iscrizioni ---
    const toggleIscrizioni = async (torneoId: string) => {
        if (expandedTorneo === torneoId) {
            setExpandedTorneo(null);
            return;
        }

        setExpandedTorneo(torneoId);
        setLoadingIscrizioni(true);

        try {
            const [resIscr, resDisp] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/tornei/${torneoId}/iscrizioni`, { headers }),
                axios.get(`${API_BASE_URL}/api/tornei/public/${torneoId}/disponibilita`)
            ]);
            setIscrizioni(resIscr.data);
            setTurniTorneo(resDisp.data.map((d: any) => ({
                id: d.id,
                giorno: d.giorno,
                orarioInizio: d.orarioInizio,
                postiDisponibili: d.postiTotali
            })));
        } catch (err) {
            console.error('Errore nel caricamento iscrizioni:', err);
        } finally {
            setLoadingIscrizioni(false);
        }
    };

    const reloadIscrizioni = async (torneoId: string) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/tornei/${torneoId}/iscrizioni`, { headers });
            setIscrizioni(res.data);
            await refetchTornei();
        } catch (err) {
            console.error('Errore ricaricamento iscrizioni:', err);
        }
    };

    const handleStato = async (iscrizioneId: string, stato: string, torneo: Torneo) => {
        setActionLoading(iscrizioneId);
        try {
            await axios.patch(`${API_BASE_URL}/api/tornei/iscrizioni/${iscrizioneId}/stato`, { stato }, { headers });
            await reloadIscrizioni(torneo.id);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Errore nell\'aggiornamento.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleModificaTurno = async (iscrizioneId: string, nuovoTurnoId: string, torneo: Torneo, iscrizione: Iscrizione) => {
        if (!nuovoTurnoId || nuovoTurnoId === iscrizione.turno.id) return;

        setActionLoading(iscrizioneId);
        try {
            await axios.put(`${API_BASE_URL}/api/tornei/iscrizioni/${iscrizioneId}`, {
                turnoId: nuovoTurnoId
            }, { headers });
            await reloadIscrizioni(torneo.id);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Errore nella modifica.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancella = async (iscrizioneId: string, torneo: Torneo, iscrizione: Iscrizione) => {
        if (!window.confirm(`Cancellare l'iscrizione di ${iscrizione.giocatore.cognome} ${iscrizione.giocatore.nome}? Se prevista, la quota sarà rimborsata.`)) return;

        setActionLoading(iscrizioneId);
        try {
            await axios.delete(`${API_BASE_URL}/api/tornei/iscrizioni/${iscrizioneId}`, { headers });
            await reloadIscrizioni(torneo.id);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Errore nella cancellazione.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDownloadIscrizioni = (torneo: Torneo, iscrizioni: Iscrizione[]) => {
        const attive = iscrizioni.filter(i => i.stato !== 'RIFIUTATA');

        // Group by giorno then by sede
        const byGiorno: Record<string, Record<string, Iscrizione[]>> = {};
        attive.forEach(iscr => {
            const giornoRaw = iscr.turno?.giorno?.substring(0, 10) || 'Data Sconosciuta';
            const giornoDate = new Date(giornoRaw + 'T12:00:00');
            const giornoLabel = giornoDate.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
            const sedeLabel = iscr.sede?.nome || torneo.sede;
            if (!byGiorno[giornoLabel]) byGiorno[giornoLabel] = {};
            if (!byGiorno[giornoLabel][sedeLabel]) byGiorno[giornoLabel][sedeLabel] = [];
            byGiorno[giornoLabel][sedeLabel].push(iscr);
        });

        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(torneo.nome, 14, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120);
        doc.text(`Prenotazioni Torneo — ${attive.length} iscritti totali — Estratto il ${format(new Date(), 'dd/MM/yyyy')}`, 14, 28);
        doc.setTextColor(40);

        let startY = 36;

        Object.entries(byGiorno).forEach(([giorno, sedi]) => {
            // Day header
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            if (startY > 270) { doc.addPage(); startY = 15; }
            doc.setFillColor(30, 64, 175);
            doc.roundedRect(10, startY, 190, 9, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(giorno.toUpperCase(), 14, startY + 6.5);
            doc.setTextColor(40);
            startY += 13;

            Object.entries(sedi).forEach(([sede, iscrizioniGruppo]) => {
                if (startY > 270) { doc.addPage(); startY = 15; }
                // Sede sub-header
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(217, 119, 6);
                doc.text(`📍 ${sede.toUpperCase()} (${iscrizioniGruppo.length} atleti)`, 14, startY);
                doc.setTextColor(40);
                startY += 5;

                const rows = iscrizioniGruppo.map((iscr, idx) => [
                    String(idx + 1),
                    `${iscr.giocatore.cognome} ${iscr.giocatore.nome}`,
                    `${iscr.giocatore.sesso}/${iscr.giocatore.categoria}`,
                    iscr.giocatore.telefono || '-',
                    iscr.turno?.orarioInizio?.substring(11, 16) || '-',
                    STATO_LABELS[iscr.stato] || iscr.stato,
                ]);

                autoTable(doc, {
                    startY,
                    head: [['N°', 'Atleta', 'Sesso/Cat', 'Telefono', 'Orario', 'Stato']],
                    body: rows,
                    theme: 'striped',
                    headStyles: { fillColor: [30, 64, 175], fontSize: 8, fontStyle: 'bold' },
                    bodyStyles: { fontSize: 8 },
                    columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 18 }, 4: { cellWidth: 16 }, 5: { cellWidth: 22 } },
                    margin: { left: 10, right: 10 },
                });

                startY = (doc as any).lastAutoTable.finalY + 8;
            });

            startY += 4;
        });

        doc.save(`Prenotazioni_${torneo.nome.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in text-dark">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-3xl font-black font-heading uppercase tracking-tight flex items-center gap-3">
                        <Settings className="text-primary w-8 h-8" />
                        Gestione Tornei
                    </h1>
                    <p className="text-gray-500 mt-1 font-medium">Configura eventi, turni, iscrizioni e risultati ufficiali.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <select
                        className="bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20"
                        value={selectedStagione}
                        onChange={(e) => setSelectedStagione(e.target.value)}
                    >
                        <option value="">Seleziona stagione</option>
                        {stagioni.map(s => (
                            <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleOpenRinnoviModal}
                        className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white font-black px-5 py-3 rounded-xl shadow-lg hover:shadow-green-600/20 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest cursor-pointer"
                    >
                        <UserCheck className="w-4 h-4" />
                        Rinnovi Squadra
                    </button>

                    <button
                        onClick={() => setShowStagioneModal(true)}
                        className="flex-1 md:flex-none bg-primary hover:bg-primary/90 text-white font-black px-5 py-3 rounded-xl shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest cursor-pointer"
                    >
                        <Calendar className="w-4 h-4" />
                        Aggiungi Stagione
                    </button>

                    <Link
                        to="/admin/tornei/nuovo"
                        className="flex-1 md:flex-none bg-secondary hover:bg-secondary/90 text-white font-black px-6 py-3 rounded-xl shadow-lg hover:shadow-secondary/20 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                    >
                        <Plus className="w-4 h-4" />
                        Nuovo Torneo
                    </Link>
                </div>
            </div>

            {/* Modal Creazione Stagione */}
            {showStagioneModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dark/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-zoom-in border-4 border-primary">
                        {/* Header Modal */}
                        <div className="bg-primary p-6 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-6 h-6" />
                                <h2 className="text-xl font-black uppercase tracking-tight">
                                    {editingStagioneId ? 'Modifica Stagione' : 'Nuova Stagione Agonistica'}
                                </h2>
                            </div>
                            <button onClick={() => {
                                setShowStagioneModal(false);
                                setEditingStagioneId(null);
                                setNewStagione({
                                    nome: '',
                                    dataInizio: format(new Date(), 'yyyy-MM-dd'),
                                    dataFine: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
                                    attiva: false
                                });
                            }} className="hover:rotate-90 transition-transform">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateStagione} className="p-8 space-y-6">
                            {statusStagione.message && (
                                <div className={`p-4 rounded-xl flex items-center gap-3 ${statusStagione.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {statusStagione.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                    <p className="text-sm font-bold uppercase">{statusStagione.message}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nome Stagione (es. 2025/2026)</label>
                                    <input
                                        required
                                        value={newStagione.nome}
                                        onChange={e => setNewStagione({ ...newStagione, nome: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                        placeholder="Inserisci nome..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Inizio</label>
                                    <input
                                        type="date"
                                        required
                                        value={newStagione.dataInizio}
                                        onChange={e => setNewStagione({ ...newStagione, dataInizio: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Fine</label>
                                    <input
                                        type="date"
                                        required
                                        value={newStagione.dataFine}
                                        onChange={e => setNewStagione({ ...newStagione, dataFine: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold"
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-primary/30 transition-all">
                                <input
                                    type="checkbox"
                                    checked={newStagione.attiva}
                                    onChange={e => setNewStagione({ ...newStagione, attiva: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-[10px] font-black uppercase text-gray-500">Imposta come stagione attiva immediatamente</span>
                            </label>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => {
                                    setShowStagioneModal(false);
                                    setEditingStagioneId(null);
                                    setNewStagione({
                                        nome: '',
                                        dataInizio: format(new Date(), 'yyyy-MM-dd'),
                                        dataFine: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), 'yyyy-MM-dd'),
                                        attiva: false
                                    });
                                }} className="flex-1 px-6 py-4 font-black uppercase text-xs text-gray-400 hover:text-dark transition-colors tracking-widest">
                                    Annulla
                                </button>
                                <button type="submit" className="flex-[2] bg-primary text-white font-black px-8 py-4 rounded-2xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                                    <Save className="w-5 h-5" />
                                    {editingStagioneId ? 'Salva Modifiche' : 'Salva Nuova Stagione'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Indicatore Stagione Corrente */}
            {selectedStagione && (() => {
                const stagioneCorrente = stagioni.find(s => s.id === selectedStagione);
                return stagioneCorrente ? (
                    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-l-4 border-primary p-4 rounded-xl flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-primary" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stagione in visualizzazione</p>
                                <h3 className="text-lg font-black uppercase text-dark">{stagioneCorrente.nome}</h3>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-xs font-bold text-gray-500">
                                    {format(new Date(stagioneCorrente.dataInizio), 'dd/MM/yy')} - {format(new Date(stagioneCorrente.dataFine), 'dd/MM/yy')}
                                </p>
                                {stagioneCorrente.attiva ? (
                                    <span className="inline-block mt-1 bg-green-500 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase">Attiva</span>
                                ) : (
                                    <button
                                        onClick={() => handleSetAttiva(stagioneCorrente)}
                                        className="inline-block mt-1 bg-amber-100 hover:bg-green-600 text-amber-900 hover:text-white border border-amber-300 text-[8px] font-black px-2 py-0.5 rounded uppercase transition-all cursor-pointer shadow-sm"
                                        title="Imposta questa stagione come Attiva per tutto il sito"
                                    >
                                        ⭐ Rendi Attiva
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleOpenRinnoviModal}
                                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    title="Gestisci rinnovi giocatori per questa stagione"
                                >
                                    <UserCheck className="w-4 h-4" />
                                    Rinnovi Squadra
                                </button>
                                <button
                                    onClick={() => handleDownloadBackup(stagioneCorrente.id, stagioneCorrente.nome)}
                                    className="p-2 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white rounded-lg transition-all"
                                    title="Scarica Backup PDF"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleOpenEditStagione(stagioneCorrente)}
                                    className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all"
                                    title="Modifica Stagione"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDeleteStagione(stagioneCorrente.id, stagioneCorrente.nome)}
                                    className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                    title="Elimina Stagione"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null;
            })()}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-bold uppercase">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {tornei.length > 0 ? (
                    tornei.map((torneo) => (
                        <div key={torneo.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-primary/20 transition-colors group">
                            <div className="flex flex-col lg:flex-row">
                                {/* Status Flag */}
                                <div className={`w-2 ${torneo.completato ? 'bg-green-500' : 'bg-amber-400'}`}></div>

                                <div className="flex-1 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div className="space-y-2 max-w-xl text-dark">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-gray-100 text-gray-500 rounded">
                                                {torneo.stagione.nome}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${torneo.tipologia !== 'SINGOLO' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                                                {torneo.tipologia.replace('_', ' ')}
                                            </span>
                                            {torneo.completato && (
                                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                                    Completato
                                                </span>
                                            )}
                                            {torneo.locandina ? (
                                                <a
                                                    href={torneo.locandina.startsWith('http') ? torneo.locandina : `${API_BASE_URL}${torneo.locandina}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors flex items-center gap-1"
                                                    title="Visualizza Locandina"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <FileText className="w-3 h-3" />
                                                    Locandina
                                                </a>
                                            ) : (
                                                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-gray-50 text-gray-400 rounded border border-gray-100">
                                                    No Locandina
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-black uppercase group-hover:text-primary transition-colors">{torneo.nome}</h3>
                                        <div className="flex items-center gap-6 text-xs text-gray-400 font-bold uppercase">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {format(new Date(torneo.dataInizio), 'dd/MM/yy')}{torneo.dataFine ? ` - ${format(new Date(torneo.dataFine), 'dd/MM/yy')}` : ''}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {torneo.sede}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 px-6 lg:border-x border-gray-100">
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Iscritti</p>
                                            <p className="text-xl font-black">{torneo._count.iscrizioni}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Risultati</p>
                                            <p className="text-xl font-black">{torneo._count.risultati}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Iscrizioni Toggle */}
                                        <button
                                            onClick={() => toggleIscrizioni(torneo.id)}
                                            className={`p-2.5 rounded-xl transition-all shadow-sm ${expandedTorneo === torneo.id ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400 hover:bg-primary/10 hover:text-primary'}`}
                                            title="Gestisci Iscrizioni"
                                        >
                                            <Users className="w-5 h-5" />
                                        </button>
                                        <Link
                                            to={`/admin/tornei/${torneo.id}/risultati`}
                                            className="p-2.5 bg-gray-50 text-gray-400 hover:bg-secondary hover:text-white rounded-xl transition-all shadow-sm"
                                            title="Inserisci Risultati"
                                        >
                                            <Trophy className="w-5 h-5" />
                                        </Link>
                                        <Link
                                            to={`/admin/tornei/modifica/${torneo.id}`}
                                            className="p-2.5 bg-gray-50 text-gray-400 hover:bg-primary hover:text-white rounded-xl transition-all shadow-sm"
                                            title="Modifica Torneo"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(torneo.id, torneo.nome)}
                                            className="p-2.5 bg-gray-50 text-gray-400 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm"
                                            title="Elimina Torneo"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* --- Pannello Iscrizioni Espandibile --- */}
                            {expandedTorneo === torneo.id && (
                                <div className="border-t border-gray-100 bg-gray-50/50 p-6 space-y-4 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                            <Users className="w-4 h-4" />
                                            Iscrizioni ({iscrizioni.length})
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            {iscrizioni.length > 0 && (
                                                <button
                                                    onClick={() => handleDownloadIscrizioni(torneo, iscrizioni)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all text-[10px] font-black uppercase tracking-widest"
                                                    title="Scarica PDF Prenotazioni"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    PDF Prenotazioni
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setExpandedTorneo(null)}
                                                className="text-gray-400 hover:text-dark transition-colors"
                                            >
                                                <ChevronUp className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {loadingIscrizioni ? (
                                        <div className="flex justify-center py-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                                        </div>
                                    ) : iscrizioni.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">
                                            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm font-bold uppercase">Nessuna iscrizione per questo torneo</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Atleta</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Telefono</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Turno</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-amber-600">Sede</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stato</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</th>
                                                        <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Azioni</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {iscrizioni.map((iscr) => (
                                                        <tr key={iscr.id} className="hover:bg-white transition-colors">
                                                            {/* Atleta */}
                                                            <td className="px-4 py-3">
                                                                <p className="font-black text-sm uppercase">{iscr.giocatore.cognome} {iscr.giocatore.nome}</p>
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{iscr.giocatore.sesso}/{iscr.giocatore.categoria}</p>
                                                            </td>

                                                            {/* Telefono */}
                                                            <td className="px-4 py-3">
                                                                {iscr.giocatore.telefono ? (
                                                                    <span className="text-xs font-bold text-gray-500">{iscr.giocatore.telefono}</span>
                                                                ) : (
                                                                    <span className="text-xs text-gray-300 italic">N/D</span>
                                                                )}
                                                            </td>

                                                            {/* Turno */}
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-black text-white bg-primary px-1.5 py-0.5 rounded uppercase leading-none">1°</span>
                                                                            <p className="text-sm font-bold">
                                                                                {new Date((iscr.turno?.giorno?.substring(0, 10) || "2000-01-01") + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}  {iscr.turno?.orarioInizio?.substring(11, 16) || ""}
                                                                            </p>
                                                                        </div>
                                                                        {iscr.secondoTurno && (
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] font-black text-white bg-secondary px-1.5 py-0.5 rounded uppercase leading-none">R</span>
                                                                                <p className="text-[11px] text-gray-400 font-bold uppercase italic">
                                                                                    {new Date((iscr.secondoTurno?.giorno?.substring(0, 10) || "2000-01-01") + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}  {iscr.secondoTurno?.orarioInizio?.substring(11, 16) || ""}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {/* Modifica turno dropdown */}
                                                                    {iscr.stato !== 'RIFIUTATA' && turniTorneo.length > 1 && (
                                                                        <select
                                                                            className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 font-bold uppercase outline-none focus:ring-1 focus:ring-primary/30"
                                                                            value={modificaTurnoId[iscr.id] || iscr.turno.id}
                                                                            onChange={(e) => {
                                                                                const newVal = e.target.value;
                                                                                setModificaTurnoId(prev => ({ ...prev, [iscr.id]: newVal }));
                                                                                if (newVal !== iscr.turno.id) {
                                                                                    handleModificaTurno(iscr.id, newVal, torneo, iscr);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {turniTorneo.map(t => (
                                                                                <option key={t.id} value={t.id}>
                                                                                    {new Date((t?.giorno?.substring(0, 10) || "2000-01-01") + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })} {t?.orarioInizio?.substring(11, 16) || ""}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Sede */}
                                                            <td className="px-4 py-3">
                                                                <span 
                                                                    className={`text-[10px] font-black uppercase px-2 py-1 rounded border block max-w-[200px] truncate ${
                                                                        iscr.sede?.nome || iscr.turno?.sede?.nome 
                                                                            ? 'text-amber-600 bg-amber-50 border-amber-100' 
                                                                            : 'text-gray-500 bg-gray-100 border-gray-200'
                                                                    }`}
                                                                    title={iscr.sede?.nome || iscr.turno?.sede?.nome || iscr.torneo?.sede || torneo?.sede || '-'}
                                                                >
                                                                    {iscr.sede?.nome || iscr.turno?.sede?.nome || iscr.torneo?.sede || torneo?.sede || '-'}
                                                                </span>
                                                            </td>

                                                            {/* Stato */}
                                                            <td className="px-4 py-3">
                                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${STATO_COLORS[iscr.stato] || 'bg-gray-100 text-gray-500'}`}>
                                                                    {STATO_LABELS[iscr.stato] || iscr.stato}
                                                                </span>
                                                                {iscr.note && (
                                                                    <p className="text-[10px] text-gray-400 mt-1 italic max-w-[120px] truncate" title={iscr.note}>{iscr.note}</p>
                                                                )}
                                                            </td>

                                                            {/* Data */}
                                                            <td className="px-4 py-3">
                                                                <p className="text-[10px] text-gray-400 font-bold">
                                                                    {format(new Date(iscr.createdAt), 'dd/MM/yy HH:mm')}
                                                                </p>
                                                            </td>

                                                            {/* Azioni */}
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    {actionLoading === iscr.id ? (
                                                                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-primary"></div>
                                                                    ) : (
                                                                        <>
                                                                            {iscr.stato !== 'CONFERMATA' && iscr.stato !== 'RIFIUTATA' && (
                                                                                <button
                                                                                    onClick={() => handleStato(iscr.id, 'CONFERMATA', torneo)}
                                                                                    className="p-1.5 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white rounded-lg transition-all"
                                                                                    title="Accetta"
                                                                                >
                                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                            {iscr.stato !== 'RIFIUTATA' && (
                                                                                <button
                                                                                    onClick={() => handleStato(iscr.id, 'RIFIUTATA', torneo)}
                                                                                    className="p-1.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                                                                    title="Rifiuta"
                                                                                >
                                                                                    <XCircle className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                            {iscr.giocatore.telefono && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const link = buildWhatsAppLink(
                                                                                            iscr.giocatore.telefono,
                                                                                            `Ciao ${iscr.giocatore.nome}! Riguardo la tua iscrizione al torneo "${torneo.nome}": `
                                                                                        );
                                                                                        if (link) window.open(link, '_blank');
                                                                                    }}
                                                                                    className="p-1.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all"
                                                                                    title="Invia WhatsApp"
                                                                                >
                                                                                    <MessageCircle className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                onClick={() => handleCancella(iscr.id, torneo, iscr)}
                                                                                className="p-1.5 bg-gray-50 text-gray-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                                                                title="Elimina"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-100 text-dark">
                        <Trophy className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-400 uppercase tracking-tight">Nessun torneo configurato</h3>
                        <p className="text-sm text-gray-300 mt-1">Inizia creando il primo evento della stagione.</p>
                    </div>
                )}
            </div>

            {/* Modal Rinnovi Squadra */}
            {showRinnoviModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-gray-100 relative p-8 space-y-6 animate-slide-up text-dark">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-3">
                                <UserCheck className="w-7 h-7 text-green-600" />
                                <div>
                                    <h2 className="text-xl font-black uppercase text-dark">Rinnovi Squadra & Passaggio Stagione</h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                        Spunta gli atleti che proseguono l'attività nella nuova stagione.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowRinnoviModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-bold text-amber-800 space-y-1">
                            <p>💡 <strong>Come funziona la conservazione dello storico:</strong></p>
                            <p>Gli atleti deselezionati vengono impostati come <em>"Non Rinnovati / Storico"</em>: non compariranno nelle selezioni dei nuovi tornei, ma tutto il loro storico (gare, scorecard passate e cassa) rimarrà memorizzato e consultabile.</p>
                        </div>

                        {/* Search and Quick Filters */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca atleta..."
                                    value={searchRinnovi}
                                    onChange={e => setSearchRinnovi(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-primary"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSelectAllRinnovi(true)}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase rounded-xl transition-colors cursor-pointer"
                                >
                                    Seleziona Tutti
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelectAllRinnovi(false)}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-black uppercase rounded-xl transition-colors cursor-pointer"
                                >
                                    Deseleziona Tutti
                                </button>
                            </div>
                        </div>

                        {/* Lista Checklist Atleti */}
                        <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-2xl divide-y divide-gray-100">
                            {isLoadingRinnovi ? (
                                <div className="p-12 text-center text-gray-400 text-xs font-bold uppercase animate-pulse">
                                    Caricamento atleti...
                                </div>
                            ) : filteredGiocatoriRinnovo.map(g => {
                                const isChecked = !!selectedMap[g.id];
                                const { saldoNum, totale } = calculateQuotaRinnovo(g);
                                const isSent = !!sentWhatsAppMap[g.id];

                                return (
                                    <div
                                        key={g.id}
                                        onClick={() => setSelectedMap({ ...selectedMap, [g.id]: !isChecked })}
                                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-gray-50/80 cursor-pointer transition-colors ${
                                            isChecked ? 'bg-green-50/40' : 'bg-gray-50/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}}
                                                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                            />
                                            <div>
                                                <p className="text-sm font-black text-dark uppercase">{g.cognome} {g.nome}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">
                                                    Cat. {g.categoria} • Tessera: {g.numeroTessera || 'N/A'} {g.telefono ? `• 📞 ${g.telefono}` : '• ⚠️ No tel'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-3" onClick={e => e.stopPropagation()}>
                                            {/* Riepilogo Saldo e Quota Calcolata */}
                                            <div className="text-right">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase block">
                                                    Saldo: {saldoNum.toFixed(2)} €
                                                </span>
                                                <span className="text-xs font-black text-dark uppercase block">
                                                    {isChecked ? (
                                                        <>Totale: <strong className="text-primary">{totale.toFixed(2)} €</strong></>
                                                    ) : saldoNum > 0 ? (
                                                        <>Rimborso: <strong className="text-green-600">{saldoNum.toFixed(2)} €</strong></>
                                                    ) : saldoNum < 0 ? (
                                                        <>Debito: <strong className="text-red-600">{Math.abs(saldoNum).toFixed(2)} €</strong></>
                                                    ) : (
                                                        <span className="text-gray-400 font-bold">Chiuso (0 €)</span>
                                                    )}
                                                </span>
                                            </div>

                                            {/* Pulsante WhatsApp */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleSendWhatsAppRenewal(e, g, isChecked)}
                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                                                    isSent
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                                        : isChecked
                                                            ? 'bg-[#25D366] hover:bg-[#20ba5a] text-white hover:scale-105'
                                                            : saldoNum > 0
                                                                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
                                                                : 'bg-gray-600 hover:bg-gray-700 text-white hover:scale-105'
                                                }`}
                                                title={g.telefono ? `Invia messaggio WhatsApp a ${g.nome}` : 'Nessun telefono registrato'}
                                            >
                                                <MessageCircle className="w-3.5 h-3.5" />
                                                {isSent ? 'Inviato ✓' : isChecked ? 'WA Rinnovo' : saldoNum > 0 ? 'WA Rimborso' : 'WA Chiusura'}
                                            </button>

                                            {/* Badge Stato Rinnovo */}
                                            <span
                                                onClick={() => setSelectedMap({ ...selectedMap, [g.id]: !isChecked })}
                                                className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider cursor-pointer ${
                                                    isChecked ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                                                }`}
                                            >
                                                {isChecked ? 'Rinnova' : 'Non Rinnova'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <p className="text-xs font-bold text-gray-500">
                                Atleti selezionati: <strong className="text-green-600">{Object.values(selectedMap).filter(Boolean).length}</strong> su {giocatoriRinnovo.length}
                            </p>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowRinnoviModal(false)}
                                    className="px-6 py-2.5 rounded-xl text-xs font-black uppercase text-gray-400 hover:text-dark transition-colors tracking-wider"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveRinnovi}
                                    disabled={isSavingRinnovi}
                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-green-600/20 transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <Save className="w-4 h-4" />
                                    {isSavingRinnovi ? 'Salvataggio...' : 'Conferma Rinnovi'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestioneTornei;
