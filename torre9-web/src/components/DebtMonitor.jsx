import React, { useState, useEffect } from 'react';
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
    TrendingDown,
    TrendingUp,
    AlertCircle,
    PlusCircle,
    X,
    Upload,
    Hash
} from 'lucide-react';
import { sortApartamentos } from '../utils/sorting';

const formatNumber = (num) => {
    const val = parseFloat(num) || 0;
    return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const DebtMonitor = ({ data, onUpdate }) => {
    const [showReportForm, setShowReportForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Estado del Formulario Extendido
    const [formData, setFormData] = useState({
        apto: '',
        monto_usd: '',
        monto_bs: '',
        fecha_pago: new Date().toISOString().split('T')[0],
        referencia: ''
    });

    const [tasaBCV, setTasaBCV] = useState(null);
    const [loadingTasa, setLoadingTasa] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [ocrStatus, setOcrStatus] = useState('IDLE'); // IDLE, SCANNING, VALID, ERROR
    const [ocrError, setOcrError] = useState('');

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    // Buscar tasa al cambiar fecha (Igual que OwnerPanel)
    useEffect(() => {
        const fetchTasa = async () => {
            if (!formData.fecha_pago) return;
            setLoadingTasa(true);
            try {
                const resp = await fetch(`${API_URL}/tasas/${formData.fecha_pago}`);
                if (resp.ok) {
                    const data = await resp.json();
                    setTasaBCV(data.valor);
                } else {
                    setTasaBCV(null);
                }
            } catch (err) {
                console.error("Error fetching tasa:", err);
                setTasaBCV(null);
            } finally {
                setLoadingTasa(false);
            }
        };
        fetchTasa();
    }, [formData.fecha_pago]);

    // Utilidades de Conversión y Formateo (Paridad con App.jsx)
    const parseNumeric = (val) => {
        if (!val || val === '') return 0;
        let s = val.toString().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
        const num = parseFloat(s);
        return isNaN(num) ? 0 : num;
    };

    const formatInput = (val) => {
        try {
            if (val === undefined || val === null || val === '') return "";
            let s = val.toString().replace(/\s/g, '');
            if (s.includes('.') && !s.includes(',')) {
                const parts = s.split('.');
                if (parts.length === 2) s = s.replace('.', ',');
            }
            s = s.replace(/[^0-9,]/g, '');
            let parts = s.split(',');
            let int = parts[0] || "0";
            let dec = parts.length > 1 ? parts.slice(1).join('').replace(/[^0-9]/g, '') : undefined;
            int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            return dec !== undefined ? `${int},${dec.slice(0, 2)}` : int;
        } catch (e) { return ""; }
    };

    const handleUsdChange = (val) => {
        let processed = val;
        if (val.length > formData.monto_usd.length) {
            const addedChar = val.charAt(val.length - 1);
            if (addedChar === '.') processed = val.slice(0, -1) + ',';
        }
        const naked = processed.replace(/\./g, '');
        const formatted = formatInput(naked);
        const numericVal = parseNumeric(formatted);
        setFormData({
            ...formData,
            monto_usd: formatted,
            monto_bs: tasaBCV ? formatInput((numericVal * tasaBCV).toFixed(2)) : formData.monto_bs
        });
        setOcrStatus('IDLE');
    };

    const handleBsChange = (val) => {
        let processed = val;
        if (val.length > (formData.monto_bs || "").length) {
            const addedChar = val.charAt(val.length - 1);
            if (addedChar === '.') processed = val.slice(0, -1) + ',';
        }
        const naked = processed.replace(/\./g, '');
        const formatted = formatInput(naked);
        const numericVal = parseNumeric(formatted);
        setFormData({
            ...formData,
            monto_bs: formatted,
            monto_usd: tasaBCV ? formatInput((numericVal / tasaBCV).toFixed(2)) : formData.monto_usd
        });
        setOcrStatus('IDLE');
    };

    // Manejador de OCR
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!formData.referencia) {
            alert("Por favor, ingresa primero el número de referencia manualmente.");
            e.target.value = '';
            return;
        }

        setSelectedFile(file);
        setOcrStatus('SCANNING');
        setOcrError('');

        const formDataOCR = new FormData();
        formDataOCR.append('imagen', file);
        formDataOCR.append('referenciaManual', formData.referencia);
        formDataOCR.append('montoManual', formData.monto_bs || formData.monto_usd);

        try {
            const resp = await fetch(`${API_URL}/pagos/validate-receipt`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` },
                body: formDataOCR
            });
            const result = await resp.json();
            if (result.valid) setOcrStatus('VALID');
            else {
                setOcrStatus('ERROR');
                setOcrError(result.error);
            }
        } catch (error) {
            setOcrStatus('ERROR');
            setOcrError("Error conectando con el motor de validación.");
        }
    };

    const cobranzas = sortApartamentos(data?.cobranzas || []);
    const notifications = data?.notifications || [];

    // Alícuota fija según requerimientos previos (Total / 16 aptos)
    const alicuotaMensual = data?.resumen?.promedio_alicuota || 0;

    // Totales para el pie de página
    const totales = cobranzas.reduce((acc, c) => {
        const aptoPayments = notifications.filter(n => n.apto === c.apto);
        const totalBs = aptoPayments.reduce((sum, p) => sum + (p.monto_bs || (p.monto * (p.tasa_bcv || 36.5))), 0);
        const totalUsd = aptoPayments.reduce((sum, p) => sum + p.monto, 0);
        const saldoInicial = c.deuda_acumulada || (c.saldo + c.pagado);
        const saldoAl31 = saldoInicial - totalUsd;
        const saldoFinal = saldoAl31 + alicuotaMensual;

        return {
            saldoInicial: acc.saldoInicial + saldoInicial,
            bs: acc.bs + totalBs,
            usd: acc.usd + totalUsd,
            saldoAl31: acc.saldoAl31 + saldoAl31,
            alicuota: acc.alicuota + alicuotaMensual,
            saldoFinal: acc.saldoFinal + saldoFinal
        };
    }, { saldoInicial: 0, bs: 0, usd: 0, saldoAl31: 0, alicuota: 0, saldoFinal: 0 });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (ocrStatus !== 'VALID') {
            alert("Debes validar el comprobante con la captura del pago antes de ejecutar la carga.");
            return;
        }

        setIsSubmitting(true);

        const payload = {
            apto: formData.apto,
            fecha: formData.fecha_pago,
            referencia: formData.referencia,
            tasa_bcv: tasaBCV,
            monto: parseNumeric(formData.monto_usd),
            monto_bs: parseNumeric(formData.monto_bs),
            validacion_ocr: 'VALIDADO'
        };

        try {
            const res = await fetch(`${API_URL}/pagos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsSuccess(true);
                if (onUpdate) await onUpdate();
                setTimeout(() => {
                    setIsSuccess(false);
                    setShowReportForm(false);
                    setFormData({
                        apto: '',
                        monto_usd: '',
                        monto_bs: '',
                        fecha_pago: new Date().toISOString().split('T')[0],
                        referencia: ''
                    });
                    setTasaBCV(null);
                    setOcrStatus('IDLE');
                    setSelectedFile(null);
                }, 2000);
            }
        } catch (error) {
            console.error("Error reportando pago:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="ledger-card p-10 flex flex-col md:flex-row items-center justify-between bg-white border-l-4 border-l-ledger-accent gap-8 shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-ledger-audit rounded-2xl border border-ledger-border shadow-inner text-ledger-accent">
                        <TrendingUp size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-ledger-ink uppercase tracking-tighter">Libro Mayor de Cobranzas Mensual</h3>
                        <p className="font-bold text-slate-400 text-xs uppercase tracking-widest mt-1">Auditoría de Conciliación y Cuentas por Cobrar</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowReportForm(!showReportForm)}
                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${showReportForm ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-ledger-ink text-white hover:bg-black shadow-xl shadow-ledger-ink/20'}`}
                    >
                        {showReportForm ? <><X size={16} /> Cancelar Carga</> : <><PlusCircle size={16} /> Carga Administrativa</>}
                    </button>
                    <div className="w-px h-12 bg-slate-200 mx-2 hidden md:block"></div>
                    <div className="bg-ledger-audit p-4 rounded-xl border border-ledger-border border-b-red-400 border-b-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase block tracking-widest">Saldo Pendiente Global</span>
                        <span className="text-xl font-mono font-black text-red-600 tracking-tighter">${formatNumber(totales.saldoFinal)}</span>
                    </div>
                </div>
            </div>

            {/* Formulario de Carga Administrativa */}
            {showReportForm && (
                <div className="ledger-card p-8 bg-white border-t-4 border-t-ledger-accent animate-in fade-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-8">
                        <h4 className="text-sm font-black text-ledger-ink uppercase tracking-[0.2em] flex items-center gap-3">
                            <PlusCircle className="text-ledger-accent" size={18} /> Registrar Cobranza Externa (WhatsApp/Chat)
                        </h4>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidad Inmobiliaria</label>
                            <select
                                required
                                value={formData.apto}
                                onChange={(e) => setFormData({ ...formData, apto: e.target.value })}
                                className="ledger-input bg-ledger-audit border-slate-200 text-[11px] font-black uppercase"
                            >
                                <option value="" disabled>Seleccionar...</option>
                                {cobranzas.map(c => (
                                    <option key={c.apto} value={c.apto}>{c.apto} - {c.propietario}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha del Pago</label>
                            <div className="relative group">
                                <Calendar className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-ledger-accent transition-colors" size={16} />
                                <input
                                    required
                                    type="date"
                                    value={formData.fecha_pago}
                                    onChange={(e) => setFormData({ ...formData, fecha_pago: e.target.value })}
                                    className="ledger-input pl-12 bg-ledger-audit border-slate-200 text-[11px] font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nro de Referencia</label>
                            <div className="relative group">
                                <Hash className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-ledger-accent transition-colors" size={16} />
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej: 445588"
                                    value={formData.referencia}
                                    onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                                    className="ledger-input pl-12 bg-ledger-audit border-slate-200 text-[11px] font-mono uppercase"
                                />
                            </div>
                        </div>

                        {/* Tasa BCV Info */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tasa Auditoría BCV</label>
                            <div className="h-[42px] flex items-center justify-between px-4 bg-ledger-audit border border-slate-200 rounded-xl">
                                <Banknote size={14} className="text-ledger-accent" />
                                <span className="text-[11px] font-mono font-black text-ledger-ink">
                                    {loadingTasa ? "..." : (tasaBCV ? `${formatNumber(tasaBCV)}` : "S/I")}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-ledger-accent uppercase tracking-widest ml-1">Monto del Abono ($)</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-3 text-slate-300 group-focus-within:text-ledger-accent font-black text-xs">$</span>
                                <input
                                    required
                                    type="text"
                                    placeholder="0,00"
                                    value={formData.monto_usd}
                                    onChange={(e) => handleUsdChange(e.target.value)}
                                    className="ledger-input pl-10 bg-blue-50/30 border-blue-100 text-[11px] font-mono font-black text-ledger-accent"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1">Equivalente en Bolívares (Bs)</label>
                            <div className="relative group">
                                <span className="absolute left-4 top-3 text-slate-300 group-focus-within:text-emerald-600 font-black text-xs">Bs</span>
                                <input
                                    required
                                    type="text"
                                    placeholder="0,00"
                                    value={formData.monto_bs}
                                    onChange={(e) => handleBsChange(e.target.value)}
                                    className="ledger-input pl-12 bg-emerald-50/30 border-emerald-100 text-[11px] font-mono font-black text-emerald-600"
                                />
                            </div>
                        </div>

                        {/* Input de File / OCR */}
                        <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[9px] font-black text-ledger-ink uppercase tracking-widest ml-1">Soporte Digital (WhatsApp/Chat)</label>
                            <div className="relative h-[42px] group overflow-hidden">
                                <input required type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                                <div className={`h-full px-4 rounded-xl border flex items-center justify-between transition-all ${ocrStatus === 'VALID' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'bg-white border-slate-200'}`}>
                                    <div className="flex items-center gap-2">
                                        {ocrStatus === 'SCANNING' ? <Loader2 size={14} className="animate-spin text-ledger-accent" /> : <Upload size={14} className="text-slate-400" />}
                                        <span className="text-[9px] font-black uppercase truncate max-w-[150px]">
                                            {selectedFile ? selectedFile.name : "Adjuntar Capture..."}
                                        </span>
                                    </div>
                                    <span className="text-[8px] font-black px-2 py-0.5 rounded bg-ledger-audit border">
                                        {ocrStatus === 'VALID' ? "VALIDADO" : ocrStatus === 'ERROR' ? "ERROR" : "PENDIENTE"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-4 flex justify-end items-center gap-4 pt-4 border-t border-slate-100">
                            {ocrStatus === 'ERROR' && <span className="text-[8px] font-black text-red-500 uppercase">{ocrError}</span>}
                            <button
                                disabled={isSubmitting || isSuccess || ocrStatus === 'SCANNING'}
                                type="submit"
                                className={`px-10 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 ${ocrStatus === 'VALID' ? (isSuccess ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-ledger-accent text-white hover:bg-blue-700 shadow-blue-600/20 shadow-lg') : 'bg-ledger-audit text-slate-300 cursor-not-allowed'}`}
                            >
                                {isSubmitting ? <><Loader2 className="animate-spin" size={14} /> PROCESANDO...</> :
                                    isSuccess ? <><CheckCircle2 size={14} /> CARGA EXITOSA</> :
                                        <><PlusCircle size={14} /> EJECUTAR CARGA ADMINISTRATIVA</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="ledger-card overflow-hidden bg-white shadow-xl border-t-8 border-t-ledger-ink">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-ledger-border/40 rounded-2xl">
                    <table className="w-full text-left border-collapse table-fixed min-w-[1000px] relative">
                        <thead className="sticky top-0 z-20 shadow-md">
                            {/* Encabezado Superior Estilo Excel */}
                            <tr className="bg-ledger-ink text-white/50 text-[9px] font-black uppercase tracking-[0.2em]">
                                <th colSpan="2" className="p-2 text-center border-r border-white/10 bg-ledger-ink">Identificación</th>
                                <th colSpan="4" className="p-2 text-center border-r border-white/10 bg-[#0c2461]">Cobranzas del Mes</th>
                                <th colSpan="2" className="p-2 text-center bg-ledger-ink">Cuentas por Cobrar</th>
                            </tr>
                            <tr className="ledger-table-header uppercase text-[10px]">
                                <th className="p-4 border-r border-ledger-border/50 w-48 bg-slate-100 italic">Propietario</th>
                                <th className="p-4 border-r border-ledger-border/50 w-20 text-center bg-slate-100">Apto</th>
                                <th className="p-4 text-right border-r border-ledger-border/50 bg-yellow-50 font-black">Saldo Inicial</th>
                                <th className="p-4 text-right border-r border-ledger-border/50 bg-slate-100">Pago Bs</th>
                                <th className="p-4 text-right border-r border-ledger-border/50 bg-slate-100">Pago $</th>
                                <th className="p-4 text-right border-r border-ledger-border/50 bg-slate-100 font-black">Subtotal</th>
                                <th className="p-4 text-right border-r border-ledger-border/50 text-blue-600 bg-blue-50">Alic. Próx</th>
                                <th className="p-4 text-right bg-ledger-audit font-black text-ledger-ink">Saldo Final</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px]">
                            {cobranzas.map((c, i) => {
                                const aptoPayments = notifications.filter(n => n.apto === c.apto);
                                const totalBs = aptoPayments.reduce((sum, p) => sum + (p.monto_bs || (p.monto * (p.tasa_bcv || 36.5))), 0);
                                const totalUsd = aptoPayments.reduce((sum, p) => sum + p.monto, 0);
                                const saldoInicial = c.deuda_acumulada || (c.saldo + c.pagado);
                                const saldoAl31 = saldoInicial - totalUsd;
                                const saldoFinal = saldoAl31 + alicuotaMensual;

                                return (
                                    <tr key={i} className="ledger-row group hover:bg-slate-50 transition-all border-b border-ledger-border/50">
                                        <td className="p-4 font-black text-slate-600 border-r border-ledger-border/10 uppercase truncate">{c.propietario}</td>
                                        <td className="p-4 font-black text-ledger-ink border-r border-ledger-border/10 text-center tracking-widest">{c.apto}</td>
                                        <td className="p-4 text-right font-mono text-slate-400 border-r border-ledger-border/10 bg-yellow-50/10">${formatNumber(saldoInicial)}</td>
                                        <td className="p-4 text-right font-mono text-slate-500 border-r border-ledger-border/10">{formatNumber(totalBs)}</td>
                                        <td className="p-4 text-right font-mono text-emerald-600 border-r border-ledger-border/10 font-bold">{formatNumber(totalUsd)}</td>
                                        <td className="p-4 text-right font-mono font-black text-slate-600 border-r border-ledger-border/10 bg-slate-50/50">${formatNumber(saldoAl31)}</td>
                                        <td className="p-4 text-right font-mono font-bold text-blue-600 border-r border-ledger-border/10 bg-blue-50/10">${formatNumber(alicuotaMensual)}</td>
                                        <td className={`p-4 text-right font-mono font-black bg-ledger-audit ${saldoFinal > 0 ? 'text-red-600' : 'text-emerald-500'}`}>
                                            ${formatNumber(saldoFinal)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {/* Pie de Página con Totales (POR COBRAR) */}
                        <tfoot>
                            <tr className="bg-ledger-audit font-black text-ledger-ink text-[11px]">
                                <td colSpan="2" className="p-5 uppercase tracking-[0.2em] border-r border-ledger-border text-ledger-accent">Totales (Por Cobrar)</td>
                                <td className="p-5 text-right font-mono border-r border-ledger-border">${formatNumber(totales.saldoInicial)}</td>
                                <td className="p-5 text-right font-mono border-r border-ledger-border uppercase">{formatNumber(totales.bs)} Bs</td>
                                <td className="p-5 text-right font-mono border-r border-ledger-border">${formatNumber(totales.usd)}</td>
                                <td className="p-5 text-right font-mono border-r border-ledger-border bg-slate-100">${formatNumber(totales.saldoAl31)}</td>
                                <td className="p-5 text-right font-mono border-r border-ledger-border text-blue-600 bg-blue-100/20">${formatNumber(totales.alicuota)}</td>
                                <td className="p-5 text-right font-mono bg-ledger-ink text-white">${formatNumber(totales.saldoFinal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] px-4">
                <span>Sistema de Gestión Torre 9 v2.5</span>
                <span className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Base de Datos Sincronizada</span>
            </div>
        </div>
    );
};

export default DebtMonitor;
