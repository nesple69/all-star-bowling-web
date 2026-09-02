import React from 'react';
import { ExternalLink, FileText, Users } from 'lucide-react';

const Footer: React.FC = () => {
    return (
        <footer className="bg-slate-900 text-white pt-12 pb-8 border-t border-white/10 mt-auto">
            <div className="container mx-auto px-4 md:px-6 lg:px-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                    {/* Brand Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-24 h-24 flex items-center justify-center overflow-visible">
                                <img src="/logo All Star.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow-xl" onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0Y4QjUwMCIgZD0iTTEyIDFsMy4zOSA2LjY4IDcuNjEgMS4xLTUuNSA1LjM2IDEuMyA3LjYyLTkuOC0zLjY2LTYuOCA0Ljk2IDEuMy03LjYyLTUuNS01LjM2IDcuNjEtMS4xTDEyIDFsMy4zOSA2LjY4eiIvPjwvc3ZnPg==';
                                }} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold tracking-tight uppercase leading-none">
                                    ALL STAR <span className="text-primary">TEAM</span>
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    Bowling asd
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                            Associazione Sportiva Dilettantistica dedicata alla promozione del bowling d'eccellenza in Toscana.
                        </p>
                    </div>

                    {/* Link Istituzionali */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary/80">Link Istituzionali</h3>
                        <ul className="space-y-3">
                            <li>
                                <a
                                    href="https://www.fisb.it"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm group"
                                >
                                    <ExternalLink size={14} className="group-hover:text-primary transition-colors" />
                                    Federazione Italiana Bowling
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://www.fisb.it/repository/reg-tecnico-sportivo-2020/Modulistica/Regolamento-Tecnico-Sportivo-2026-2027/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm group"
                                >
                                    <FileText size={14} className="group-hover:text-primary transition-colors" />
                                    Regolamenti
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Documenti */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary/80">Documentazione</h3>
                        <ul className="space-y-3">
                            <li>
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        alert('PDF Direttivo in arrivo - In aggiornamento');
                                    }}
                                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm group"
                                >
                                    <Users size={14} className="group-hover:text-primary transition-colors" />
                                    Direttivo (PDF)
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Contatti */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary/80">Sede</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            via Tosco Romagnola, 127<br />
                            56012 Calcinaia (PI)<br />
                            P. IVA 01858070509<br />
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-2 inline-block">Affiliata FISB / CONI</span>
                        </p>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-center items-center gap-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                        © {new Date().getFullYear()} ASD All Star TEAM (v2). Tutti i diritti riservati.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
