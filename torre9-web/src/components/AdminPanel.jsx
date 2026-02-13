import React, { useState, useEffect } from 'react';
import {
    DollarSign,
    Users,
    PiggyBank,
    TrendingUp,
    AlertCircle,
    FileText,
    BrainCircuit,
    Activity,
    ShieldCheck,
    ShieldAlert,
    Loader2
} from 'lucide-react';

export const AdminPanel = ({ data, config, API_URL, porcentajeSolvencia, aptosSolventes, totalAptos }) => {
    const [analytics, setAnalytics] = useState(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);
    const resumen = data.resumen || {};

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const resp = await fetch(`${API_URL}/analytics/projections`, {
                    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
                });
                if (resp.ok) {
                    const result = await resp.json();
                    setAnalytics(result);
                }
            } catch (err) {
                console.error("Error fetching analytics:", err);
            } finally {
                setLoadingAnalytics(false);
            }
        };
        fetchAnalytics();
    }, [API_URL, data.gastos]);

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

            {/* Inteligencia Financiera & Salud */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Solvencia y Ocupación (Gráfico Circular) */}
                <div className="ledger-card p-8 bg-white border-t-4 border-t-purple-500 col-span-1 shadow-sm">
                    <h4 className="text-sm font-black text-ledger-ink uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <Users size={18} className="text-purple-500" /> Solvencia del Sector
                    </h4>

                    <div className="flex flex-col items-center">
                        <div className="relative h-48 w-48 mb-6">
                            {/* Gráfico Circular SVG */}
                            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90 scale-110">
                                <path
                                    className="text-slate-100"
                                    strokeDasharray="100, 100"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3.8"
                                />
                                <path
                                    className="text-emerald-500 transition-all duration-1000 ease-out"
                                    strokeDasharray={`${porcentajeSolvencia}, 100`}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3.8"
                                    strokeLinecap="round"
                                />
                            </svg>
                            {/* Texto Central */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-ledger-ink tracking-tighter">{porcentajeSolvencia}%</span>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Solvente</span>
                            </div>
                        </div>

                        {/* Leyenda */}
                        <div className="w-full space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wide">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-slate-500">Solventes</span>
                                </div>
                                <span className="text-slate-800 font-black">{aptosSolventes} Unidades</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wide">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                    <span className="text-slate-500">Morosos</span>
                                </div>
                                <span className="text-slate-800 font-black">{totalAptos - aptosSolventes} Unidades</span>
                            </div>
                            <div className="h-px bg-slate-100 my-2"></div>
                            <p className="text-[9px] text-center font-bold text-slate-400 uppercase">
                                Sector: {config.nombre_torre || "Torre 9"} • {totalAptos} Unidades Totales
                            </p>
                        </div>
                    </div>
                </div>

                {/* Salud de Cobranza */}
                <div className="ledger-card p-8 bg-white border-t-4 border-t-emerald-500 col-span-1 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-sm font-black text-ledger-ink uppercase tracking-tighter flex items-center gap-2">
                            <Activity size={18} className="text-emerald-500" /> Salud Financiera
                        </h4>
                        {analytics?.salud >= 80 ? <ShieldCheck className="text-emerald-500" /> : <ShieldAlert className="text-amber-500" />}
                    </div>

                    {loadingAnalytics ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-300" /></div>
                    ) : (
                        <div className="space-y-6">
                            <div className="relative pt-1">
                                <div className="flex mb-2 items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-black inline-block py-1 px-2 uppercase rounded-full text-emerald-600 bg-emerald-100">
                                            Índice de Cobranza
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-black inline-block text-emerald-600">
                                            {analytics?.salud}%
                                        </span>
                                    </div>
                                </div>
                                <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-emerald-50 border border-emerald-100">
                                    <div style={{ width: `${analytics?.salud}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all duration-1000"></div>
                                </div>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                                {analytics?.salud >= 90 ? "Excelente: La recaudación cubre plenamente los compromisos." :
                                    analytics?.salud >= 70 ? "Estable: Mantenga el ritmo de cobranza para asegurar reservas." :
                                        "Crítico: Se requiere incentivar la cobranza para evitar déficit."}
                            </p>
                        </div>
                    )}
                </div>

                {/* Proyección Próximo Mes */}
                <div className="ledger-card p-8 bg-white border-t-4 border-t-ledger-accent col-span-1 shadow-sm">
                    <h4 className="text-sm font-black text-ledger-ink uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <BrainCircuit size={18} className="text-ledger-accent" /> Proyección Próxima Cuota
                    </h4>

                    {loadingAnalytics ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-300" /></div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-black text-blue-400 uppercase">Estimado Total</span>
                                    <span className="text-[9px] font-black text-blue-400 uppercase">Promedio: ${formatCurrency(analytics?.promedio)}</span>
                                </div>
                                <h3 className="text-3xl font-black text-ledger-accent tracking-tighter">${formatCurrency(analytics?.proyeccion)}</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase">Cuota Proyectada</p>
                                    <p className="text-sm font-black text-slate-700">${formatCurrency(analytics?.proyeccion / 16)}</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase">Nivel de Confianza</p>
                                    <p className={`text-[10px] font-black uppercase ${analytics?.confianza === 'ALTA' ? 'text-emerald-500' : 'text-amber-500'}`}>{analytics?.confianza}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Alertas de Anomalías */}
                <div className="ledger-card p-8 bg-white border-t-4 border-t-ledger-ink col-span-1 shadow-sm">
                    <h4 className="text-sm font-black text-ledger-ink uppercase tracking-tighter mb-6 flex items-center gap-2">
                        <AlertCircle size={18} className="text-ledger-ink" /> Alertas de Gastos
                    </h4>

                    {loadingAnalytics ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-300" /></div>
                    ) : (
                        <div className="space-y-3">
                            {(analytics?.anomalias || []).length > 0 ? (
                                analytics.anomalias.map((a, i) => (
                                    <div key={i} className="flex gap-4 p-3 bg-amber-50 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors">
                                        <div className="mt-0.5"><AlertCircle size={14} className="text-amber-600" /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-amber-900 uppercase leading-tight">{a.concepto}</p>
                                            <p className="text-[9px] font-bold text-amber-600 mt-0.5">${formatCurrency(a.monto_usd)} (Gasto Inusual)</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center p-6 text-slate-300">
                                    <ShieldCheck size={40} className="mb-2 opacity-20" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-center">Sin anomalías detectadas en el periodo</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Accesos Rápidos o Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="ledger-card p-8 bg-white shadow-sm border border-slate-100">
                    <h4 className="text-sm font-black text-ledger-ink uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <Users size={16} /> Resumen de Ocupación
                    </h4>
                    <div className="flex items-center justify-center h-48 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <div className="text-center">
                            <p className="text-xs font-bold text-slate-400 uppercase">Sector: {config.nombre_torre || "Torre A"}</p>
                            <div className="mt-4 flex gap-2">
                                <div className="h-2 w-32 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-ledger-accent" style={{ width: '100%' }}></div>
                                </div>
                                <span className="text-[10px] font-black text-slate-500">100% OCUPADO</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="ledger-card p-8 bg-white shadow-sm border border-slate-100">
                    <h4 className="text-sm font-black text-ledger-ink uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <FileText size={16} /> Últimos Movimientos
                    </h4>
                    <div className="space-y-4">
                        {(data.gastos || []).slice(0, 5).map((gasto, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                                <div>
                                    <p className="text-xs font-black text-slate-700 uppercase">{gasto.concepto}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{gasto.mes_anio}</p>
                                </div>
                                <span className="text-xs font-mono font-black text-slate-800">${formatCurrency(gasto.monto_usd)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
