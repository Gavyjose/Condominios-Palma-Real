import React, { useState } from 'react';
import {
    History,
    User as UserIcon,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    Banknote,
    Calendar,
    Building2,
    ChevronRight,
    FileText
} from 'lucide-react';
import { sortApartamentos } from '../utils/sorting';

const formatNumber = (num) => {
    const val = parseFloat(num) || 0;
    return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ControlPagos = ({ data }) => {
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [ledgerData, setLedgerData] = useState(null);
    const [loading, setLoading] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    // Obtener lista de apartamentos de las cobranzas existentes
    const units = data?.cobranzas || [];

    const handleSelectUnit = async (apto) => {
        setLoading(true);
        setSelectedUnit(apto);

        try {
            // Cargar notificaciones filtradas por apartamento
            const resp = await fetch(`${API_URL}/notificaciones?apto=${apto}&status=ALL`);
            const logs = await resp.json();

            const unitInfo = units.find(u => u.apto === apto);

            const alicuotaMensual = parseFloat(data?.resumen?.promedio_alicuota) || 0;
            const deudaPrevia = parseFloat(unitInfo?.deuda) || 0;
            const deudaInicial = deudaPrevia + alicuotaMensual;
            const totalAbonado = logs.reduce((sum, l) => sum + (parseFloat(l.monto) || 0), 0);
            const saldoPendiente = deudaInicial - totalAbonado;

            // Construir objeto de ledger dinámico
            setLedgerData({
                apto: apto,
                propietario: unitInfo?.propietario || "PROPIETARIO NO REGISTRADO",
                resumen: {
                    deuda_inicial: deudaInicial,
                    total_pagado_usd: totalAbonado,
                    saldo_pendiente: saldoPendiente
                },
                movimientos: logs.map(l => ({
                    id: l.id,
                    fecha: l.fecha_pago,
                    concepto: `ABONO - REF #${l.referencia}`,
                    tipo: "ABONO",
                    monto_usd: l.monto,
                    tasa_bcv: l.tasa_bcv || 0,
                    monto_bs: l.monto_bs || (l.monto * (l.tasa_bcv || 0)),
                    referencia: l.referencia,
                    balance: 0
                }))
            });
        } catch (err) {
            console.error("Error cargando ledger:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="ledger-card p-6 flex flex-col md:flex-row items-center justify-between bg-white border-l-4 border-l-ledger-accent gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-ledger-audit rounded-xl border border-ledger-border shadow-inner text-ledger-accent">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-ledger-ink uppercase tracking-tighter">Auditoría Individual de Pagos</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Generación de Estado de Cuenta por Unidad Inmobiliaria</p>
                    </div>
                </div>

                <div className="w-full md:w-64">
                    <select
                        className="ledger-input bg-ledger-audit border-ledger-border font-black uppercase tracking-widest text-[10px]"
                        onChange={(e) => handleSelectUnit(e.target.value)}
                        defaultValue=""
                    >
                        <option value="" disabled>Seleccionar Unidad...</option>
                        {sortApartamentos(units).map(u => (
                            <option key={u.apto} value={u.apto}>{u.apto} - {u.propietario}</option>
                        ))}
                    </select>
                </div>
            </div>

            {!selectedUnit ? (
                <div className="ledger-card p-24 text-center flex flex-col items-center gap-6 bg-white/50 backdrop-blur-sm border-dashed">
                    <div className="p-8 bg-ledger-audit rounded-full border border-ledger-border shadow-inner text-slate-200">
                        <History size={64} strokeWidth={1} />
                    </div>
                    <p className="font-bold text-slate-400 text-xs uppercase tracking-[0.2em]">Seleccione un apartamento para iniciar el proceso de auditoría</p>
                </div>
            ) : loading ? (
                <div className="p-24 text-center">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-ledger-accent border-t-transparent rounded-full mb-4"></div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Consultando Libros Contables...</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatSmallCard title="Deuda Inicial Auditada" value={`$${formatNumber(ledgerData?.resumen.deuda_inicial)}`} icon={<Wallet size={16} />} color="border-slate-200" />
                        <StatSmallCard title="Total Abonado Real" value={`$${formatNumber(ledgerData?.resumen.total_pagado_usd)}`} icon={<ArrowDownLeft size={16} />} color="border-emerald-200" textColor="text-emerald-600" />
                        <StatSmallCard
                            title="Saldo Pendiente Actual"
                            value={`$${formatNumber(ledgerData?.resumen.saldo_pendiente)}`}
                            icon={<ArrowUpRight size={16} />}
                            color="border-red-200"
                            textColor={ledgerData?.resumen.saldo_pendiente > 0 ? "text-red-600" : "text-emerald-600"}
                        />
                    </div>

                    <div className="ledger-card overflow-hidden">
                        <div className="p-6 border-b border-ledger-border bg-white flex justify-between items-center">
                            <div className="flex gap-4 items-center">
                                <UserIcon size={18} className="text-slate-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-ledger-ink">{ledgerData?.propietario}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="px-3 py-1 bg-ledger-audit rounded-lg text-[9px] font-black text-slate-500 uppercase">Unidad {ledgerData?.apto}</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto max-h-[400px] border border-ledger-border/40 rounded-xl bg-white">
                            <table className="w-full text-left border-collapse relative">
                                <thead className="sticky top-0 z-20 shadow-sm">
                                    <tr className="ledger-table-header">
                                        <th className="p-4 border-r border-ledger-border/50 bg-slate-50">Fecha</th>
                                        <th className="p-4 border-r border-ledger-border/50 bg-slate-50">Concepto de Operación</th>
                                        <th className="p-4 text-right border-r border-ledger-border/50 bg-slate-50">Abono ($)</th>
                                        <th className="p-4 text-right border-r border-ledger-border/50 bg-slate-50">Referencia (Bs)</th>
                                        <th className="p-4 text-center bg-slate-50">Estatus</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[11px]">
                                    {ledgerData?.movimientos.length > 0 ? ledgerData.movimientos.map((m, i) => (
                                        <tr key={i} className="ledger-row group bg-emerald-50/10">
                                            <td className="p-4 text-slate-400 font-mono border-r border-ledger-border/10">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={12} /> {m.fecha}
                                                </div>
                                            </td>
                                            <td className="p-4 font-black uppercase border-r border-ledger-border/10 text-emerald-600">
                                                {m.concepto}
                                            </td>
                                            <td className="p-4 text-right font-mono font-black border-l border-ledger-border/10 text-emerald-600">
                                                ${formatNumber(m.monto_usd)}
                                            </td>
                                            <td className="p-4 text-right font-mono text-slate-500 border-l border-ledger-border/10">
                                                {formatNumber(m.monto_bs)} Bs
                                            </td>
                                            <td className="p-4 text-center border-l border-ledger-border/10">
                                                <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-50 px-2 py-1 rounded">Aplicado</span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="p-12 text-center text-slate-300 font-black uppercase tracking-[0.2em] text-xs">Sin registros de abono detectados.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const StatSmallCard = ({ title, value, icon, color, textColor = "text-ledger-ink" }) => (
    <div className={`p-6 ledger-card border-b-4 ${color} bg-white shadow-sm`}>
        <div className="flex justify-between items-center mb-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{title}</span>
            <div className="text-slate-200">{icon}</div>
        </div>
        <div className={`text-2xl font-mono font-black tracking-tighter ${textColor}`}>{value}</div>
    </div>
);

export default ControlPagos;
