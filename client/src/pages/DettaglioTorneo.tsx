import React, { useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import {
    Trophy, Calendar, MapPin, Download,
    ChevronLeft, Users, FileText, UserPlus, CheckCircle2
} from 'lucide-react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';

interface Risultato {
    id: string;
    posizione: number;
    partiteGiocate: number;
    totaleBirilli: number;
    totaleBirilliSquadra?: number | null;
    divisione?: string | null;
    isRiserva: boolean;
    riporto?: number;
    giocatore: {
        nome: string;
        cognome: string;
        sesso: string;
        categoria: string;
    };
    partite: {
        id?: string;
        numeroPartita: number;
        birilli: number;
        isRiporto?: boolean;
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
    sedi: { id: string; nome: string; categorie: string[]; locandina?: string | null }[];
}

interface Disponibilita {
    id: string;
    giorno: string;
    orarioInizio: string;
    postiTotali: number;
    postiOccupati: number;
    postiRimanenti: number;
    sede?: { id: string; nome: string } | null;
}

const DettaglioTorneo: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [disponibilita, setDisponibilita] = useState<any[]>([]);
    const [iscritti, setIscritti] = useState<any[]>([]);
    const [showIscritti, setShowIscritti] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTorneoData = async () => {
        const resTorneo = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}`);
        const resDisp = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}/disponibilita`);
        setDisponibilita(resDisp.data);
        try {
            const resIscr = await axios.get(`${API_BASE_URL}/api/tornei/public/${id}/iscritti`);
            setIscritti(resIscr.data);
        } catch (err) {
            console.error('Errore caricamento iscritti:', err);
        }
        setIsLoading(false);
        return {
            torneo: resTorneo.data as Torneo,
            disponibilita: resDisp.data as Disponibilita[]
        };
    };

    const { data } = useQuery({
        queryKey: ['torneoDetail', id],
        queryFn: fetchTorneoData,
        enabled: !!id
    });

    const torneo = data?.torneo;

    const handleOpenIscrizione = (turnoId?: string) => {
        navigate(`/tornei/${id}/iscrizione${turnoId ? `?turnoId=${turnoId}` : ''}`);
    };

    if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!torneo) return <div className="text-center py-20 font-black uppercase text-gray-300">Torneo non trovato</div>;

    const isScaduto2Giorni = differenceInDays(new Date(torneo.dataInizio), new Date()) <= -2;

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20 text-dark">
            {/* Nav & Action */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <Link to="/tornei" className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-black uppercase text-xs tracking-widest group">
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Tutti i tornei
                </Link>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {torneo.locandina && (
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
                        <button
                            onClick={() => handleOpenIscrizione(torneo.turni[0]?.id || '')}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-secondary text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-secondary/20 hover:scale-105 transition-all"
                        >
                            <UserPlus className="w-4 h-4" />
                            Iscriviti Ora
                        </button>
                    )}
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
                                            <div key={idx} className="flex flex-col gap-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-gray-700 uppercase text-sm leading-tight">{s.nome}</span>
                                                    {s.categorie && s.categorie.length > 0 && (
                                                        <span className="text-[9px] font-black bg-primary/5 text-primary/70 px-2 py-0.5 rounded border border-primary/10">
                                                            {s.categorie.join(', ')}
                                                        </span>
                                                    )}
                                                    {s.locandina && (
                                                        <a 
                                                            href={s.locandina.startsWith('http') ? s.locandina : `${API_BASE_URL}${s.locandina}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 px-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5 group/loc"
                                                        >
                                                            <FileText className="w-3 h-3 group-hover/loc:scale-110 transition-transform" />
                                                            <span className="text-[8px] font-black uppercase tracking-tighter">Locandina</span>
                                                        </a>
                                                    )}
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

            {/* Risultati o Turni */}
            {torneo.completato ? (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 md:p-8 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight text-dark flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-secondary" />
                                Classifica Ufficiale
                            </h2>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                {torneo.tipologia.replace('_', ' ')} • {torneo.risultati.length} Atleti
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100">
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-14">Pos</th>
                                    <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Atleta</th>
                                    <th className="px-4 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Partite</th>
                                    <th className="px-4 py-4 text-center text-[10px] font-black text-primary uppercase tracking-widest">Media</th>
                                    <th className="px-4 py-4 text-center text-[10px] font-black text-dark uppercase tracking-widest">Totale</th>
                                    {torneo.tipologia !== 'SINGOLO' && (
                                        <th className="px-5 py-4 text-center text-[10px] font-black text-secondary uppercase tracking-widest bg-secondary/5">
                                            {torneo.tipologia === 'DOPPIO' ? 'Tot. Doppio' : 'Tot. Squadra'}
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const isTeam = torneo.tipologia !== 'SINGOLO';
                                    const risultatiList = torneo.risultati || [];
                                    
                                    // Raggruppamento squadre per divisione + posizione (o id per singoli)
                                    const groupedTeams = risultatiList.reduce((acc: any, ris: any) => {
                                        const teamId = isTeam 
                                            ? `${ris.divisione || 'default'}_${ris.posizione}` 
                                            : ris.id;
                                        if (!acc[teamId]) acc[teamId] = [];
                                        acc[teamId].push(ris);
                                        return acc;
                                    }, {});

                                    const divisions: Record<string, any[]> = {};

                                    Object.values(groupedTeams).forEach((team: any) => {
                                        const p1 = team[0];
                                        let divName = p1.divisione || '';

                                        if (!divName) {
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
                                            } else {
                                                divName = 'Classifica';
                                            }
                                        }

                                        if (!divisions[divName]) divisions[divName] = [];
                                        divisions[divName].push(team);
                                    });

                                    const sortedDivisionNames = Object.keys(divisions).sort((a, b) => a.localeCompare(b));

                                    return sortedDivisionNames.map((divName) => {
                                        const teamsInDiv = divisions[divName];
                                        const sortedTeams = teamsInDiv.sort((a, b) => a[0].posizione - b[0].posizione);

                                        return (
                                            <React.Fragment key={divName}>
                                                {divName && divName !== 'Classifica' && (
                                                    <tr className="bg-primary/5">
                                                        <td colSpan={isTeam ? 6 : 5} className="px-5 py-2.5 border-y border-primary/10">
                                                            <span className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                                                                Categoria {divName}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )}

                                                {sortedTeams.map((members: any, teamIdx: number) => {
                                                    const teamTotal = members[0].totaleBirilliSquadra || members.reduce((sum: number, m: any) => sum + m.totaleBirilli, 0);
                                                    const isEvenTeam = teamIdx % 2 === 0;

                                                    return members.map((r: any, memberIdx: number) => {
                                                        const isFirstInGroup = memberIdx === 0;
                                                        const isLastInGroup = memberIdx === members.length - 1;

                                                        return (
                                                            <tr 
                                                                key={r.id} 
                                                                className={`transition-colors ${
                                                                    isTeam && isEvenTeam ? 'bg-gray-50/30' : 'bg-white'
                                                                } ${
                                                                    isLastInGroup ? 'border-b-2 border-gray-100' : 'border-b border-gray-50'
                                                                } ${r.isRiserva ? 'opacity-60' : ''} hover:bg-primary/5`}
                                                            >
                                                                {/* Posizione */}
                                                                <td className="px-4 py-3 text-center align-middle">
                                                                    {isFirstInGroup && (
                                                                        r.isRiserva ? (
                                                                            <span className="text-[10px] font-black text-gray-300 uppercase leading-none">RIS</span>
                                                                        ) : (
                                                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black shadow-sm ${
                                                                                r.posizione === 1 
                                                                                    ? 'bg-amber-400 text-white shadow-amber-200' 
                                                                                    : r.posizione === 2 
                                                                                        ? 'bg-slate-300 text-white' 
                                                                                        : r.posizione === 3 
                                                                                            ? 'bg-amber-600/30 text-amber-800' 
                                                                                            : 'bg-gray-100 text-gray-600'
                                                                            }`}>
                                                                                {r.posizione}
                                                                            </span>
                                                                        )
                                                                    )}
                                                                </td>

                                                                {/* Atleta */}
                                                                <td className="px-5 py-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-black text-dark text-sm uppercase leading-tight">
                                                                            {r.giocatore?.cognome || ''} {r.giocatore?.nome || ''}
                                                                        </span>
                                                                        <span className="text-[10px] font-black text-primary uppercase">
                                                                            {r.giocatore?.sesso || ''}/{r.giocatore?.categoria || ''}
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                {/* Partite */}
                                                                <td className="px-4 py-3 text-center">
                                                                    <div className="flex flex-wrap items-center justify-center gap-1">
                                                                        {r.partite && r.partite.length > 0 ? (
                                                                            r.partite.map((p: any, idx: number) => (
                                                                                <span 
                                                                                    key={idx} 
                                                                                    className={`text-xs font-bold px-2 py-0.5 rounded-lg border min-w-[32px] text-center shadow-2xs ${
                                                                                        p.isRiporto 
                                                                                            ? 'bg-red-50 text-red-600 border-red-200 font-black' 
                                                                                            : 'bg-gray-50 text-dark/80 border-gray-200'
                                                                                    }`}
                                                                                    title={p.isRiporto ? `Riporto: ${p.birilli}` : `Partita ${p.numeroPartita || idx + 1}: ${p.birilli}`}
                                                                                >
                                                                                    {p.birilli}
                                                                                </span>
                                                                            ))
                                                                        ) : (
                                                                            <span className="text-xs text-gray-400 font-bold italic">{r.partiteGiocate} partite</span>
                                                                        )}
                                                                        {r.riporto > 0 && !r.partite?.some((p: any) => p.isRiporto) && (
                                                                            <span className="text-[10px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                                                                +{r.riporto} RIP
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* Media */}
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className="text-sm font-black text-primary">
                                                                        {r.partiteGiocate > 0 ? (r.totaleBirilli / r.partiteGiocate).toFixed(2) : '0.00'}
                                                                    </span>
                                                                </td>

                                                                {/* Totale Individuale */}
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className="text-sm font-black text-dark">
                                                                        {r.totaleBirilli}
                                                                    </span>
                                                                </td>

                                                                {/* Totale Squadra (se torneo a squadre/coppie) */}
                                                                {isTeam && (
                                                                    isFirstInGroup ? (
                                                                        <td 
                                                                            className="px-5 py-3 text-center align-middle bg-secondary/5 border-l border-secondary/10"
                                                                            rowSpan={members.length}
                                                                        >
                                                                            <div className="flex flex-col items-center justify-center">
                                                                                <span className="text-lg font-black text-secondary leading-none">
                                                                                    {teamTotal}
                                                                                </span>
                                                                                <span className="text-[8px] font-black uppercase tracking-tighter text-gray-400 mt-1">
                                                                                    {torneo.tipologia === 'DOPPIO' ? 'Doppio' : 'Squadra'}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                    ) : null
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
            ) : (
                <div className="space-y-8">
                    {/* Pulsanti Toggle Vista */}
                    <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-gray-100 self-start w-fit shadow-sm">
                        <button
                            onClick={() => setShowIscritti(false)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showIscritti ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Turni e Disponibilità
                        </button>
                        <button
                            onClick={() => setShowIscritti(true)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showIscritti ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Iscritti ({iscritti.length})
                        </button>
                    </div>

                    {showIscritti ? (
                        <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm animate-fade-in">
                             <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 mb-6">
                                <Users className="text-primary w-6 h-6" />
                                Atleti Iscritti
                            </h2>
                            {iscritti.length > 0 ? (
                                <div className="space-y-8">
                                    {(() => {
                                        const grouped = iscritti.reduce((acc: Record<string, any[]>, isc) => {
                                            const venueName = (isc.sede?.nome || 'Da assegnare').trim().toUpperCase();
                                            if (!acc[venueName]) acc[venueName] = [];
                                            acc[venueName].push(isc);
                                            return acc;
                                        }, {});

                                        return Object.entries(grouped).map(([venue, members], vIdx) => {
                                            const teamGroups: { key: string; nomeSquadra?: string | null; turno: any; iscritti: any[] }[] = [];
                                            const map = new Map<string, typeof teamGroups[0]>();

                                            for (const isc of members) {
                                                const groupKey = isc.gruppoId || `single_${isc.id || isc.giocatore?.id || Math.random()}`;
                                                if (!map.has(groupKey)) {
                                                    const grp = {
                                                        key: groupKey,
                                                        nomeSquadra: isc.nomeSquadra,
                                                        turno: isc.turno,
                                                        iscritti: []
                                                    };
                                                    map.set(groupKey, grp);
                                                    teamGroups.push(grp);
                                                }
                                                map.get(groupKey)!.iscritti.push(isc);
                                            }

                                            return (
                                                <div key={vIdx} className="space-y-4">
                                                    <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                                        <MapPin className="w-4 h-4 text-primary/50" />
                                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                                                            {venue} ({members.length} {members.length === 1 ? 'Atleta' : 'Atleti'})
                                                        </h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {teamGroups.map((grp) => (
                                                            <div key={grp.key} className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100 space-y-2">
                                                                {grp.nomeSquadra && (
                                                                    <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                                                                        <span className="text-xs font-black uppercase text-primary tracking-wider">{grp.nomeSquadra}</span>
                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">{grp.iscritti.length} Atleti</span>
                                                                    </div>
                                                                )}
                                                                <div className="space-y-1.5">
                                                                    {grp.iscritti.map((isc, idx) => (
                                                                        <div key={idx} className="flex justify-between items-center text-xs">
                                                                            <span className="font-black uppercase text-dark">
                                                                                {isc.giocatore.cognome} {isc.giocatore.nome}
                                                                                {isc.isRiserva && <span className="ml-1.5 text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black">RISERVA</span>}
                                                                            </span>
                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                                                {isc.giocatore.sesso}/{isc.giocatore.categoria}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="text-right pt-2 border-t border-gray-100/60">
                                                                    <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10 uppercase">
                                                                        {format(new Date(grp.turno?.orarioInizio || 0), 'dd/MM HH:mm')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400 italic uppercase text-xs font-bold tracking-widest">
                                    Ancora nessun iscritto per questo torneo
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 mb-6">
                                <Users className="text-secondary w-6 h-6" />
                                Turni e Disponibilità
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {disponibilita.map((t) => {
                                    const isEsaurito = t.postiRimanenti <= 0;
                                    return (
                                        <div key={t.id} className="p-6 rounded-3xl border border-gray-100 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{format(new Date(t.giorno.replace('Z', '')), 'EEEE dd MMMM', { locale: it })}</p>
                                                    <p className="font-black text-lg">{format(new Date(t.orarioInizio.replace('Z', '')), 'HH:mm')}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Disponibili</p>
                                                    <p className={`font-black ${isEsaurito ? 'text-red-500' : 'text-secondary'}`}>{t.postiRimanenti} / {t.postiTotali}</p>
                                                </div>
                                            </div>
                                            <button
                                                disabled={isEsaurito}
                                                onClick={() => handleOpenIscrizione(t.id)}
                                                className={`w-full py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isEsaurito ? 'bg-gray-100 text-gray-400' : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105'}`}
                                            >
                                                {isEsaurito ? 'Esaurito' : 'Iscriviti a questo turno'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary text-white rounded-2xl">
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quota Gara</p>
                                    <p className="text-2xl font-black text-primary">€ {Number(torneo.costoIscrizione || 0).toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="space-y-4 border-t border-primary/10 pt-6">
                                <div className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                                    <p className="text-[10px] font-bold text-gray-500 leading-relaxed uppercase">Iscrizione istantanea con numero di tessera FISB.</p>
                                </div>
                                <div className="flex gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                                    <p className="text-[10px] font-bold text-gray-500 leading-relaxed uppercase">Addebito automatico sul borsellino elettronico.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )}
</div>
);
};

export default DettaglioTorneo;
