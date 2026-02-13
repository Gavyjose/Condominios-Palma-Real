import React, { useState, useEffect } from 'react';
import {
    Wallet,
    Users,
    Banknote,
    TrendingUp,
    Info,
    AlertCircle,
    CheckCircle2,
    Filter,
    User,
    LayoutDashboard,
    Calendar,
    DollarSign,
    Hash,
    Upload,
    FileText,
    Download,
    Loader2,
    FileBarChart,
    Printer,
    ChevronRight,
    Search,
    Building2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const formatNumber = (num) => {
    const val = parseFloat(num) || 0;
    return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

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
    } catch (e) {
        return "";
    }
};

const OwnerPanel = ({ data, selectedApto, setSelectedApto, onPaymentNotified, config }) => {
    const [formData, setFormData] = useState({ fecha: '', monto_usd: '', monto_bs: '', referencia: '' });
    const [tasaBCV, setTasaBCV] = useState(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [loadingTasa, setLoadingTasa] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [ocrStatus, setOcrStatus] = useState('IDLE'); // IDLE, SCANNING, VALID, ERROR
    const [ocrError, setOcrError] = useState('');
    const [extractedFields, setExtractedFields] = useState([]);

    const currentData = (data.cobranzas || []).find(c => c.apto === selectedApto);
    const terrazaData = (data.terraza || []).find(t => t.apto === selectedApto);
    const totalDeuda = currentData ? (currentData.deuda || currentData.deuda_total_usd || 0) : 0;

    // Función para ajustar fecha si es fin de semana (Sábado -> Viernes, Domingo -> Viernes)
    const getAdjustedDate = (dateString) => {
        if (!dateString) return dateString;
        const date = new Date(dateString + 'T12:00:00'); // Evitar problemas de timezone
        const day = date.getDay(); // 0 = Domingo, 6 = Sábado

        const adjusted = new Date(date);
        if (day === 0) { // Domingo -> Retroceder 2 días
            adjusted.setDate(date.getDate() - 2);
        } else if (day === 6) { // Sábado -> Retroceder 1 día
            adjusted.setDate(date.getDate() - 1);
        } else {
            return dateString;
        }
        return adjusted.toISOString().split('T')[0];
    };

    useEffect(() => {
        const fetchTasa = async () => {
            if (!formData.fecha) return;
            const fechaConsulta = getAdjustedDate(formData.fecha);
            setLoadingTasa(true);
            try {
                const resp = await fetch(`${API_URL}/tasas/${fechaConsulta}`);
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
    }, [formData.fecha]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setOcrStatus('SCANNING');
        setOcrError('');

        const formDataOCR = new FormData();
        formDataOCR.append('imagen', file);
        // Si ya hay valores manuales, los enviamos para validación cruzada
        formDataOCR.append('referenciaManual', formData.referencia || '');
        formDataOCR.append('montoManual', formData.monto_bs || formData.monto_usd || '');

        try {
            const resp = await fetch(`${API_URL}/pagos/validate-receipt`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` },
                body: formDataOCR
            });
            const result = await resp.json();

            if (result.valid || (result.extracted && result.extracted.referencia)) {
                setOcrStatus('VALID');

                // Auto-completado inteligente
                if (result.extracted) {
                    const { referencia, monto, fecha } = result.extracted;
                    const newExtracted = [];
                    if (referencia) newExtracted.push('referencia');
                    if (monto) newExtracted.push('monto_bs');
                    if (fecha) newExtracted.push('fecha');
                    setExtractedFields(newExtracted);

                    setFormData(prev => ({
                        ...prev,
                        referencia: referencia || prev.referencia,
                        // Priorizamos el monto extraído si no hay uno manual
                        monto_bs: monto && !prev.monto_bs ? formatInput(monto.toFixed(2)) : prev.monto_bs,
                        fecha: fecha || prev.fecha
                    }));

                    // Si extrajimos el monto en BS y tenemos tasa, calculamos el USD
                    if (monto && tasaBCV && !formData.monto_usd) {
                        setFormData(prev => ({
                            ...prev,
                            monto_usd: formatInput((monto / tasaBCV).toFixed(2))
                        }));
                    }
                }
            } else {
                setOcrStatus('ERROR');
                setOcrError(result.error || "No se pudo validar la referencia en el comprobante.");
            }
        } catch (error) {
            setOcrStatus('ERROR');
            setOcrError("Error conectando con el motor de validación.");
        }
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (ocrStatus !== 'VALID') {
            alert("Debes validar el comprobante con la captura de pantalla antes de enviar.");
            return;
        }

        const payload = {
            apto: selectedApto,
            fecha: formData.fecha,
            referencia: formData.referencia,
            tasa_bcv: tasaBCV,
            monto: parseNumeric(formData.monto_usd),
            monto_bs: parseNumeric(formData.monto_bs),
            validacion_ocr: 'VALIDADO'
        };

        try {
            const resp = await fetch(`${API_URL}/pagos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                setIsSuccess(true);
                setTimeout(() => setIsSuccess(false), 3000);
                setFormData({ fecha: '', monto_usd: '', monto_bs: '', referencia: '' });
                setTasaBCV(null);
                setOcrStatus('IDLE');
                setSelectedFile(null);
                onPaymentNotified();
            }
        } catch (err) { console.error(err); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            <div className="ledger-card p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-t-4 border-t-ledger-ink bg-white">
                <div>
                    <h2 className="text-lg font-black text-ledger-ink uppercase tracking-tighter">Identificación de Inmueble</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Seleccione su apartamento para proceder</p>
                </div>
                <select
                    value={selectedApto || ''}
                    onChange={(e) => setSelectedApto(e.target.value)}
                    className="w-full md:w-80 p-4 bg-ledger-audit rounded-xl outline-none font-black text-ledger-accent border border-ledger-border focus:border-ledger-accent focus:ring-1 focus:ring-ledger-accent/10 cursor-pointer shadow-inner uppercase tracking-wider text-sm"
                >
                    <option value="">-- ELIGIR UNIDAD --</option>
                    {(data.cobranzas || []).map(c => <option key={c.apto} value={c.apto}>{c.apto} - {c.propietario}</option>)}
                </select>
            </div>

            {selectedApto ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-8">
                        <div className={`ledger-card p-10 flex flex-col items-center relative overflow-hidden group border-b-4 ${totalDeuda <= 0 ? 'border-b-emerald-500 bg-emerald-50/10' : 'border-b-red-500 bg-red-50/10'}`}>
                            <div className={`p-6 rounded-3xl mb-6 shadow-inner ${totalDeuda <= 0 ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-red-100 text-red-600 border border-red-200'}`}>
                                {totalDeuda <= 0 ? <CheckCircle2 size={48} strokeWidth={2.5} /> : <AlertCircle size={48} strokeWidth={2.5} />}
                            </div>
                            <h2 className="text-5xl font-mono font-black text-ledger-ink tracking-tighter">${formatNumber(totalDeuda)}</h2>
                            <p className="text-[10px] font-black text-slate-400 tracking-[0.3em] mt-3 uppercase">ESTADO DE DEUDA ACTUAL</p>

                            <div className="absolute top-4 right-4 text-slate-200 opacity-20 transform rotate-12 group-hover:scale-110 transition-transform">
                                <FileText size={80} />
                            </div>
                        </div>

                        <div className="ledger-card p-8">
                            <h3 className="text-[10px] font-black text-slate-400 tracking-[0.2em] mb-6 uppercase">Control Proyecto Terraza</h3>
                            <div className="flex gap-6">
                                <div className={`flex-1 p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all ${terrazaData?.cuota1 ? 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-sm' : 'bg-ledger-audit border-ledger-border text-slate-300'}`}>
                                    <div className={`p-2 rounded-lg ${terrazaData?.cuota1 ? 'bg-white' : 'bg-transparent'}`}><FileText size={20} /></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest">Cuota 01</span>
                                    {terrazaData?.cuota1 && <span className="text-[8px] font-black text-emerald-500 uppercase">Procesada</span>}
                                </div>
                                <div className={`flex-1 p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all ${terrazaData?.cuota2 ? 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-sm' : 'bg-ledger-audit border-ledger-border text-slate-300'}`}>
                                    <div className={`p-2 rounded-lg ${terrazaData?.cuota2 ? 'bg-white' : 'bg-transparent'}`}><FileText size={20} /></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest">Cuota 02</span>
                                    {terrazaData?.cuota2 && <span className="text-[8px] font-black text-emerald-500 uppercase">Procesada</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ledger-card p-10 border-t-4 border-t-ledger-accent">
                        <h2 className="text-xl font-black text-ledger-ink mb-8 flex items-center gap-3 uppercase tracking-tighter">
                            <div className="p-3 bg-blue-50 text-ledger-accent rounded-xl shadow-inner"><Banknote size={24} /></div>
                            Notificar Pago
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Operación</label>
                                        {extractedFields.includes('fecha') && <span className="text-[8px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse">ESCANEADO</span>}
                                    </div>
                                    <input required type="date" value={formData.fecha} onChange={e => { setFormData({ ...formData, fecha: e.target.value }); setExtractedFields(prev => prev.filter(f => f !== 'fecha')); }} className="ledger-input bg-ledger-audit/50 border-slate-100 font-bold" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Referencia Bancaria</label>
                                        {extractedFields.includes('referencia') && <span className="text-[8px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse">ESCANEADO</span>}
                                    </div>
                                    <input required type="text" placeholder="Últimos 6 dígitos / Ref único" value={formData.referencia} onChange={e => { setFormData({ ...formData, referencia: e.target.value }); setExtractedFields(prev => prev.filter(f => f !== 'referencia')); }} className="ledger-input bg-ledger-audit/50 border-slate-100 font-mono font-bold" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-ledger-accent uppercase tracking-[0.2em] ml-1">Importe Declarado ($)</label>
                                    <div className="relative group">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg group-focus-within:text-ledger-accent">$</span>
                                        <input
                                            required
                                            type="text"
                                            placeholder="0,00"
                                            value={formData.monto_usd}
                                            onChange={e => handleUsdChange(e.target.value)}
                                            className="ledger-input pl-10 bg-blue-50/30 border-blue-100 focus:border-ledger-accent text-2xl font-mono font-black text-ledger-accent"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] ml-1">Monto en Bolívares (Bs)</label>
                                        {extractedFields.includes('monto_bs') && <span className="text-[8px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse">ESCANEADO</span>}
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        placeholder="0,00"
                                        value={formData.monto_bs}
                                        onChange={e => { handleBsChange(e.target.value); setExtractedFields(prev => prev.filter(f => f !== 'monto_bs')); }}
                                        className="ledger-input pl-12 bg-emerald-50/30 border-emerald-100 focus:border-emerald-600 text-xl font-mono font-black text-emerald-600"
                                    />
                                </div>
                            </div>

                            {formData.fecha && (
                                <div className="p-5 bg-ledger-audit rounded-2xl border border-ledger-border space-y-3 shadow-inner">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="font-black text-slate-400 uppercase tracking-widest leading-none">REFERENCIA CAMBIARIA BCV:</span>
                                        <span className="font-mono font-black text-ledger-ink bg-white px-3 py-1.5 rounded-lg border border-ledger-border shadow-sm">
                                            {loadingTasa ? (
                                                <span className="flex items-center gap-2 animate-pulse text-ledger-accent uppercase">
                                                    <Loader2 size={10} className="animate-spin" /> Verificando...
                                                </span>
                                            ) : (tasaBCV ? `${formatNumber(tasaBCV)} BS/$` : 'S/I')}
                                        </span>
                                    </div>
                                    {!tasaBCV && !loadingTasa && (
                                        <p className="text-[9px] text-amber-600 font-black uppercase tracking-tighter text-center">⚠️ Tasa no auditada automáticamente. Favor verificar manualmente.</p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-4 p-6 bg-ledger-audit/50 rounded-2xl border border-ledger-border border-dashed relative group overflow-hidden">
                                <label className="text-[10px] font-black text-ledger-ink uppercase tracking-widest flex items-center gap-2 mb-2 relative z-10">
                                    <Upload size={14} /> SOPORTE DIGITAL (CAPTURA)
                                </label>
                                <div className="relative z-10">
                                    <input required type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className={`p-6 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center gap-3 ${ocrStatus === 'VALID' ? 'border-emerald-400 bg-emerald-50/50 text-emerald-700' :
                                        ocrStatus === 'ERROR' ? 'border-red-400 bg-red-50 text-red-700' :
                                            'border-slate-300 bg-white group-hover:border-ledger-accent text-slate-400'
                                        }`}>
                                        {ocrStatus === 'SCANNING' ? (
                                            <>
                                                <Loader2 className="animate-spin text-ledger-accent" size={32} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Escaneando Registro...</span>
                                            </>
                                        ) : ocrStatus === 'VALID' ? (
                                            <>
                                                <div className="p-2 bg-emerald-100 rounded-full"><CheckCircle2 size={32} /></div>
                                                <span className="text-[10px] font-black uppercase tracking-widest">DOCUMENTO AUDITADO EXITOSAMENTE</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors"><Upload size={32} className="group-hover:text-ledger-accent transition-colors" /></div>
                                                <span className="text-[10px] font-black uppercase tracking-widest">{selectedFile ? selectedFile.name : 'ADJUNTAR COMPROBANTE'}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {ocrStatus === 'ERROR' && <p className="text-[9px] text-red-600 font-black bg-white p-3 rounded-lg border border-red-100 mt-3 text-center uppercase tracking-tighter">{ocrError}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={ocrStatus === 'SCANNING'}
                                className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-3 ${ocrStatus === 'VALID'
                                    ? (isSuccess ? 'bg-emerald-100 text-emerald-600 shadow-emerald-500/20' : 'bg-ledger-ink text-white hover:bg-black shadow-ledger-ink/30')
                                    : 'bg-ledger-audit text-slate-300 border border-ledger-border cursor-not-allowed shadow-none'
                                    }`}
                            >
                                {ocrStatus === 'SCANNING' ? 'ESPERE...' : (isSuccess ? '¡CARGA EXITOSA!' : 'PROCESAR NOTIFICACIÓN')}
                                {ocrStatus === 'VALID' && !isSuccess && <ChevronRight size={18} />}
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="ledger-card p-24 text-center flex flex-col items-center gap-6 bg-white">
                    <div className="p-8 bg-ledger-audit rounded-full border border-ledger-border shadow-inner text-slate-200">
                        <Users size={64} strokeWidth={1} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-ledger-ink uppercase tracking-tighter">Acceso de Propietario</h3>
                        <p className="font-bold text-slate-400 text-xs uppercase tracking-widest">Por favor identifique su unidad inmobiliaria</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OwnerPanel;
