import React, { useState, useMemo } from 'react';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Plus, Minus, FileText, Trash2, X } from 'lucide-react';

const AccountingPlayerDetail = ({ player, transactions, onBack, onAddTransaction, onDeleteTransaction }) => {
    const [type, setType] = useState('entrate'); // 'entrate' (Ricarica) or 'uscite' (Spesa)
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const playerTransactions = useMemo(() => {
        return transactions
            .filter(t => t.id_giocatore === player.id)
            .sort((a, b) => new Date(b.data) - new Date(a.data));
    }, [transactions, player]);

    const balance = useMemo(() => {
        return playerTransactions.reduce((acc, t) => {
            return t.tipo === 'entrate' ? acc + t.importo : acc - t.importo;
        }, 0);
    }, [playerTransactions]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!amount || !description) return;

        onAddTransaction({
            id_giocatore: player.id,
            tipo: type,
            importo: parseFloat(amount),
            descrizione: description,
            data: new Date().toISOString()
        });

        setAmount('');
        setDescription('');
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 p-3 rounded-xl neumorphic-btn text-gray-400">
                    <ArrowLeft className="w-5 h-5" /> Indietro
                </button>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-blue-400">{player.nome} {player.cognome}</h2>
                    <p className={`text-xl font-black ${balance < 10 ? 'text-red-500' : 'text-green-500'}`}>
                        Saldo: € {balance.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Quick Transaction Form */}
            <div className="p-6 rounded-3xl neumorphic-out">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-gray-400" /> Nuova Operazione
                </h3>
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <div className="flex gap-2 mb-2 p-1 bg-[#1a1a1a] rounded-xl w-fit">
                            <button
                                type="button"
                                onClick={() => setType('entrate')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${type === 'entrate' ? 'bg-green-500/20 text-green-400 shadow-inner' : 'text-gray-500'}`}
                            >
                                Ricarica (+€)
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('uscite')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${type === 'uscite' ? 'bg-red-500/20 text-red-400 shadow-inner' : 'text-gray-500'}`}
                            >
                                Spesa (-€)
                            </button>
                        </div>
                    </div>
                    <input
                        type="text"
                        placeholder="Motivazione (es. Ricarica, Iscrizione Torneo...)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="flex-[2] px-4 py-3 rounded-xl neumorphic-in focus:outline-none"
                    />
                    <div className="relative w-32">
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Importo"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl neumorphic-in focus:outline-none text-right font-mono"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                    </div>
                    <button type="submit" className="p-3 rounded-xl neumorphic-btn text-blue-400 disabled:opacity-50">
                        <Plus className="w-6 h-6" />
                    </button>
                </form>
            </div>

            {/* Statement of Account */}
            <div className="p-6 rounded-3xl neumorphic-out">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-400" /> Estratto Conto
                </h3>
                <div className="space-y-3">
                    {playerTransactions.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-4 rounded-xl neumorphic-in group">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-full ${t.tipo === 'entrate' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {t.tipo === 'entrate' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                </div>
                                <div>
                                    <p className="font-bold">{t.descrizione}</p>
                                    <p className="text-xs text-gray-500">{new Date(t.data).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`font-mono font-bold ${t.tipo === 'entrate' ? 'text-green-500' : 'text-red-500'}`}>
                                    {t.tipo === 'entrate' ? '+' : '-'} € {t.importo.toFixed(2)}
                                </span>
                                <button
                                    onClick={() => onDeleteTransaction(t.id)}
                                    className="p-2 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {playerTransactions.length === 0 && (
                        <p className="text-center text-gray-500 italic py-8">Nessun movimento registrato</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountingPlayerDetail;
