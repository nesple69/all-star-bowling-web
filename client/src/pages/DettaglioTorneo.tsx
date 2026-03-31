import React, { useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import {
    Trophy, Calendar, MapPin, Download,
    ExternalLink, ChevronLeft, Info, Users,
    Star, Medal, Target, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Risultato {
    id: string;
    posizione: number;
    partiteGiocate: number;
    totaleBirilli: number;
    totaleBirilliSquadra?: number;
    divisione?: string | null;
    isRiserva: boolean;
    giocatore: {
        nome: string;
        cognome: string;
        sesso: string;
        categoria: string;
    };
    partite: {
        numeroPartita: number;
        birilli: number;
    }[];
}

interface Torneo {
    id: string;
    nome: string;
    tipologia: string;
    sede: string;
    dataInizio: string;
    dataFine: string;
    completato: boolean;
    locandina?: string;
    linkIscrizione?: string;
    stagione: { nome: string };
    risultati: Risultato[];
    turni: any[];
    mostraBottoneIscrizione: boolean;
    costoIscrizione: number;
    sedi: { id: string, nome: string, categorie: string[], locandina?: string | null }[];
}

interface Disponibilita {
    id: string;
    giorno: string;
    orarioInizio: string;
    postiTotali: number;
    postiOccupati: number;
    postiRimanenti: number;
    sede?: { id: string, nome: string } | null;
}

const DettaglioTorneo: React.FC = () => {
    const { id } = useParams();
    const [isRegistering, setIsRegistering] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    const fetchTorneoData = async () => {
        const resTorneo = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}`);
        const resDisp = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}/disponibilita`);

        let giocatore = null;
        const token = sessionStorage.getItem('token');
        const userStr = sessionStorage.getItem('user');
        if (token && userStr) {
            const resProfile = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            giocatore = resProfile.data.giocatore;
        }

        return {
            torneo: resTorneo.data as Torneo,
            disponibilita: resDisp.data as Disponibilita[],
            userGiocatore: giocatore
        };
    };

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['torneoDetail', id],
        queryFn: fetchTorneoData,
        enabled: !!id
    });

    const torneo = data?.torneo;
    const disponibilita = data?.disponibilita || [];
    const userGiocatore = data?.userGiocatore;

    const handleIscrizione = async (turnoId: string) => {
        if (!userGiocatore) {
            alert('Devi aver effettuato l\'accesso per iscriverti.');
            return;
        }

        // Se il torneo ha più sedi, reindirizza alla pagina di iscrizione completa
        // per permettere la scelta della sede con suggerimento categoria
        if (torneo && torneo.sedi && torneo.sedi.length > 0) {
            window.location.href = `/tornei/${id}/iscrizione?turnoId=${turnoId}`;
            return;
        }

        const costo = Number(torneo?.costoIscrizione || 0);
        const saldo = Number(userGiocatore.saldo?.saldoAttuale || 0);

        if (costo > 0 && saldo < costo) {
            alert('Saldo insufficiente nel borsellino. Effettua una ricarica.');
            return;
        }

        if (!window.confirm(`Confermi l'iscrizione al torneo? ${costo > 0 ? `Verranno scalati €${costo.toFixed(2)} dal tuo borsellino.` : ''}`)) return;

        setIsRegistering(true);
        setStatus({ type: null, message: '' });

        try {
            const token = sessionStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/tornei/iscriviti`, {
                torneoId: id,
                turnoId: turnoId,
                giocatoreId: userGiocatore.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setStatus({ type: 'success', message: 'Iscrizione effettuata con successo!' });
            await refetch();
        } catch (err: any) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Errore durante l\'iscrizione.' });
        } finally {
            setIsRegistering(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!torneo) return <div className="text-center py-20 font-black uppercase text-gray-300">Torneo non trovato</div>;

    const isTeam = torneo.tipologia !== 'SINGOLO';

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20 text-dark">
            {/* Nav & Action */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <Link to="/tornei" className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-black uppercase text-xs tracking-widest group">
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Tutti i tornei
                </Link>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {(() => {
                        const now = new Date();
                        const dataFineTorneo = torneo.dataFine ? new Date(torneo.dataFine) : new Date(torneo.dataInizio);
                        const dataScadenzaOffset = new Date(dataFineTorneo);
                        dataScadenzaOffset.setDate(dataScadenzaOffset.getDate() + 2);
                        const isScaduto2Giorni = now > dataScadenzaOffset;

                        return (
                            <>
                                {torneo.locandina && !isScaduto2Giorni && (
                                    <a
                                        href={torneo.locandina.startsWith('http') ? torneo.locandina : `${API_BASE_URL}${torneo.locandina}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:border-primary hover:text-primary transition-all shadow-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        Scarica Locandina
                                    </a>
                                )}
                                {torneo.mostraBottoneIscrizione && !torneo.completato && !isScaduto2Giorni && (
                                    <Link
                                        to={`/tornei/${id}/iscrizione`}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-secondary text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-secondary/20 hover:scale-105 transition-all"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Iscriviti Ora
                                    </Link>
                                )}
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Hero Section */}
            <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-sm border border-gray-100 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>

                <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/10">
                            {torneo.stagione.nome}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                            {torneo.tipologia.replace('_', ' ')}
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">{torneo.nome}</h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="flex items-center gap-4 group">
                            <div className="p-4 bg-gray-50 rounded-3xl group-hover:bg-primary/5 transition-colors">
                                <Calendar className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Periodo Svolgimento</p>
                                <p className="font-black text-gray-700 uppercase">
                                    {format(new Date(torneo.dataInizio), 'dd MMMM', { locale: it })}
                                    {torneo.dataFine && torneo.dataFine !== torneo.dataInizio && (
                                        <> - {format(new Date(torneo.dataFine), 'dd MMMM yyyy', { locale: it })}</>
                                    )}
                                    {(!torneo.dataFine || torneo.dataFine === torneo.dataInizio) && (
                                        <> {format(new Date(torneo.dataInizio), 'yyyy', { locale: it })}</>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 group">
                            <div className="p-4 bg-gray-50 rounded-3xl group-hover:bg-primary/5 transition-colors">
                                <MapPin className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sedi di Gara</p>
                                {torneo.sedi && torneo.sedi.length > 0 ? (
                                    <div className="space-y-2 mt-1">
                                        {torneo.sedi.map((s, idx) => (
                                            <div key={idx} className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-gray-700 uppercase text-sm leading-tight">{s.nome}</span>
                                                    {s.locandina && (
                                                        <a 
                                                            href={s.locandina.startsWith('http') ? s.locandina : `${API_BASE_URL}${s.locandina}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 px-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5 group/loc"
                                                            title="Scarica Locandina Sede"
                                                        >
                                                            <FileText className="w-3 h-3 group-hover/loc:scale-110 transition-transform" />
                                                            <span className="text-[8px] font-black uppercase tracking-tighter">Locandina</span>
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    {s.categorie.map(c => (
                                                        <span key={c} className="text-[8px] font-black px-1.5 py-0.5 bg-primary/5 border border-primary/10 text-primary rounded-full uppercase tracking-tighter">
                                                            {c}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="font-black text-gray-700 uppercase">{torneo.sede}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Classifica o Info Turni */}
            {torneo.completato ? (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-dark">
                            <Trophy className="text-amber-400 w-7 h-7" />
                            Classifica Ufficiale
                            <span className="text-sm font-bold text-gray-300 ml-2">
                                {format(new Date(torneo.dataInizio), 'dd/MM/yyyy')}
                            </span>
                        </h2>
                        <div className="hidden md:flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            <Info className="w-3 h-3" />
                            Risultati verificati dalla segreteria
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pos</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Atleta</th>
                                        <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Partite Individuali</th>
                                        <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest text-primary">Media</th>
                                        <th className="px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest text-dark">Birilli Tot.</th>
                                        {isTeam && (
                                            <th className="px-6 py-5 text-center text-[10px] font-black text-secondary uppercase tracking-widest">Tot. Squadra</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(() => {
                                        // 1. Raggruppa i risultati in "Squadre" (Teams)
                                        const groupedTeams = torneo.risultati.reduce((acc: any, ris: any) => {
                                            const teamId = torneo.tipologia === 'SINGOLO' ? ris.id : ris.posizione;
                                            if (!acc[teamId]) acc[teamId] = [];
                                            acc[teamId].push(ris);
                                            return acc;
                                        }, {});

                                        // 2. Calcola la Categoria FISB per ogni Squadra
                                        const divisions: Record<string, any[]> = {};
                                        
                                        Object.values(groupedTeams).forEach((team: any) => {
                                            const p1 = team[0];
                                            let divName = p1.divisione || 'Generale'; // default fallback
                                            
                                            if (torneo.tipologia === 'SINGOLO' && p1.giocatore?.sesso && p1.giocatore?.categoria) {
                                                divName = `${p1.giocatore.sesso}/${p1.giocatore.categoria}`;
                                            } else if (torneo.tipologia === 'DOPPIO' || torneo.tipologia === 'TRIS') {
                                                const hasEccellenza = team.some((m: any) => ['A', 'B'].includes(m.giocatore?.categoria));
                                                const allFemale = team.every((m: any) => m.giocatore?.sesso === 'F');
                                                const genere = allFemale ? 'Femminile' : 'Maschile';
                                                const livello = hasEccellenza ? 'Eccellenza' : 'Cadetti';
                                                divName = `${livello} ${genere}`;
                                            } else if (torneo.tipologia === 'SQUADRA_4' || torneo.tipologia === 'SQUADRA') {
                                                const hasEccellenza = team.some((m: any) => ['A', 'B'].includes(m.giocatore?.categoria));
                                                divName = hasEccellenza ? 'Eccellenza' : 'Cadetti';
                                            }

                                            if (!divisions[divName]) divisions[divName] = [];
                                            divisions[divName].push(team);
                                        });

                                        // 3. Ordina le divisioni alfabeticamente
                                        const sortedDivisionNames = Object.keys(divisions).sort((a, b) => a.localeCompare(b));

                                        return sortedDivisionNames.map((divName) => {
                                            const teamsInDiv = divisions[divName];
                                            
                                            // 4. Ordina i team per posizione crescente
                                            const sortedTeams = teamsInDiv.sort((a, b) => a[0].posizione - b[0].posizione);

                                            return (
                                                <React.Fragment key={divName}>
                                                    {/* Header Divisione */}
                                                    <tr className="bg-primary/5">
                                                        <td colSpan={isTeam ? 6 : 5} className="px-6 py-2 border-y border-primary/10">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                                                <span className="text-[11px] font-black uppercase tracking-widest text-primary">
                                                                    Categoria {divName}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {sortedTeams.map((members: any) => {
                                                        const teamTotal = members[0].totaleBirilliSquadra || members.reduce((sum: number, m: any) => sum + m.totaleBirilli, 0);

                                                        return members.map((r: any, memberIdx: number) => {
                                                            const isFirstInGroup = memberIdx === 0;
                                                            const isLastInGroup = memberIdx === (members as any).length - 1;

                                                            return (
                                                                <tr key={r.id} className={`transition-colors ${r.isRiserva ? 'opacity-60 bg-gray-50/30' : ''} ${isLastInGroup ? 'border-b-2 border-gray-100' : 'border-b border-gray-50'} hover:bg-gray-50/50`}>
                                                                    <td className="px-4 py-3 text-center align-middle">
                                                                        <div className="flex items-center justify-center">
                                                                            {isFirstInGroup && (
                                                                                r.isRiserva ? (
                                                                                    <span className="text-[9px] font-black text-gray-300 uppercase leading-none">RIS</span>
                                                                                ) : (
                                                                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-black ${r.posizione === 1 ? 'bg-amber-400 text-white shadow-sm' :
                                                                                        r.posizione === 2 ? 'bg-slate-300 text-white' :
                                                                                            r.posizione === 3 ? 'bg-amber-600/30 text-amber-700' : 'text-gray-400'
                                                                                        }`}>
                                                                                        {r.posizione}
                                                                                    </span>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-[180px] lg:w-[220px] flex-shrink-0">
                                                                                <span className="text-sm font-bold text-dark whitespace-nowrap">
                                                                                    {r.giocatore.cognome} {r.giocatore.nome}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex-shrink-0">
                                                                                <span className="inline-block text-[10px] font-black text-white bg-primary px-1.5 py-0.5 rounded uppercase min-w-[34px] text-center shadow-sm">
                                                                                    {r.giocatore.sesso}/{r.giocatore.categoria}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex flex-wrap justify-center gap-1 max-w-[280px] mx-auto">
                                                                            {r.partite && r.partite.length > 0 ? (
                                                                                r.partite.map((p: any, idx: number) => (
                                                                                    <div key={idx} className="flex flex-col items-center relative">
                                                                                        <span className={`${p.isRiporto ? 'text-white bg-red-500 border-red-600' : 'text-dark/70 bg-gray-50 border-gray-100'} text-[11px] font-black px-1.5 py-0.5 rounded border min-w-[24px] text-center shadow-sm`}>
                                                                                            {p.birilli}
                                                                                        </span>
                                                                                        {p.isRiporto && (
                                                                                            <span className="absolute -top-2 -right-1 text-[6px] font-black bg-white text-red-500 border border-red-200 px-0.5 rounded leading-none uppercase">RIP</span>
                                                                                        )}
                                                                                    </div>
                                                                                ))
                                                                            ) : (
                                                                                <span className="text-[11px] text-gray-400 italic font-bold">{r.partiteGiocate} partite</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <span className="text-[13px] font-black text-primary bg-primary/5 px-2 py-1 rounded-lg">
                                                                            {r.partiteGiocate > 0 ? (r.totaleBirilli / r.partiteGiocate).toFixed(2) : '0.00'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="font-black text-sm text-dark">{r.totaleBirilli + (r.riporto || 0)}</span>
                                                                            {r.riporto > 0 && (
                                                                                <span className="text-[9px] font-black text-secondary">
                                                                                    {r.totaleBirilli} + {r.riporto} RIP
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    {isTeam && (
                                                                        <td className="px-4 py-3 text-center">
                                                                            {isFirstInGroup && (
                                                                                <span className="text-secondary font-black text-sm">
                                                                                    {teamTotal || '-'}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            );
                                                        });
                                                    })}
                                                </React.Fragment>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm space-y-8">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 mb-6">
                                    <Users className="text-secondary w-6 h-6" />
                                    Posti Disponibili
                                </h2>

                                {status.message && (
                                    <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                        {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                        <p className="text-xs font-black uppercase">{status.message}</p>
                                    </div>
                                )}

                                <div className="space-y-8">
                                    {(Array.from(new Set(disponibilita.map(d => d.sede?.id || 'principale'))).map(sedeId => {
                                        const sedeTurni = disponibilita.filter(d => (d.sede?.id || 'principale') === sedeId);
                                        const sedeNome = sedeId === 'principale' ? (torneo?.sede || 'Principale') : sedeTurni[0].sede?.nome;

                                        return (
                                            <div key={sedeId} className="space-y-4">
                                                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                                    <MapPin className="w-4 h-4 text-primary/50" />
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">
                                                        Sede: {sedeNome}
                                                    </h3>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {sedeTurni.map((t) => {
                                                        const isEsaurito = t.postiRimanenti <= 0;
                                                        return (
                                                            <div key={t.id} className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 ${isEsaurito ? 'bg-gray-50 border-gray-100 opacity-80' : 'bg-white border-gray-100 hover:border-primary/30 hover:shadow-md'}`}>
                                                                <div className="flex justify-between items-start">
                                                                    <div className="space-y-1">
                                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{format(new Date(t.giorno), 'EEEE dd MMMM', { locale: it })}</p>
                                                                        <p className="font-black text-sm">{format(new Date(t.orarioInizio), 'HH:mm')}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Disponibili</p>
                                                                        <p className={`font-black ${isEsaurito ? 'text-red-500' : 'text-secondary'}`}>{t.postiRimanenti} / {t.postiTotali}</p>
                                                                    </div>
                                                                </div>

                                                                {torneo.mostraBottoneIscrizione && (
                                                                    userGiocatore ? (
                                                                        <button
                                                                            disabled={isEsaurito || isRegistering}
                                                                            onClick={() => handleIscrizione(t.id)}
                                                                            className={`w-full py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isEsaurito ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95'}`}
                                                                        >
                                                                            {isRegistering ? 'Elaborazione...' : isEsaurito ? 'Turno Esaurito' : 'Iscriviti al Turno'}
                                                                        </button>
                                                                    ) : (
                                                                        <Link
                                                                            to="/login"
                                                                            className="w-full py-3 bg-gray-50 text-gray-400 border border-gray-100 rounded-2xl font-black uppercase text-[10px] tracking-widest text-center hover:bg-gray-100 transition-all"
                                                                        >
                                                                            Accedi per Iscriverti
                                                                        </Link>
                                                                    )
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    }))}
                                </div>
                            </div>

                            {userGiocatore && (
                                <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-secondary text-white rounded-2xl">
                                            <Trophy className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Il Tuo Borsellino</p>
                                            <p className="text-lg font-black text-secondary">€ {Number(userGiocatore.saldo?.saldoAttuale || 0).toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Quota Torneo</p>
                                        <p className="text-lg font-black text-dark">€ {Number(torneo.costoIscrizione || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary text-white rounded-xl">
                                    <Star className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-black text-primary uppercase tracking-widest">Note Segreteria</h3>
                            </div>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <Medal className="w-4 h-4 text-primary shrink-0 opacity-50" />
                                    <p className="text-xs font-bold text-primary/70 leading-relaxed uppercase">Le iscrizioni si chiudono 48 ore prima della gara.</p>
                                </li>
                                <li className="flex gap-3">
                                    <Target className="w-4 h-4 text-primary shrink-0 opacity-50" />
                                    <p className="text-xs font-bold text-primary/70 leading-relaxed uppercase">La classifica verrà pubblicata entro 12 ore dal termine dei turni.</p>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DettaglioTorneo;
