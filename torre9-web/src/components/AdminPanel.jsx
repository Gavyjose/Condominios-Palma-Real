import React from 'react';
import { DollarSign, Users, PiggyBank, TrendingUp, AlertCircle, FileText } from 'lucide-react';

export const AdminPanel = ({ data, porcentajeSolvencia, aptosSolventes, totalAptos }) => {
    const resumen = data.resumen || {};

    // Función auxiliar para formatear moneda
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Fondo de Reserva */}
                <div className="ledger-card p-6 bg-white border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                            <PiggyBank size={24} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Reservas</span>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-ledger-ink tracking-tight">${formatCurrency(resumen.fondoReserva)}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Fondo de Reserva</p>
                    </div>
                </div>

                {/* Cuentas por Cobrar */}
                <div className="ledger-card p-6 bg-white border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-50 rounded-xl text-red-500">
                            <AlertCircle size={24} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Deuda</span>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-ledger-ink tracking-tight">${formatCurrency(resumen.cuentasPorCobrar)}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Total por Cobrar</p>
                    </div>
                </div>

                {/* Efectivo en Caja */}
                <div className="ledger-card p-6 bg-white border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                            <DollarSign size={24} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Disponible</span>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-ledger-ink tracking-tight">{formatCurrency(resumen.efectivoCajaBs)} Bs</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Efectivo en Caja</p>
                    </div>
                </div>

                {/* Solvencia */}
                <div className="ledger-card p-6 bg-white border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                            <TrendingUp size={24} />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${parseFloat(porcentajeSolvencia) > 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {porcentajeSolvencia}%
                        </span>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-ledger-ink tracking-tight">{aptosSolventes} / {totalAptos}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Unidades Solventes</p>
                    </div>
                </div>
            </div>

            {/* Accesos Rápidos o Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="ledger-card p-8 bg-white shadow-sm border border-slate-100">
                    <h4 className="text-sm font-black text-ledger-ink uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <Users size={16} /> Resumen de Ocupación
                    </h4>
                    <div className="flex items-center justify-center h-48 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase">Gráfico de Ocupación (Próximamente)</p>
                    </div>
                </div>

                <div className="ledger-card p-8 bg-white shadow-sm border border-slate-100">
                    <h4 className="text-sm font-black text-ledger-ink uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <FileText size={16} /> Últimos Movimientos
                    </h4>
                    <div className="space-y-4">
                        {(data.gastos || []).slice(0, 3).map((gasto, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                                <div>
                                    <p className="text-xs font-black text-slate-700 uppercase">{gasto.concepto}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{gasto.fecha}</p>
                                </div>
                                <span className="text-xs font-mono font-black text-slate-800">${formatCurrency(gasto.usd)}</span>
                            </div>
                        ))}
                        {(data.gastos || []).length === 0 && (
                            <div className="flex items-center justify-center h-24 text-xs font-bold text-slate-400 uppercase">
                                Sin movimientos recientes
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
