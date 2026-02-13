import { useState, useEffect } from 'react';
import { Trash2, Plus, Upload, Loader2, CheckCircle2, Banknote, ChevronRight, FileText } from 'lucide-react';
import ControlPagos from './ControlPagos';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const formatNumber = (num) => {
    const val = parseFloat(num) || 0;
    return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ManagementPanel = ({ data, config, onUpdate, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear }) => {
    const [activeTab, setActiveTab] = useState('gastos'); // 'gastos' | 'pagos' | 'control'


    if (!data || !data.gastos || !data.notifications) {
        return (
            <div className="p-8 text-center text-slate-400">
                <p>Cargando datos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <header className="flex bg-ledger-audit p-2 rounded-2xl items-center gap-2 border border-ledger-border shadow-inner w-fit">
                <TabButton active={activeTab === 'gastos'} onClick={() => setActiveTab('gastos')} label="Registro de Gastos" />
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <TabButton active={activeTab === 'pagos'} onClick={() => setActiveTab('pagos')} label={`Conciliación de Pagos (${data.notifications.length})`} />
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <TabButton active={activeTab === 'control'} onClick={() => setActiveTab('control')} label="Estado de Cuenta" />
            </header>

            {activeTab === 'gastos' && (
                <GastosManager
                    gastos={data.gastos}
                    onUpdate={onUpdate}
                    config={data.config || {}}
                    selectedMonth={selectedMonth}
                    setSelectedMonth={setSelectedMonth}
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
                    isLoading={data.isRefreshing}
                    numApartamentos={data?.cobranzas?.length || 16}
                />
            )}
            {activeTab === 'pagos' && <PagosManager notifications={data.notifications} onUpdate={onUpdate} />}
            {activeTab === 'control' && <ControlPagos data={data} />}
        </div>
    );
};

const TabButton = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white shadow-ledger text-ledger-accent border border-ledger-border/50' : 'text-slate-400 hover:text-slate-600'}`}
    >
        {label}
    </button>
);

const GastosManager = ({
    gastos,
    onUpdate,
    config,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    isLoading,
    numApartamentos
}) => {
    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const [newGasto, setNewGasto] = useState({ concepto: '', bs: '', usd: '', fecha: new Date().toISOString().split('T')[0] });

    const [selectedGasto, setSelectedGasto] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        monto_pagado_bs: '',
        monto_pagado_usd: '',
        fecha_pago: new Date().toISOString().split('T')[0],
        tasa_pago: '',
        referencia: '',
        comprobante: null
    });
    const [tasaBCV, setTasaBCV] = useState(null);
    const [loadingTasa, setLoadingTasa] = useState(false);
    const [loading, setLoading] = useState(false);

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

    // Buscar tasa al cambiar fecha del nuevo gasto o del pago
    useEffect(() => {
        // Al cambiar de mes o año en el selector, actualizamos la fecha por defecto del formulario
        const firstOfMonth = new Date(selectedYear, selectedMonth, 1);
        const yyyy = firstOfMonth.getFullYear();
        const mm = String(firstOfMonth.getMonth() + 1).padStart(2, '0');
        const dd = "01";
        setNewGasto(prev => ({ ...prev, fecha: `${yyyy}-${mm}-${dd}` }));
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        let active = true;

        const fetchTasa = async (fechaOrig, setter, isPayment = false) => {
            if (!fechaOrig) return;
            const fecha = getAdjustedDate(fechaOrig);
            setLoadingTasa(true);
            try {
                const resp = await fetch(`${API_URL}/tasas/${fecha}`);
                console.log(`DEBUG: Buscando tasa para ${fecha} (Original: ${fechaOrig}), Status: ${resp.status}`);

                if (!active) return;

                if (resp.ok) {
                    const data = await resp.json();
                    console.log(`DEBUG: Tasa recibida para ${fecha}:`, data.valor);
                    if (isPayment) {
                        setPaymentForm(prev => {
                            const tasa = data.valor;
                            const bs = parseNumeric(prev.monto_pagado_bs);
                            const usdNum = tasa > 0 && bs > 0 ? (bs / tasa) : 0;
                            return { ...prev, tasa_pago: formatInput(tasa, 4), monto_pagado_usd: bs > 0 ? formatInput(usdNum) : prev.monto_pagado_usd };
                        });
                    } else {
                        setter(data.valor);
                    }
                } else {
                    console.warn(`DEBUG: Tasa no encontrada para ${fecha}`);
                    if (isPayment) {
                        setPaymentForm(prev => ({ ...prev, tasa_pago: '', monto_pagado_usd: '' }));
                    } else {
                        setter(null);
                    }
                }
            } catch (err) {
                console.error("Error fetching tasa:", err);
                if (active) {
                    if (isPayment) setPaymentForm(prev => ({ ...prev, tasa_pago: '', monto_pagado_usd: '' }));
                    else setter(null);
                }
            } finally {
                if (active) setLoadingTasa(false);
            }
        };

        if (!selectedGasto) {
            fetchTasa(newGasto.fecha, setTasaBCV);
        } else {
            fetchTasa(paymentForm.fecha_pago, null, true);
        }

        return () => { active = false; };
    }, [newGasto.fecha, selectedGasto, paymentForm.fecha_pago]);

    const parseNumeric = (val) => {
        if (!val || val === '') return 0;
        let s = val.toString().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
        const num = parseFloat(s);
        return isNaN(num) ? 0 : num;
    };

    const formatInput = (val, maxDecimals = 2) => {
        if (val === undefined || val === null || val === '') return "";

        // Si es un número real, formatear directamente
        if (typeof val === 'number') {
            return val.toLocaleString('de-DE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: maxDecimals
            });
        }

        let s = val.toString();

        // Determinar si el punto es decimal o de miles
        // Si hay solo un '.' y no hay ',', y no es el último char, es decimal
        const dots = (s.match(/\./g) || []).length;
        const commas = (s.match(/,/g) || []).length;

        let temp = s;
        if (dots === 1 && commas === 0) {
            const lastChar = s.charAt(s.length - 1);
            if (lastChar !== '.') {
                temp = s.replace('.', ',');
            }
        } else {
            // Si hay múltiples puntos, son miles, los limpiamos
            temp = s.replace(/\./g, '');
        }

        // Solo permitir números y una única coma
        let filtered = temp.replace(/[^0-9,]/g, '');
        let commaParts = filtered.split(',');
        let intPart = commaParts[0] || "0";
        let decPart = commaParts.length > 1 ? commaParts.slice(1).join('').replace(/[^0-9]/g, '') : undefined;

        // Formatear parte entera con puntos de miles
        intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

        if (decPart !== undefined) {
            return `${intPart},${decPart.slice(0, maxDecimals)}`;
        }
        return intPart;
    };

    const handleUsdChange = (val) => {
        let processed = val;
        if (val.length > newGasto.usd.length) {
            const addedChar = val.charAt(val.length - 1);
            if (addedChar === '.') processed = val.slice(0, -1) + ',';
        }
        const naked = processed.replace(/\./g, '');
        const formatted = formatInput(naked);
        const numericVal = parseNumeric(formatted);
        setNewGasto({
            ...newGasto,
            usd: formatted,
            bs: tasaBCV ? formatInput((numericVal * tasaBCV).toFixed(2)) : newGasto.bs
        });
    };

    const handleBsChange = (val) => {
        let processed = val;
        if (val.length > newGasto.bs.length) {
            const addedChar = val.charAt(val.length - 1);
            if (addedChar === '.') processed = val.slice(0, -1) + ',';
        }
        const naked = processed.replace(/\./g, '');
        const formatted = formatInput(naked);
        const numericVal = parseNumeric(formatted);
        setNewGasto({
            ...newGasto,
            bs: formatted,
            usd: tasaBCV ? formatInput((numericVal / tasaBCV).toFixed(2)) : newGasto.usd
        });
    };

    // Manejador para pago en Bs
    const handlePaymentBsChange = (val) => {
        let processed = val;
        // Convertir punto final a coma para facilidad del teclado numérico
        if (val.length > paymentForm.monto_pagado_bs.length) {
            const addedChar = val.charAt(val.length - 1);
            if (addedChar === '.') processed = val.slice(0, -1) + ',';
        }

        const naked = processed.replace(/\./g, '');
        const formatted = formatInput(naked);
        const numericBs = parseNumeric(formatted);
        const tasa = parseNumeric(paymentForm.tasa_pago);
        const usdNum = tasa > 0 ? (numericBs / tasa) : 0;
        setPaymentForm({ ...paymentForm, monto_pagado_bs: formatted, monto_pagado_usd: formatInput(usdNum) });
    };

    const handlePaymentTasaChange = (val) => {
        const formatted = formatInput(val, 4); // Mayor precisión para tasa
        const numericTasa = parseNumeric(formatted);
        const bs = parseNumeric(paymentForm.monto_pagado_bs);
        const usdNum = numericTasa > 0 ? (bs / numericTasa) : 0;
        setPaymentForm({ ...paymentForm, tasa_pago: formatted, monto_pagado_usd: formatInput(usdNum) });
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setLoading(true);
        const token = sessionStorage.getItem('token');
        try {
            const body = {
                mes_anio: newGasto.fecha.substring(0, 7),
                fecha: newGasto.fecha,
                concepto: newGasto.concepto,
                monto_bs: parseNumeric(newGasto.bs),
                monto_usd: parseNumeric(newGasto.usd),
                tasa_bcv: tasaBCV,
                condominio_id: config?.id
            };
            console.log("DEBUG: Enviando gasto:", body);

            const resp = await fetch(`${API_URL}/gastos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });

            if (resp.ok) {
                setNewGasto({ concepto: '', bs: '', usd: '', fecha: new Date().toISOString().split('T')[0] });
                await onUpdate();
                console.log("DEBUG: Gasto agregado exitosamente");
            } else {
                if (resp.status === 401 || resp.status === 403) {
                    alert("⚠️ Sesión Expirada: Por favor cierra sesión y vuelve a ingresar.");
                    return;
                }
                const errorText = await resp.text();
                let errorMessage = "No se pudo agregar el gasto";
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = errorText || errorMessage;
                }
                console.error("Error al agregar gasto:", errorMessage);
                alert(`Error: ${errorMessage}`);
            }
        } catch (err) {
            console.error("Excepción en handleAdd:", err);
            alert("Error de red: Verifica tu conexión o intenta reiniciar sesión.");
        } finally {
            setLoading(false);
        }
    };

    const handleReportPayment = async (e) => {
        e.preventDefault();
        if (!selectedGasto) return;
        setLoading(true);
        const token = sessionStorage.getItem('token');

        const formData = new FormData();
        formData.append('monto_pagado_bs', parseNumeric(paymentForm.monto_pagado_bs));
        formData.append('monto_pagado_usd', parseNumeric(paymentForm.monto_pagado_usd));
        formData.append('fecha_pago', paymentForm.fecha_pago);
        formData.append('tasa_pago', parseNumeric(paymentForm.tasa_pago));
        formData.append('referencia', paymentForm.referencia.toUpperCase());
        if (paymentForm.comprobante) {
            formData.append('comprobante', paymentForm.comprobante);
        }

        try {
            const resp = await fetch(`${API_URL}/gastos/${selectedGasto.id}/pago`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (resp.ok) {
                setSelectedGasto(null);
                setPaymentForm({ monto_pagado_bs: '', monto_pagado_usd: '', fecha_pago: new Date().toISOString().split('T')[0], tasa_pago: '', referencia: '', comprobante: null });
                onUpdate();
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que deseas eliminar este gasto?')) return;
        const token = sessionStorage.getItem('token');
        try {
            const resp = await fetch(`${API_URL}/gastos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) onUpdate();
        } catch (err) { console.error(err); }
    };

    // Cálculos para la tabla
    const getCalculatedValues = (g) => {
        const bcvUsd = g.usd || 0;
        const pagoUsd = g.monto_pagado_usd || 0;
        const diferencia = bcvUsd - pagoUsd;
        return { diferencia };
    };

    return (
        <div className="ledger-card overflow-hidden">
            <div className="p-8 border-b border-ledger-border flex justify-between items-center bg-white">
                <div>
                    <h3 className="text-xl font-black text-ledger-ink uppercase tracking-tighter">Libro de Gastos</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periodo:</p>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="bg-transparent text-[10px] font-black text-ledger-accent uppercase tracking-widest outline-none cursor-pointer hover:bg-ledger-audit px-2 py-0.5 rounded"
                        >
                            {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="bg-transparent text-[10px] font-black text-ledger-accent uppercase tracking-widest outline-none cursor-pointer hover:bg-ledger-audit px-2 py-0.5 rounded"
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
                {!selectedGasto && tasaBCV && (
                    <div className="flex items-center gap-3 bg-ledger-audit text-slate-500 border border-ledger-border px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-inner">
                        <Banknote size={14} className="text-ledger-accent" /> <span className="text-slate-400">TASA BCV:</span> <span className="font-mono text-ledger-ink">{formatNumber(tasaBCV)} BS</span>
                    </div>
                )}
                {selectedGasto && (
                    <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-inner">
                            <Banknote size={14} className="text-emerald-600" />
                            <span className="text-emerald-600/70">TASA DE PAGO:</span>
                            <input
                                type="text"
                                value={paymentForm.tasa_pago}
                                onChange={e => handlePaymentTasaChange(e.target.value)}
                                className="bg-transparent border-none p-0 w-16 font-mono font-black text-emerald-700 focus:ring-0 text-right placeholder:text-emerald-300"
                                placeholder="0,00"
                            />
                            <span className="ml-0.5">BS</span>
                        </div>
                        <button onClick={() => setSelectedGasto(null)} title="Cancelar Reporte" className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-50 text-red-500 border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Formulario Dinámico: Registro o Reporte de Pago */}
            <div className="transition-all duration-500">
                {!selectedGasto ? (
                    <form onSubmit={handleAdd} className="p-8 space-y-6 bg-ledger-audit/30 border-b border-ledger-border animate-in slide-in-from-top-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Contable</label>
                                <input required type="date" value={newGasto.fecha} onChange={e => setNewGasto({ ...newGasto, fecha: e.target.value })} className="ledger-input bg-white font-bold" />
                            </div>
                            <div className="md:col-span-3 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción / Concepto</label>
                                <input required list="conceptos-fijos" placeholder="EJ: VIGILANCIA ..." value={newGasto.concepto} onChange={e => setNewGasto({ ...newGasto, concepto: e.target.value })} className="ledger-input bg-white font-black uppercase focus:tracking-wider transition-all" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Equivalente en Bolívares (Bs)</label>
                                <input readOnly type="text" value={newGasto.bs} className="ledger-input bg-slate-50 font-mono font-black text-emerald-600 text-lg border-dashed" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-ledger-accent uppercase tracking-widest ml-1">Presupuesto Estimado ($)</label>
                                <input required type="text" placeholder="0,00" value={newGasto.usd} onChange={e => handleUsdChange(e.target.value)} className="ledger-input bg-white font-mono font-black text-ledger-accent text-lg" />
                            </div>
                            <div className="flex items-end">
                                <button disabled={loading} type="submit" className="ledger-button-primary w-full flex items-center justify-center gap-3 uppercase tracking-[0.15em] text-[10px] shadow-lg shadow-ledger-ink/20">
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> Agregar Concepto</>}
                                </button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleReportPayment} className="p-8 space-y-6 bg-emerald-50/50 border-b border-emerald-100 animate-in slide-in-from-top-4">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-200"><Banknote size={24} /></div>
                            <div>
                                <h4 className="text-sm font-black text-emerald-900 uppercase tracking-tighter">Reportar Pago de Gasto</h4>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{selectedGasto.concepto} • PREVISIÓN: ${formatNumber(selectedGasto.usd)}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <div className="lg:col-span-1 space-y-2">
                                <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest ml-1">Día del Pago</label>
                                <input required type="date" value={paymentForm.fecha_pago} onChange={e => setPaymentForm({ ...paymentForm, fecha_pago: e.target.value })} className="ledger-input bg-white font-bold" />
                            </div>
                            <div className="lg:col-span-1 space-y-2">
                                <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest ml-1">Monto Pagado (Bs)</label>
                                <input required type="text" placeholder="0,00" value={paymentForm.monto_pagado_bs} onChange={e => handlePaymentBsChange(e.target.value)} className="ledger-input bg-white font-mono font-black text-emerald-600" />
                            </div>
                            <div className="lg:col-span-1 space-y-2">
                                <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest ml-1">Pagado ($)</label>
                                <input readOnly type="text" value={paymentForm.monto_pagado_usd} className="ledger-input bg-slate-100/50 font-mono font-black text-emerald-700 border-dashed" />
                            </div>
                            <div className="lg:col-span-1 space-y-2">
                                <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest ml-1">Referencia</label>
                                <input required type="text" placeholder="REF #" value={paymentForm.referencia} onChange={e => setPaymentForm({ ...paymentForm, referencia: e.target.value })} className="ledger-input bg-white font-black uppercase text-center" />
                            </div>
                            <div className="lg:col-span-1 space-y-2">
                                <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest ml-1">Comprobante</label>
                                <div className="relative group/file">
                                    <input type="file" onChange={e => setPaymentForm({ ...paymentForm, comprobante: e.target.files[0] })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className={`ledger-input flex items-center justify-center gap-2 ${paymentForm.comprobante ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white text-slate-400'}`}>
                                        <Upload size={14} /> <span className="truncate max-w-[80px] text-[9px] font-black">{paymentForm.comprobante ? paymentForm.comprobante.name : 'SUBIR'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-1 flex items-end">
                                <button disabled={loading} type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white w-full h-[52px] rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-600/10">
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> Guardar</>}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>

            {/* Tabla de Gastos Rediseñada con Cabeceras Fijas y Totales */}
            <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-ledger-border/40 rounded-2xl shadow-sm bg-white">
                {/* Filtrar gastos por el periodo seleccionado como medida de seguridad extra */}
                {(() => {
                    const mesAnioStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
                    const filteredGastos = gastos.filter(g => g.mes_anio === mesAnioStr);

                    return (
                        <table className="w-full text-left border-collapse relative">
                            <thead className="sticky top-0 z-20 shadow-sm">
                                <tr className="bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-ledger-border">
                                    <th className="p-4 border-r border-ledger-border/50 bg-slate-100">Concepto</th>
                                    <th className="p-4 text-center border-r border-ledger-border/50 bg-blue-50 text-blue-800">Estimado ($)</th>
                                    <th className="p-4 text-center border-r border-ledger-border/50 bg-emerald-50 text-emerald-800">Pagado (Bs)</th>
                                    <th className="p-4 text-center border-r border-ledger-border/50 bg-emerald-50 text-emerald-800">Equiv ($)</th>
                                    <th className="p-4 text-center border-r border-ledger-border/50 bg-slate-100">Diferencia</th>
                                    <th className="p-4 text-center border-r border-ledger-border/50 bg-slate-100">Info Pago</th>
                                    <th className="p-4 text-center bg-slate-100">Gestión</th>
                                </tr>
                            </thead>
                            <tbody className="text-[10px]">
                                {[...filteredGastos].reverse().map((g, i) => {
                                    const { diferencia } = getCalculatedValues(g);
                                    const isSelected = selectedGasto?.id === g.id;
                                    const hasComprobante = g.comprobante_url;
                                    return (
                                        <tr key={i} onClick={() => setSelectedGasto(g)} className={`group cursor-pointer border-b border-ledger-border/30 transition-all ${isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50/80'}`}>
                                            <td className="p-4">
                                                <div className="font-black text-ledger-ink uppercase tracking-tight">{g.concepto}</div>
                                                <div className="text-[8px] text-slate-400 font-bold">{g.fecha}</div>
                                            </td>
                                            <td className="p-4 text-center font-mono font-bold text-blue-600 bg-blue-50/30">${formatNumber(g.usd)}</td>
                                            <td className="p-4 text-center font-mono font-bold text-emerald-600 bg-emerald-50/30">{g.monto_pagado_bs > 0 ? formatNumber(g.monto_pagado_bs) : '---'}</td>
                                            <td className="p-4 text-center font-mono font-black text-emerald-700 bg-emerald-50/30">{g.monto_pagado_usd > 0 ? `$${formatNumber(g.monto_pagado_usd)}` : '---'}</td>
                                            <td className={`p-4 text-center font-mono font-bold ${diferencia > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                                {diferencia !== 0 ? `$${formatNumber(diferencia)}` : '0,00'}
                                            </td>
                                            <td className="p-4 text-center text-slate-400">
                                                {g.fecha_pago ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-bold text-slate-500 uppercase text-[8px]">REF: {g.referencia || 'S/N'}</span>
                                                            {g.status_banco === 'VERIFICADO' && <CheckCircle2 size={10} className="text-emerald-500" title="Verificado en Banco" />}
                                                        </div>
                                                        <span className="text-[8px]">{g.fecha_pago}</span>
                                                    </div>
                                                ) : '---'}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {hasComprobante && (
                                                        <a
                                                            href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${g.comprobante_url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-emerald-500 hover:scale-110 transition-transform p-2"
                                                            title="Ver Comprobante"
                                                        >
                                                            <FileText size={16} />
                                                        </a>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }} className="text-slate-200 hover:text-red-500 p-2 rounded-lg transition-all"><Trash2 size={14} /></button>
                                                    <ChevronRight size={14} className={`text-slate-200 transition-transform ${isSelected ? 'rotate-90 text-emerald-500' : 'group-hover:translate-x-1'}`} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredGastos.length === 0 ? (
                                    <tr><td colSpan="7" className="p-12 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">Sin registros en este periodo.</td></tr>
                                ) : (
                                    <>
                                        <tr className="bg-ledger-audit border-t-2 border-ledger-border">
                                            <td className="p-4 font-black text-ledger-ink uppercase tracking-widest text-[10px]">TOTAL ACUMULADO</td>
                                            <td className="p-4 text-center font-mono font-black text-ledger-ink border-l border-ledger-border/50 text-base bg-blue-50/50">${formatNumber(filteredGastos.reduce((acc, g) => acc + (parseFloat(g.usd) || 0), 0))}</td>
                                            <td className="p-4 text-center font-mono font-black text-emerald-600 border-l border-ledger-border/50 text-base">{formatNumber(filteredGastos.reduce((acc, g) => acc + (parseFloat(g.monto_pagado_bs) || 0), 0))} Bs</td>
                                            <td className="p-4 text-center font-mono font-black text-emerald-700 border-l border-ledger-border/50 text-base bg-emerald-50/50">${formatNumber(filteredGastos.reduce((acc, g) => acc + (parseFloat(g.monto_pagado_usd) || 0), 0))}</td>
                                            <td className="p-4 text-center font-mono font-black text-amber-600 border-l border-ledger-border/50 text-base bg-amber-50/20">${formatNumber(filteredGastos.reduce((acc, g) => acc + ((parseFloat(g.usd) || 0) - (parseFloat(g.monto_pagado_usd) || 0)), 0))}</td>
                                            <td colSpan="2" className="p-4 text-center text-[9px] text-slate-500 font-black bg-slate-100/50 border-l border-ledger-border/50 uppercase tracking-tighter">
                                                {(() => {
                                                    const totalPaidBs = filteredGastos.reduce((acc, g) => acc + (parseFloat(g.monto_pagado_bs) || 0), 0);
                                                    const totalPaidUsd = filteredGastos.reduce((acc, g) => acc + (parseFloat(g.monto_pagado_usd) || 0), 0);
                                                    const weightedAvg = totalPaidUsd > 0 ? totalPaidBs / totalPaidUsd : 0;
                                                    return `PROMEDIO TASA (PONDERADA): ${formatNumber(weightedAvg)}`;
                                                })()}
                                            </td>
                                        </tr>
                                        <tr className="bg-yellow-50 border-t border-ledger-border">
                                            <td colSpan="4" className="p-4 font-black text-ledger-accent uppercase tracking-widest text-[11px] text-right">
                                                ALÍCUOTA DEL MES (Total Estimado / {numApartamentos} Aptos)
                                            </td>
                                            <td className="p-4 text-center font-mono font-black text-ledger-accent border-l border-ledger-border/50 text-lg bg-yellow-100">
                                                ${formatNumber((filteredGastos.reduce((acc, g) => acc + (parseFloat(g.usd) || 0), 0)) / numApartamentos)}
                                            </td>
                                            <td colSpan="2" className="p-4 text-center text-[8px] text-slate-400 font-black uppercase tracking-wider border-l border-ledger-border/50">
                                                Valor por apartamento
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    );
                })()}
            </div>

            <datalist id="conceptos-fijos">
                <option value="VIGILANCIA" />
                <option value="AGUA" />
                <option value="PISCINA" />
                <option value="OPERADOR DE BOMBA PH" />
                <option value="ASEO SR. TELLO" />
                <option value="ADMINISTRACIÓN" />
                <option value="LIMPIEZA TORRE 9 DÍAS A 6" />
                <option value="PRODUCTOS LIMPIEZA" />
                <option value="JARDINERÍA (SR. NELSON)" />
                <option value="COMISIÓN PAGO MÓVIL" />
                <option value="ELECENTRO TORRE N 1000037324845" />
                <option value="FONDO DE RESERVA" />
                <option value="RIEGO" />
                <option value="MANTENIMIENTO DE TERRENO SR FELIX" />
                <option value="CORPOELECT (ÁREA COMÚN) ÁREAS VERDES" />
            </datalist>
        </div>
    );
};

const PagosManager = ({ notifications, onUpdate }) => {
    const [uploading, setUploading] = useState(false);
    const [comisionesDetectadas, setComisionesDetectadas] = useState(null);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setComisionesDetectadas(null);
        const token = sessionStorage.getItem('token');
        const formData = new FormData();
        formData.append('archivo', file);

        try {
            const resp = await fetch(`${API_URL}/admin/upload-banco`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const res = await resp.json();
            if (resp.ok) {
                alert(res.message);
                if (res.totalComisiones > 0) {
                    setComisionesDetectadas(res.totalComisiones);
                }
                onUpdate();
            } else {
                alert(res.error || 'Error al subir archivo');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión');
        } finally {
            setUploading(false);
            e.target.value = ''; // Limpiar input
        }
    };

    const handleAprobar = async (id) => {
        const token = sessionStorage.getItem('token');
        try {
            const resp = await fetch(`${API_URL}/pagos/${id}/aprobar`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) onUpdate();
        } catch (err) { console.error(err); }
    };

    return (
        <div className="space-y-8">
            <div className="ledger-card p-10 flex flex-col md:flex-row justify-between items-center gap-8 border-l-4 border-l-ledger-accent bg-white">
                <div className="space-y-2">
                    <h3 className="text-xl font-black text-ledger-ink uppercase tracking-tighter">Conciliación Bancaria Automatizada</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Carga de extractos oficiales para verificación de registros</p>
                </div>
                <div className="relative group">
                    <input
                        type="file"
                        accept=".xlsx, .csv, .pdf"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={uploading}
                    />
                    <button className={`px-10 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-2xl ${uploading ? 'bg-ledger-audit text-slate-300' : 'bg-ledger-ink text-white hover:bg-black shadow-ledger-ink/20 group-hover:scale-105'}`}>
                        {uploading ? <Loader2 className="animate-spin" size={18} /> : <><Upload size={20} /> Importar Datos Banco</>}
                    </button>
                </div>
            </div>

            {comisionesDetectadas !== null && (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-center justify-between animate-in zoom-in duration-300">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                            <Banknote size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Gasto Administrativo Detectado</p>
                            <h4 className="text-xl font-black text-amber-900 tracking-tighter">Total Comisiones Bancarias: Bs. {formatNumber(comisionesDetectadas)}</h4>
                        </div>
                    </div>
                    <button onClick={() => setComisionesDetectadas(null)} className="text-amber-400 hover:text-amber-600 p-2">
                        <ChevronRight className="rotate-90 md:rotate-0" />
                    </button>
                </div>
            )}

            <div className="ledger-card overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="ledger-table-header">
                            <th className="p-4 border-r border-ledger-border/50">Unidad</th>
                            <th className="p-4 border-r border-ledger-border/50">Fecha Operación</th>
                            <th className="p-4 border-r border-ledger-border/50">Ref. Transacción</th>
                            <th className="p-4 text-right border-r border-ledger-border/50">Importe USD</th>
                            <th className="p-4 text-right border-r border-ledger-border/50">Importe Bs</th>
                            <th className="p-4 text-center border-r border-ledger-border/50">Status Auditoría</th>
                            <th className="p-4 text-center border-r border-ledger-border/50">Validación OCR</th>
                            <th className="p-4 text-center">Gestión</th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px]">
                        {notifications.map((n, i) => (
                            <tr key={i} className="ledger-row group">
                                <td className="p-4 font-black text-ledger-accent border-r border-ledger-border/10 tracking-widest">{n.apto}</td>
                                <td className="p-4 text-slate-400 font-mono tracking-tighter border-r border-ledger-border/10">{n.fecha_pago}</td>
                                <td className="p-4 font-mono font-bold text-slate-600 border-r border-ledger-border/10 tracking-widest">{n.referencia}</td>
                                <td className="p-4 text-right font-mono font-black text-ledger-ink border-l border-ledger-border/10">${formatNumber(n.monto || 0)}</td>
                                <td className="p-4 text-right font-mono font-black text-ledger-ink border-l border-ledger-border/10">Bs {formatNumber(n.monto_bs || 0)}</td>
                                <td className="p-4 text-center border-l border-ledger-border/10">
                                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${n.status_banco === 'VERIFICADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' :
                                        n.status_banco === 'ERROR_MONTO' ? 'bg-red-50 text-red-600 border-red-100 shadow-sm' :
                                            'bg-ledger-audit text-slate-400 border-ledger-border'
                                        }`}>
                                        {n.status_banco || 'PENDIENTE'}
                                    </span>
                                </td>
                                <td className="p-4 text-center border-l border-ledger-border/10">
                                    <span className={`text-[10px] font-black tracking-widest flex items-center justify-center gap-1 ${n.validacion_ocr === 'VALIDADO' ? 'text-emerald-500 bg-emerald-50/50 p-2 rounded-lg' : 'text-slate-200'}`}>
                                        {n.validacion_ocr === 'VALIDADO' ? <><CheckCircle2 size={12} /> OK</> : '--'}
                                    </span>
                                </td>
                                <td className="p-4 text-center border-l border-ledger-border/10">
                                    <button onClick={() => handleAprobar(n.id)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10 active:scale-95">
                                        Aplicar
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {notifications.length === 0 && <tr><td colSpan="7" className="p-16 text-center text-slate-300 font-black uppercase tracking-[0.25em] text-xs">Sin movimientos pendientes por conciliar.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ManagementPanel;
