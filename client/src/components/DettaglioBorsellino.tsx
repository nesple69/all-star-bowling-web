import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import {
    X, CreditCard, ArrowUpCircle, ArrowDownCircle,
    History, Plus, Minus, Loader2, Edit2, Trash2, Send,
    FileDown, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import FormMovimento from './FormMovimento';

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.03 0C5.399 0 .007 5.391 0 12.026c0 2.119.554 4.188 1.606 6.01L0 24l6.117-1.605a11.803 11.803 0 005.917 1.6c6.625 0 12.014-5.391 12.018-12.027a11.82 11.82 0 00-3.518-8.508z" />
    </svg>
);

interface DettaglioBorsellinoProps {
    giocatore: {
        id: string;
        nome: string;
        cognome: string;
        numeroTessera: string;
        telefono?: string | null;
    };
    onClose: () => void;
    onUpdate: () => void;
}

const DettaglioBorsellino: React.FC<DettaglioBorsellinoProps> = ({ giocatore, onClose, onUpdate }) => {
    const { token } = useAuth();
    const [saldo, setSaldo] = useState<number | null>(null);
    const [movimenti, setMovimenti] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState<'ricarica' | 'addebito' | 'rimborso' | 'modifica' | null>(null);
    const [editingMovimento, setEditingMovimento] = useState<any | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [isExportingWA, setIsExportingWA] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Filtri per estratto conto
    const [filterPreset, setFilterPreset] = useState<'20' | 'attiva' | 'all' | 'custom'>('20');
    const [filterDataInizio, setFilterDataInizio] = useState<string>('');
    const [filterDataFine, setFilterDataFine] = useState<string>('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/giocatori/${giocatore.id}/borsellino`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSaldo(Number(res.data.saldo));
            setMovimenti(res.data.movimenti);
        } catch (error) {
            console.error('Errore recupero dati borsellino:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [giocatore.id]);

    const handleAction = async (data: { importo: number; tipo: string; descrizione: string; data: string }) => {
        setIsActionLoading(true);
        try {
            if (showForm === 'modifica' && editingMovimento) {
                await axios.put(`${API_BASE_URL}/api/contabilita/movimenti/${editingMovimento.id}`, data, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                const endpoint = showForm === 'ricarica' ? 'ricarica' : showForm === 'rimborso' ? 'rimborso' : 'addebito';
                await axios.post(`${API_BASE_URL}/api/contabilita/${endpoint}`, {
                    giocatoreId: giocatore.id,
                    ...data
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            setShowForm(null);
            setEditingMovimento(null);
            await fetchData();
            onUpdate(); // Notifica la pagina principale del cambiamento
        } catch (error) {
            console.error('Errore durante l\'operazione:', error);
            alert('Errore durante l\'operazione contabile.');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteMovimento = async (id: string) => {
        if (!window.confirm('Sei sicuro di voler eliminare questo movimento? Il saldo verrà ricalcolato.')) {
            return;
        }

        setIsActionLoading(true);
        try {
            await axios.delete(`${API_BASE_URL}/api/contabilita/movimenti/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchData();
            onUpdate();
        } catch (error) {
            console.error('Errore eliminazione movimento:', error);
            alert('Errore durante l\'eliminazione del movimento.');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleEditMovimento = (movimento: any) => {
        setEditingMovimento(movimento);
        setShowForm('modifica');
        setTimeout(() => {
            scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
    };

    const formatValuta = (valore: number | string) => {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(valore));
    };

    // Helper per recuperare i movimenti filtrati ed esportare il PDF
    const fetchFilteredMovimenti = async () => {
        const params: any = {};
        if (filterPreset === '20') {
            params.limit = '20';
        } else if (filterPreset === 'attiva') {
            params.soloAttiva = 'true';
        } else if (filterPreset === 'all') {
            params.limit = 'all';
        } else if (filterPreset === 'custom') {
            if (filterDataInizio) params.dataInizio = filterDataInizio;
            if (filterDataFine) params.dataFine = filterDataFine;
            params.limit = 'all';
        }

        const res = await axios.get(`${API_BASE_URL}/api/giocatori/${giocatore.id}/borsellino`, {
            params,
            headers: { Authorization: `Bearer ${token}` }
        });

        return res.data.movimenti || [];
    };

    const getPeriodoLabel = () => {
        if (filterPreset === '20') return 'degli ultimi 20 movimenti';
        if (filterPreset === 'attiva') return 'della stagione in corso';
        if (filterPreset === 'all') return 'di tutto lo storico movimenti';
        if (filterPreset === 'custom') {
            const da = filterDataInizio ? format(new Date(filterDataInizio), 'dd/MM/yyyy') : 'inizio';
            const a = filterDataFine ? format(new Date(filterDataFine), 'dd/MM/yyyy') : 'oggi';
            return `dal ${da} al ${a}`;
        }
        return 'estratto conto';
    };

    const generateAndDownloadPDF = async () => {
        const listaMovimenti = await fetchFilteredMovimenti();
        const periodoLabel = getPeriodoLabel();

        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.setTextColor(40);
        doc.text('Estratto Conto Borsellino', 14, 22);

        doc.setFontSize(13);
        doc.text(`Giocatore: ${giocatore.cognome} ${giocatore.nome}`, 14, 32);
        doc.text(`Tessera: ${giocatore.numeroTessera || 'N/D'}`, 14, 40);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Filtro periodo: ${periodoLabel.toUpperCase()}`, 14, 47);
        doc.text(`Data di emissione: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 53);

        if (listaMovimenti.length > 0) {
            const tableColumn = ["Data", "Tipo", "Descrizione", "Importo"];
            const tableRows = listaMovimenti.map((m: any) => {
                const dataFmt = format(new Date(m.data), 'dd/MM/yy HH:mm');
                const tipoFmt = m.tipo.replace('_', ' ');
                const descFmt = m.descrizione || '-';
                const isPositive = m.tipo === 'RICARICA';
                const isRimborso = m.tipo === 'RIMBORSO';
                const segno = isRimborso ? '+' : isPositive ? '+' : '-';
                const importoFmt = `${segno}${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(m.importo))}`;
                return [dataFmt, tipoFmt, descFmt, importoFmt];
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 60,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] }
            });
        } else {
            doc.setFontSize(11);
            doc.setTextColor(150);
            doc.text('Nessun movimento registrato nel periodo selezionato.', 14, 65);
        }

        const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 65;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");

        if (saldo !== null && saldo < 0) {
            doc.setTextColor(220, 38, 38);
        } else {
            doc.setTextColor(22, 163, 74);
        }
        doc.text(`Saldo Attuale Complessivo: ${formatValuta(saldo || 0)}`, 14, finalY + 15);

        const safeCognome = giocatore.cognome.replace(/\s+/g, '_');
        const safeNome = giocatore.nome.replace(/\s+/g, '_');
        const fileName = `Estratto_Conto_${safeCognome}_${safeNome}.pdf`;
        doc.save(fileName);

        return { listaMovimenti, periodoLabel };
    };

    const handleExportPDF = async () => {
        setIsExportingPDF(true);
        try {
            await generateAndDownloadPDF();
        } catch (error) {
            console.error('Errore esportazione PDF:', error);
            alert('Errore durante la creazione del file PDF.');
        } finally {
            setIsExportingPDF(false);
        }
    };

    const handleExportWhatsApp = async () => {
        const tel = giocatore.telefono;
        if (!tel) {
            alert('Numero di telefono non presente per questo giocatore.');
            return;
        }

        setIsExportingWA(true);
        try {
            const { periodoLabel } = await generateAndDownloadPDF();

            const telefonoPulito = tel.replace(/\D/g, '');
            const telefonoFormattato = telefonoPulito.startsWith('39') ? telefonoPulito : `39${telefonoPulito}`;
            const saldoFormatted = formatValuta(saldo || 0);

            let msg = `Ciao *${giocatore.nome}*! 🎳\nEcco il resoconto aggiornato del tuo *Borsellino Elettronico* (All Star Team):\n\n💰 *Saldo Attuale:* ${saldoFormatted}\n\n📎 *Ti inviamo in allegato a questo messaggio il documento PDF con il riepilogo dettagliato ${periodoLabel}.*\n`;

            if (saldo !== null && saldo < 0) {
                msg += `\n⚠️ Ti ricordiamo che il tuo saldo è attualmente in negativo. Ti chiediamo cortesemente di effettuare una ricarica.\n`;
            }

            msg += `\nPer qualsiasi chiarimento contatta la segreteria. ⭐`;

            const waUrl = `https://wa.me/${telefonoFormattato}?text=${encodeURIComponent(msg)}`;
            window.open(waUrl, '_blank');
        } catch (error) {
            console.error('Errore invio WhatsApp:', error);
            alert('Errore durante la generazione dell\'estratto conto.');
        } finally {
            setIsExportingWA(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl border border-gray-100 flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <CreditCard className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-dark uppercase tracking-tight">{giocatore.cognome} {giocatore.nome}</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tessera: {giocatore.numeroTessera || 'N/D'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {/* Saldo Attuale */}
                    <div className="text-center bg-gradient-to-br from-dark to-gray-800 p-8 rounded-3xl text-white shadow-xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Saldo Attuale</p>
                        <div className="text-5xl font-black tracking-tighter">
                            {isLoading ? (
                                <Loader2 className="w-10 h-10 animate-spin mx-auto opacity-20" />
                            ) : (
                                <span className={saldo !== null && saldo < 0 ? 'text-red-400' : 'text-green-400'}>
                                    {formatValuta(saldo || 0)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Bottoni Azione */}
                    {!showForm && (
                        <div className="grid grid-cols-3 gap-4">
                            <button
                                onClick={() => setShowForm('ricarica')}
                                className="flex items-center justify-center gap-3 py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                            >
                                <Plus className="w-5 h-5" />
                                Ricarica
                            </button>
                            <button
                                onClick={() => setShowForm('addebito')}
                                className="flex items-center justify-center gap-3 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                            >
                                <Minus className="w-5 h-5" />
                                Addebita
                            </button>
                            <button
                                onClick={() => setShowForm('rimborso')}
                                className="flex items-center justify-center gap-3 py-4 bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 transition-all shadow-lg shadow-blue-100"
                            >
                                <Send className="w-5 h-5" />
                                Rimborso Spese
                            </button>
                        </div>
                    )}

                    {/* Form Movimento */}
                    {showForm && (
                        <FormMovimento
                            type={showForm === 'modifica' ? (editingMovimento?.tipo === 'RICARICA' ? 'ricarica' : editingMovimento?.tipo === 'RIMBORSO' ? 'rimborso' : 'addebito') : showForm}
                            initialData={editingMovimento ? {
                                importo: Number(editingMovimento.importo),
                                tipo: editingMovimento.tipo,
                                descrizione: editingMovimento.descrizione,
                                data: editingMovimento.data
                            } : undefined}
                            onClose={() => {
                                setShowForm(null);
                                setEditingMovimento(null);
                            }}
                            onSubmit={handleAction}
                            isLoading={isActionLoading}
                        />
                    )}

                    {/* Esporta Estratto Conto & Invia WhatsApp */}
                    <div className="bg-gray-50/80 border border-gray-200/80 p-5 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-dark font-black uppercase text-xs tracking-wider">
                                <FileDown className="w-4 h-4 text-primary" />
                                <span>Esporta / Invia Estratto Conto</span>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                                PDF scaricato e pronto per WhatsApp
                            </span>
                        </div>

                        {/* Filtri Periodo */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFilterPreset('20')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filterPreset === '20' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/40'}`}
                            >
                                Ultimi 20
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterPreset('attiva')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filterPreset === 'attiva' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/40'}`}
                            >
                                Stagione Attiva
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterPreset('all')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filterPreset === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/40'}`}
                            >
                                Tutto lo Storico
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterPreset('custom')}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${filterPreset === 'custom' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/40'}`}
                            >
                                <Calendar className="w-3 h-3" />
                                Da Data a Data
                            </button>
                        </div>

                        {/* Date Inputs se 'custom' */}
                        {filterPreset === 'custom' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-fade-in">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">Data Inizio</label>
                                    <input
                                        type="date"
                                        value={filterDataInizio}
                                        onChange={(e) => setFilterDataInizio(e.target.value)}
                                        className="w-full text-xs font-bold p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">Data Fine</label>
                                    <input
                                        type="date"
                                        value={filterDataFine}
                                        onChange={(e) => setFilterDataFine(e.target.value)}
                                        className="w-full text-xs font-bold p-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Pulsanti Esportazione */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleExportWhatsApp}
                                disabled={isExportingWA || isExportingPDF}
                                className="flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all shadow-md shadow-green-100 disabled:opacity-50 active:scale-95 cursor-pointer"
                            >
                                {isExportingWA ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4" />}
                                Invia WhatsApp con PDF allegato
                            </button>

                            <button
                                type="button"
                                onClick={handleExportPDF}
                                disabled={isExportingPDF || isExportingWA}
                                className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[10px] tracking-wider transition-all shadow-md shadow-blue-100 disabled:opacity-50 active:scale-95 cursor-pointer"
                            >
                                {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                                Scarica PDF Estratto Conto
                            </button>
                        </div>
                    </div>

                    {/* Tabella Movimenti */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-gray-400">
                            <History className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest">Ultimi Movimenti</h3>
                        </div>

                        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                            {isLoading ? (
                                <div className="py-20 flex justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-200" />
                                </div>
                            ) : movimenti.length > 0 ? (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-[9px] font-black uppercase text-gray-400">Data</th>
                                            <th className="px-4 py-3 text-[9px] font-black uppercase text-gray-400">Tipo</th>
                                            <th className="px-4 py-3 text-[9px] font-black uppercase text-gray-400 text-right">Importo</th>
                                            <th className="px-4 py-3 text-[9px] font-black uppercase text-gray-400 text-center">Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {movimenti.map((m) => {
                                            const isPositive = m.tipo === 'RICARICA';
                                            const isRimborso = m.tipo === 'RIMBORSO';
                                            return (
                                                <tr key={m.id} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-dark">{format(new Date(m.data), 'dd/MM/yy')}</span>
                                                            <span className="text-[9px] text-gray-400">{format(new Date(m.data), 'HH:mm')}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col">
                                                            <span className={`text-[10px] font-black uppercase tracking-tighter ${isRimborso ? 'text-blue-600' : 'text-gray-600'}`}>
                                                                {m.tipo.replace('_', ' ')}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
                                                                {m.descrizione || '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {isRimborso ? (
                                                                <Send className="w-3 h-3 text-blue-500" />
                                                            ) : isPositive ? (
                                                                <ArrowUpCircle className="w-3 h-3 text-green-500" />
                                                            ) : (
                                                                <ArrowDownCircle className="w-3 h-3 text-red-500" />
                                                            )}
                                                            <span className={`text-xs font-black ${isRimborso ? 'text-blue-600' : isPositive ? 'text-green-600' : 'text-red-500'}`}>
                                                                {isRimborso ? '' : isPositive ? '+' : '-'}{formatValuta(m.importo)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEditMovimento(m); }}
                                                                className="p-1.5 hover:bg-primary/10 text-gray-400 hover:text-primary transition-colors rounded-lg"
                                                                title="Modifica"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteMovimento(m.id); }}
                                                                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors rounded-lg"
                                                                title="Elimina"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="py-12 text-center">
                                    <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Nessun movimento</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DettaglioBorsellino;
