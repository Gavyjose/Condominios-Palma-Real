import React, { useState, useEffect } from 'react';
import { Calendar, Lock, Eye, AlertTriangle, CheckCircle } from 'lucide-react';
import { sortApartamentos } from '../utils/sorting';

const HistoricoMensual = ({ config, API_URL }) => {
    const [cierres, setCierres] = useState([]);
    const [loading, setLoading] = useState(false);
    const [detalleCierre, setDetalleCierre] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Estado para el cierre actual
    const [anioCierre, setAnioCierre] = useState(new Date().getFullYear());
    const [mesCierre, setMesCierre] = useState(new Date().getMonth()); // Mes anterior por defecto (0-11)

    useEffect(() => {
        if (config?.condominio_id) {
            fetchCierres();
        }
    }, [config]);

    const fetchCierres = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const resp = await fetch(`${API_URL}/cierres?condominio_id=${config.condominio_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setCierres(data);
            }
        } catch (error) {
            console.error("Error fetching cierres:", error);
        }
    };

    const handleCerrarMes = async () => {
        if (!window.confirm(`¿Estás seguro de cerrar el mes ${mesCierre + 1}/${anioCierre}? Esta acción congelará los movimientos.`)) return;

        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const resp = await fetch(`${API_URL}/cierres/cerrar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    condominio_id: config.condominio_id,
                    anio: anioCierre,
                    mes: mesCierre + 1 // Backend espera 1-12
                })
            });

            const data = await resp.json();
            if (resp.ok) {
                alert("✅ Mes cerrado exitosamente");
                fetchCierres();
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Error cerrando mes:", error);
            alert("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const verDetalle = async (cierre) => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const resp = await fetch(`${API_URL}/cierres/${cierre.id}/detalle`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setDetalleCierre({ meta: cierre, aptos: data });
                setShowModal(true);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center gap-6">
                <div className="p-4 bg-purple-100 rounded-2xl border border-purple-200 text-purple-600">
                    <Calendar size={32} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-ledger-ink uppercase tracking-tighter">Control Histórico</h3>
                    <p className="font-bold text-slate-400 text-xs uppercase tracking-widest mt-1">Cierres Mensuales y Auditoría</p>
                </div>
            </div>

            {/* Panel de Cierre */}
            <div className="ledger-card p-8 bg-white border-t-4 border-t-purple-500 shadow-xl">
                <h4 className="text-sm font-black text-ledger-ink uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                    <Lock className="text-purple-600" size={18} /> Ejecutar Cierre de Mes
                </h4>

                <div className="flex gap-4 items-end bg-purple-50 p-6 rounded-xl border border-purple-100">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Año</label>
                        <select
                            value={anioCierre}
                            onChange={e => setAnioCierre(parseInt(e.target.value))}
                            className="w-32 ledger-input text-center font-bold"
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Mes a Cerrar</label>
                        <select
                            value={mesCierre}
                            onChange={e => setMesCierre(parseInt(e.target.value))}
                            className="w-48 ledger-input font-bold"
                        >
                            {meses.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleCerrarMes}
                        disabled={loading}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg font-black uppercase text-xs tracking-wider hover:bg-purple-700 transition shadow-lg flex items-center gap-2"
                    >
                        {loading ? 'Procesando...' : <><Lock size={16} /> Cerrar Mes</>}
                    </button>

                    <div className="ml-auto max-w-sm">
                        <p className="text-xs text-purple-800 italic leading-relaxed">
                            <AlertTriangle size={14} className="inline mr-1 text-purple-600" />
                            <strong>Atención:</strong> Al cerrar el mes, se generará una "foto" estática de todas las deudas y se bloqueará la edición de registros para ese periodo.
                        </p>
                    </div>
                </div>
            </div>

            {/* Listado de Cierres */}
            <div className="ledger-card p-0 bg-white shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">Historial de Cierres ({cierres.length})</h4>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-100 bg-white">
                    <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-20 shadow-sm bg-slate-50">
                            <tr className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                                <th className="p-4 border-b bg-slate-50">Periodo</th>
                                <th className="p-4 border-b text-right bg-slate-50">Total Gastos</th>
                                <th className="p-4 border-b text-right bg-slate-50">Total Pagos</th>
                                <th className="p-4 border-b text-center bg-slate-50">Fecha Cierre</th>
                                <th className="p-4 border-b text-center bg-slate-50">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {cierres.map(c => (
                                <tr key={c.id} className="hover:bg-purple-50 transition">
                                    <td className="p-4 font-black text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle size={16} className="text-green-500" />
                                            {meses[c.mes - 1]} {c.anio}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-600">${c.total_gastos_usd?.toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono text-slate-600">${c.total_pagos_usd?.toFixed(2)}</td>
                                    <td className="p-4 text-center text-xs text-slate-400">
                                        {new Date(c.fecha_cierre).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => verDetalle(c)}
                                            className="p-2 bg-white border hover:bg-purple-50 text-purple-600 rounded-lg shadow-sm transition"
                                            title="Ver Detalle"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Modal de Detalle */}
                {showModal && detalleCierre && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
                            <div className="p-6 bg-purple-600 text-white flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="font-black uppercase tracking-tight text-xl">
                                        Cierre: {meses[detalleCierre.meta.mes - 1]} {detalleCierre.meta.anio}
                                    </h3>
                                    <p className="text-xs text-purple-200 mt-1 uppercase tracking-widest font-bold opacity-80">
                                        Snapshot Histórico
                                    </p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white text-2xl font-bold">&times;</button>
                            </div>

                            <div className="p-0 overflow-auto flex-1 bg-slate-50">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white text-slate-500 sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="p-4 font-bold border-b">Apartamento</th>
                                            <th className="p-4 font-bold border-b">Propietario</th>
                                            <th className="p-4 font-bold border-b text-right">Deuda Acum. (Inicio)</th>
                                            <th className="p-4 font-bold border-b text-right">Pagado (Mes)</th>
                                            <th className="p-4 font-bold border-b text-right bg-purple-50 text-purple-900">Saldo Final (Cierre)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {sortApartamentos(detalleCierre.aptos).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-4 font-bold text-slate-800">{row.codigo}</td>
                                                <td className="p-4 text-slate-600 text-xs uppercase">{row.propietario}</td>
                                                <td className="p-4 text-right font-mono text-slate-500">${row.deuda_acumulada_usd?.toFixed(2)}</td>
                                                <td className="p-4 text-right font-mono text-green-600">${row.monto_pagado_mes_usd?.toFixed(2)}</td>
                                                <td className="p-4 text-right font-mono font-bold bg-purple-50 text-purple-700">${row.saldo_final_usd?.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 bg-gray-50 border-t flex justify-end shrink-0">
                                <button onClick={() => setShowModal(false)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold uppercase tracking-wide hover:bg-gray-100">
                                    Cerrar Ventana
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoricoMensual;
