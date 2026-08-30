import React, { useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import {
    Search, User, Loader2, ArrowLeftRight,
    AlertTriangle, ChevronRight, Wallet, FileDown
} from 'lucide-react';
import DettaglioBorsellino from '../components/DettaglioBorsellino';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Icona WhatsApp Custom SVG
const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.03 0C5.399 0 .007 5.391 0 12.026c0 2.119.554 4.188 1.606 6.01L0 24l6.117-1.605a11.803 11.803 0 005.917 1.6c6.625 0 12.014-5.391 12.018-12.027a11.82 11.82 0 00-3.518-8.508z" />
    </svg>
);

interface SaldoGiocatore {
    id: string;
    nome: string;
    cognome: string;
    numeroTessera: string;
    telefono: string | null;
    saldoAttuale: number;
}

const Contabilita: React.FC = () => {
    const [selectedGiocatore, setSelectedGiocatore] = useState<SaldoGiocatore | null>(null);
    const [loadingWA, setLoadingWA] = useState<string | null>(null);
    const [loadingPDF, setLoadingPDF] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { token } = useAuth();
    const fetchSaldiData = async () => {
        const res = await axios.get(`${API_BASE_URL}/api/contabilita/saldi`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.data as SaldoGiocatore[];
    };

    const { data: saldi = [], isLoading, refetch: fetchSaldi } = useQuery({
        queryKey: ['saldi', token],
        queryFn: fetchSaldiData,
        enabled: !!token
    });

    const filteredSaldi = saldi.filter((s: SaldoGiocatore) => {
        const fullSearch = `${s.nome} ${s.cognome} ${s.numeroTessera}`.toLowerCase();
        return fullSearch.includes(searchTerm.toLowerCase());
    });

    const formatValuta = (valore: string | number) => {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(valore));
    };

    const generatePDFDocument = (giocatore: SaldoGiocatore, movimenti: any[], periodoLabel: string = 'ultimi 20 movimenti') => {
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

        if (movimenti.length > 0) {
            const tableColumn = ["Data", "Tipo", "Descrizione", "Importo"];
            const tableRows = movimenti.map((m: any) => {
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
            doc.text('Nessun movimento registrato nel periodo.', 14, 65);
        }

        const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 65;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");

        if (giocatore.saldoAttuale < 0) {
            doc.setTextColor(220, 38, 38);
        } else {
            doc.setTextColor(22, 163, 74);
        }
        doc.text(`Saldo Attuale: ${formatValuta(giocatore.saldoAttuale)}`, 14, finalY + 15);

        const safeCognome = giocatore.cognome.replace(/\s+/g, '_');
        const safeNome = giocatore.nome.replace(/\s+/g, '_');
        doc.save(`Estratto_Conto_${safeCognome}_${safeNome}.pdf`);
    };

    const handleDownloadPDF = async (e: React.MouseEvent, giocatore: SaldoGiocatore) => {
        e.stopPropagation();
        setLoadingPDF(giocatore.id);

        try {
            const res = await axios.get(`${API_BASE_URL}/api/giocatori/${giocatore.id}/borsellino?limit=20`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const movimenti = res.data.movimenti || [];
            generatePDFDocument(giocatore, movimenti, 'degli ultimi 20 movimenti');
        } catch (error) {
            console.error('Errore durante il recupero dell\'estratto conto per PDF:', error);
            alert('Errore durante la generazione del PDF.');
        } finally {
            setLoadingPDF(null);
        }
    };

    const handleWhatsApp = async (e: React.MouseEvent, giocatore: SaldoGiocatore) => {
        e.stopPropagation();
        if (!giocatore.telefono) {
            alert('Numero di telefono non disponibile per questo giocatore.');
            return;
        }

        setLoadingWA(giocatore.id);
        try {
            // Recupera gli ultimi 20 movimenti del borsellino
            const res = await axios.get(`${API_BASE_URL}/api/giocatori/${giocatore.id}/borsellino?limit=20`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const movimenti = res.data.movimenti || [];
            
            // Genera e scarica automaticamente il PDF per l'invio in allegato
            generatePDFDocument(giocatore, movimenti, 'degli ultimi 20 movimenti');

            const telefonoPulito = giocatore.telefono.replace(/\D/g, '');
            const telefonoFormattato = telefonoPulito.startsWith('39') ? telefonoPulito : `39${telefonoPulito}`;
            const saldoFormatted = formatValuta(giocatore.saldoAttuale);

            let msg = `Ciao *${giocatore.nome}*! 🎳\nEcco il resoconto aggiornato del tuo *Borsellino Elettronico* (All Star Team):\n\n💰 *Saldo Attuale:* ${saldoFormatted}\n\n📎 *Ti abbiamo allegato a questo messaggio il documento PDF con il riepilogo dettagliato degli ultimi 20 movimenti registrati sul tuo conto.*\n`;

            if (giocatore.saldoAttuale < 0) {
                msg += `\n⚠️ Ti ricordiamo che il tuo saldo è attualmente in negativo. Ti chiediamo cortesemente di effettuare una ricarica per le prossime attività agonistiche.\n`;
            } else if (giocatore.saldoAttuale < 15) {
                msg += `\n💡 Il tuo credito è in esaurimento, ricordati di effettuare una ricarica alla prima occasione utile.\n`;
            }

            msg += `\nPer qualsiasi chiarimento contatta la segreteria. ⭐`;

            const url = `https://wa.me/${telefonoFormattato}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
        } catch (error) {
            console.error('Errore durante il recupero dell\'estratto conto:', error);
            alert('Errore durante il recupero dell\'estratto conto.');
        } finally {
            setLoadingWA(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin h-12 w-12 text-primary mb-4" />
                <p className="text-gray-500 font-heading uppercase tracking-widest text-sm">Caricamento contabilità...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 px-4 max-w-7xl mx-auto pb-12">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <ArrowLeftRight className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-dark font-heading uppercase tracking-tighter">Gestione Contabilità</h1>
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Supervisione Borsellini Giocatori</p>
                    </div>
                </div>

                <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Sistema Online</span>
                </div>
            </div>

            {/* Ricerca e Statistiche Rapide */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cerca per nome, cognome o numero tessera..."
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none transition-all font-medium text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-dark p-4 rounded-3xl flex items-center justify-between text-white shadow-xl">
                    <div>
                        <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">Totale Giocatori</p>
                        <p className="text-2xl font-black">{saldi.length}</p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-2xl">
                        <User className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Tabella Giocatori */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto border-b border-gray-50">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Giocatore</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">N. Tessera</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Saldo Attuale</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Stato</th>
                                <th className="px-8 py-5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredSaldi.map((s: SaldoGiocatore) => {
                                const isLowBalance = Number(s.saldoAttuale) < 15;
                                const isCritical = Number(s.saldoAttuale) < 0;
                                return (
                                    <tr
                                        key={s.id}
                                        onClick={() => setSelectedGiocatore(s)}
                                        className="hover:bg-primary/5 transition-all cursor-pointer group"
                                    >
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-primary group-hover:text-white transition-colors">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <p className="text-sm font-black text-dark uppercase">{s.cognome} {s.nome}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-bold text-gray-500 tracking-widest bg-gray-100 px-3 py-1 rounded-lg">
                                                {s.numeroTessera || 'N/D'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={`text-lg font-black ${isCritical ? 'text-red-600' : isLowBalance ? 'text-orange-500' : 'text-green-600'}`}>
                                                    {formatValuta(s.saldoAttuale)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center justify-center gap-3">
                                                {isLowBalance ? (
                                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isCritical ? 'bg-red-600 text-white shadow-md shadow-red-100 animate-pulse' : 'bg-orange-100 text-orange-600'}`}>
                                                        <AlertTriangle className="w-3.5 h-3.5" />
                                                        {isCritical ? 'Saldo Negativo' : 'Ricaricare'}
                                                    </div>
                                                ) : (
                                                    <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-green-200">
                                                        In Regola
                                                    </span>
                                                )}

                                                {/* Azioni Resoconto WhatsApp / Download PDF per tutti i giocatori */}
                                                <div className="flex items-center gap-1.5 ml-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleWhatsApp(e, s)}
                                                        disabled={loadingWA === s.id}
                                                        title="Invia resoconto WhatsApp"
                                                        className="p-2 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl transition-all shadow-sm group/wa disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                                    >
                                                        {loadingWA === s.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <WhatsAppIcon className="w-4 h-4" />
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDownloadPDF(e, s)}
                                                        disabled={loadingPDF === s.id}
                                                        title="Scarica Estratto Conto PDF"
                                                        className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm group/pdf disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                                    >
                                                        {loadingPDF === s.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <FileDown className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="p-2 bg-gray-50 rounded-xl group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredSaldi.length === 0 && (
                    <div className="py-24 text-center text-gray-400">
                        <Wallet className="w-20 h-20 mx-auto opacity-10 mb-6" />
                        <h3 className="text-lg font-black uppercase tracking-widest text-gray-300">Nessun giocatore trovato</h3>
                        <p className="text-sm font-medium opacity-60">Prova a cambiare i filtri di ricerca</p>
                    </div>
                )}
            </div>

            {/* Modal Dettaglio */}
            {selectedGiocatore && (
                <DettaglioBorsellino
                    giocatore={selectedGiocatore}
                    onClose={() => setSelectedGiocatore(null)}
                    onUpdate={fetchSaldi}
                />
            )}
        </div>
    );
};

export default Contabilita;
