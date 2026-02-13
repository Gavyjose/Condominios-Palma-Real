import React, { useState } from 'react';
import {
    FileText,
    Download,
    Loader2,
    Calendar,
    DollarSign,
    Printer,
    Table,
    X,
    Eye,
    CheckCircle2
} from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { sortApartamentos } from '../utils/sorting';

const ReportesAvanzados = ({ config, API_URL, data: externalData }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedApto, setSelectedApto] = useState('todos');

    // Estados para Vista Previa
    const [showPreview, setShowPreview] = useState(false);
    const [previewType, setPreviewType] = useState(null); // 'sabana' | 'recibos'
    const [previewData, setPreviewData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- LÓGICA DE GENERACIÓN DE PDF (REUTILIZABLE) ---

    const generateSabanaPDF = (data, action = 'save') => {
        const [anio, mes] = selectedDate.split('-');
        const doc = new jsPDF({ orientation: 'landscape' });

        doc.setFontSize(18);
        doc.text(`${config.nombre_condominio || 'CONDOMINIO'}`, 14, 15);
        doc.setFontSize(12);
        doc.text(`SÁBANA DE COBRANZAS - MES ${mes}/${anio}`, 14, 22);

        const monthNames = ["", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const mesActual = parseInt(mes);
        const anioActual = parseInt(anio);
        let mesAnterior = mesActual - 1;
        let anioAnterior = anioActual;
        if (mesAnterior === 0) { mesAnterior = 12; anioAnterior = anioActual - 1; }

        const labelMesActual = `MES ACTUAL: ${monthNames[mesActual]} ${anioActual}`;
        const labelMesAnterior = `MES ANTERIOR: ${monthNames[mesAnterior]} ${anioAnterior}`;

        const totalSaldoInicial = data.data.reduce((sum, item) => sum + item.saldo_inicial_usd, 0);
        const totalPagosBs = data.data.reduce((sum, item) => sum + item.pagos_bs, 0);
        const totalPagosUsd = data.data.reduce((sum, item) => sum + item.pagos_usd, 0);
        const totalSaldoAnt = data.data.reduce((sum, item) => sum + (item.saldo_pre_cuota_usd || 0), 0);
        const totalCuotaMes = data.data.reduce((sum, item) => sum + item.cuota_mes_usd, 0);
        const totalSaldoFinal = data.data.reduce((sum, item) => sum + item.saldo_final_usd, 0);

        autoTable(doc, {
            startY: 30,
            head: [
                [
                    { content: 'APTO', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                    { content: 'PROPIETARIO', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
                    { content: labelMesAnterior, colSpan: 4, styles: { halign: 'center', fillColor: [41, 128, 185] } },
                    { content: labelMesActual, colSpan: 2, styles: { halign: 'center', fillColor: [39, 174, 96] } }
                ],
                ['SALDO INIC ($)', 'PAGOS (Bs)', 'PAGOS ($)', 'SALDO MES ANT ($)', 'CUOTA MES ($)', 'SALDO FINAL ($)']
            ],
            body: sortApartamentos(data.data).map(row => [
                row.apto,
                row.propietario,
                row.saldo_inicial_usd.toFixed(2),
                row.pagos_bs.toLocaleString('de-DE', { minimumFractionDigits: 2 }),
                row.pagos_usd.toFixed(2),
                (row.saldo_pre_cuota_usd || 0).toFixed(2),
                row.cuota_mes_usd.toFixed(2),
                row.saldo_final_usd.toFixed(2)
            ]),
            foot: [
                [
                    { content: 'TOTALES GENERALES', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
                    totalSaldoInicial.toFixed(2),
                    totalPagosBs.toLocaleString('de-DE', { minimumFractionDigits: 2 }),
                    totalPagosUsd.toFixed(2),
                    totalSaldoAnt.toFixed(2),
                    totalCuotaMes.toFixed(2),
                    totalSaldoFinal.toFixed(2)
                ]
            ],
            theme: 'grid',
            styles: { fontSize: 8, halign: 'center' },
            headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: [241, 196, 15], textColor: 0, fontStyle: 'bold' },
            columnStyles: { 1: { halign: 'left' } },
            didParseCell: function (data) {
                if (data.section === 'head' && data.row.index === 1) {
                    if (data.column.index >= 2 && data.column.index <= 5) data.cell.styles.fillColor = [52, 152, 219];
                    if (data.column.index >= 6) data.cell.styles.fillColor = [46, 204, 113];
                }
            }
        });

        if (action === 'save') {
            doc.save(`Sabana_Cobranzas_${anio}_${mes}.pdf`);
        } else {
            doc.autoPrint();
            window.open(doc.output('bloburl'), '_blank');
        }
    };

    const generateRecibosPDF = (data, action = 'save') => {
        const [anio, mes] = selectedDate.split('-');
        const doc = new jsPDF();

        if (selectedApto === 'general') {
            generateGeneralSummaryPage(doc, data, mes, anio);
        } else if (selectedApto === 'todos') {
            generateGeneralSummaryPage(doc, data, mes, anio);
            sortApartamentos(data.recibos).forEach((recibo) => {
                doc.addPage();
                renderIndividualReceipt(doc, recibo, data, mes, anio);
            });
        } else {
            const recibo = data.recibos[0];
            if (recibo) renderIndividualReceipt(doc, recibo, data, mes, anio);
        }

        const fileName = selectedApto === 'todos' ? `Recibos_Masivos_${anio}_${mes}.pdf` :
            selectedApto === 'general' ? `Recibo_General_${anio}_${mes}.pdf` :
                `Recibo_${selectedApto}_${anio}_${mes}.pdf`;

        if (action === 'save') {
            doc.save(fileName);
        } else {
            doc.autoPrint();
            window.open(doc.output('bloburl'), '_blank');
        }
    };

    const generateGeneralSummaryPage = (doc, data, mes, anio) => {
        const monthNames = ["", "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const mesNombre = monthNames[parseInt(mes)];

        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont(undefined, 'bold');
        doc.text(`RECIBO DE CONDOMINIO - ${mesNombre} ${anio}`, 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`${config.nombre_condominio || 'CONDOMINIO'}`, 105, 30, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.text("DISTRIBUCIÓN DE EGRESOS DEL MES", 14, 55);

        const bodyGastos = (data.gastos || []).map(g => [g.concepto, `$${g.monto_usd.toFixed(2)}`]);

        autoTable(doc, {
            startY: 60,
            head: [['CONCEPTO DE GASTO', 'MONTO ($)']],
            body: bodyGastos,
            theme: 'striped',
            headStyles: { fillColor: [52, 73, 94] },
            columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
        });

        const finalY = (doc.lastAutoTable?.finalY || 60) + 15;
        doc.setFillColor(241, 196, 15);
        doc.rect(14, finalY, 182, 20, 'F');
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.setFont(undefined, 'bold');
        doc.text(`TOTAL A RECAUDAR: $${(data.total_gastos || 0).toFixed(2)}`, 20, finalY + 8);
        doc.text(`ALÍCUOTA ESTIMADA POR APTO: $${(data.alicuota_general || 0).toFixed(2)}`, 20, finalY + 15);

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text("Este reporte constituye el resumen administrativo de los egresos que componen la cuota de mantenimiento del periodo seleccionado.", 14, finalY + 30, { maxWidth: 180 });
    };

    const renderIndividualReceipt = (doc, recibo, data, mes, anio) => {
        doc.setFillColor(230, 240, 255);
        doc.rect(10, 10, 190, 18, 'F');
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.setFont(undefined, 'bold');
        doc.text(`AVISO DE COBRO: ${config.nombre_condominio || 'CONDOMINIO'}`, 105, 18, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`MES DE FACTURACIÓN: ${mes}/${anio}`, 105, 24, { align: 'center' });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`APARTAMENTO: ${recibo.codigo}`, 14, 40);
        doc.text(`PROPIETARIO: ${recibo.propietario}`, 14, 45);
        doc.text(`FECHA EMISIÓN: ${new Date().toLocaleDateString()}`, 190, 40, { align: 'right' });

        const bodyGastos = data.gastos.map(g => [g.concepto, `$${g.monto_usd.toFixed(2)}`]);
        autoTable(doc, {
            startY: 50,
            head: [['CONCEPTO DE GASTO COMÚN', 'MONTO ($)']],
            body: bodyGastos,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1 },
            headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
            columnStyles: { 1: { halign: 'right', fontStyle: 'bold', width: 30 } }
        });

        const tableY = doc.lastAutoTable.finalY + 5;
        doc.setFillColor(248, 250, 252);
        doc.rect(110, tableY, 90, 15, 'F');
        doc.setFontSize(9);
        doc.text(`TOTAL GASTOS MES:`, 115, tableY + 6);
        doc.text(`$${data.total_gastos.toFixed(2)}`, 195, tableY + 6, { align: 'right' });
        doc.setFont(undefined, 'bold');
        doc.text(`CUOTA DEL APARTAMENTO:`, 115, tableY + 12);
        doc.text(`$${data.alicuota_general.toFixed(2)}`, 195, tableY + 12, { align: 'right' });

        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text("ESTADO DE CUENTA", 14, tableY + 25);
        doc.line(14, tableY + 27, 200, tableY + 27);

        autoTable(doc, {
            startY: tableY + 30,
            body: [
                ['DEUDA ACUMULADA (MESES ANTERIORES)', `$${recibo.deuda_anterior.toFixed(2)}`],
                ['CUOTA CORRESPONDIENTE AL MES ACTUAL', `$${recibo.alicuota_mes.toFixed(2)}`],
                [{ content: 'TOTAL MONTO A PAGAR', styles: { fontStyle: 'bold', fontSize: 11, fillColor: [30, 41, 59], textColor: 255 } },
                { content: `$${recibo.total_pagar.toFixed(2)}`, styles: { fontStyle: 'bold', fontSize: 11, fillColor: [30, 41, 59], textColor: 255 } }]
            ],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: { 1: { halign: 'right' } }
        });

        const banksY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text("DATOS DE PAGO:", 14, banksY);
        doc.setFont(undefined, 'normal');
        doc.text(`${config.pago_instrucciones || config.direccion || 'CUENTAS DEL CONDOMINIO'}`, 14, banksY + 5);

        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text("Este documento es un comprobante de cobro administrativo. Favor reportar su pago a través del portal.", 105, 285, { align: 'center' });
    };

    // --- MANEJO DE VISTA PREVIA ---

    const handlePreviewSabana = async () => {
        setLoading(true);
        setError(null);
        try {
            const [anio, mes] = selectedDate.split('-');
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/reportes/sabana?anio=${anio}&mes=${mes}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Error obteniendo datos de la sábana");
            const data = await res.json();
            if (!data.data || data.data.length === 0) throw new Error("No hay datos para el mes seleccionado.");

            setPreviewData(data);
            setPreviewType('sabana');
            setShowPreview(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewRecibos = async () => {
        setLoading(true);
        setError(null);
        try {
            const [anio, mes] = selectedDate.split('-');
            const token = sessionStorage.getItem('token');
            let url = `${API_URL}/reportes/recibo?anio=${anio}&mes=${mes}`;
            if (selectedApto !== 'todos' && selectedApto !== 'general') url += `&apto=${selectedApto}`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Error obteniendo datos de recibos");
            const data = await res.json();
            if (!data.recibos || data.recibos.length === 0) throw new Error("No hay datos para generar recibos.");

            setPreviewData(data);
            setPreviewType('recibos');
            setShowPreview(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 pt-6 animate-fade-in-up">
            {/* Modal de Vista Previa */}
            {showPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-slate-200">
                        {/* Header Modal */}
                        <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                                    <Eye size={20} className="text-blue-500" />
                                    Vista Previa: {previewType === 'sabana' ? 'Sábana de Cobranzas' : 'Avisos de Cobro'}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Periodo: {selectedDate}</p>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Contenido Modal */}
                        <div className="flex-1 overflow-y-auto p-8">
                            {previewType === 'sabana' ? (
                                <div className="space-y-4">
                                    <table className="w-full text-[10px] border-collapse">
                                        <thead>
                                            <tr className="bg-slate-800 text-white font-black uppercase tracking-widest">
                                                <th className="p-3 text-left">Apto</th>
                                                <th className="p-3 text-left">Propietario</th>
                                                <th className="p-3 text-right">S. Inicial ($)</th>
                                                <th className="p-3 text-right">Pagos Bs</th>
                                                <th className="p-3 text-right">Pagos $</th>
                                                <th className="p-3 text-right">Cuota Mes $</th>
                                                <th className="p-3 text-right">Saldo Final $</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {sortApartamentos(previewData.data).map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 font-medium">
                                                    <td className="p-3 font-black">{row.apto}</td>
                                                    <td className="p-3">{row.propietario}</td>
                                                    <td className="p-3 text-right">${row.saldo_inicial_usd.toFixed(2)}</td>
                                                    <td className="p-3 text-right">{row.pagos_bs.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                                                    <td className="p-3 text-right">${row.pagos_usd.toFixed(2)}</td>
                                                    <td className="p-3 text-right">${row.cuota_mes_usd.toFixed(2)}</td>
                                                    <td className="p-3 text-right font-black text-blue-600">${row.saldo_final_usd.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Resumen General de Gastos</p>
                                            <h4 className="text-2xl font-black text-blue-900 tracking-tighter mt-1">Total Mes: ${previewData.total_gastos.toFixed(2)}</h4>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Alícuota Base</p>
                                            <p className="text-xl font-black text-blue-900 tracking-tighter mt-1">${previewData.alicuota_general.toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {sortApartamentos(previewData.recibos).slice(0, 6).map((r, i) => (
                                            <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-black text-slate-800">{r.codigo}</span>
                                                    <CheckCircle2 size={14} className="text-emerald-500 opacity-50" />
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{r.propietario}</p>
                                                <div className="mt-3 pt-3 border-t border-slate-200/50 flex justify-between items-center">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase">Total Pagar</span>
                                                    <span className="text-xs font-black text-emerald-600">${r.total_pagar.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {previewData.recibos.length > 6 && (
                                            <div className="p-4 bg-slate-100/50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">+{previewData.recibos.length - 6} recibos más</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="px-6 py-3 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (previewType === 'sabana') generateSabanaPDF(previewData, 'print');
                                    else generateRecibosPDF(previewData, 'print');
                                }}
                                className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                <Printer size={16} /> Imprimir
                            </button>
                            <button
                                onClick={() => {
                                    if (previewType === 'sabana') generateSabanaPDF(previewData, 'save');
                                    else generateRecibosPDF(previewData, 'save');
                                }}
                                className="px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-colors shadow-lg"
                            >
                                <Download size={16} /> Guardar PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Reportes Avanzados</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Generación de documentación oficial</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Periodo Fiscal</label>
                        <input
                            type="month"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-mono text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer" onClick={handlePreviewSabana}>
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform">
                        <Table size={32} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Sábana de Cobranzas</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wide leading-relaxed mb-8">
                        Reporte tabular detallado con la evolución de la deuda (Saldo Inicial, Pagos, Cuota y Saldo Final) para todos los apartamentos.
                    </p>
                    <button
                        disabled={loading}
                        onClick={(e) => { e.stopPropagation(); handlePreviewSabana(); }}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loading && previewType === 'sabana' ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />}
                        VISUALIZAR Y GUARDAR
                    </button>
                    {error && previewType === 'sabana' && <p className="text-xs text-red-500 mt-2">{error}</p>}
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
                            <FileText size={32} strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col items-end">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Seleccionar Inmueble</label>
                            <select
                                value={selectedApto}
                                onChange={(e) => setSelectedApto(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-black text-[10px] uppercase tracking-wider text-slate-600 focus:outline-none"
                            >
                                <option value="todos">Todos (Resumen + Recibos)</option>
                                <option value="general">Solo Recibo General (Resumen)</option>
                                {sortApartamentos(externalData?.cobranzas || []).map(c => (
                                    <option key={c.apto} value={c.apto}>{c.apto} - {c.propietario}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Avisos de Cobro (Recibos)</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wide leading-relaxed mb-8">
                        {selectedApto === 'todos'
                            ? "Generación masiva con reporte general administrativo y todos los recibos individuales."
                            : selectedApto === 'general'
                                ? "Descarga únicamente el reporte general de distribución de gastos del condominio."
                                : `Generación de recibo individual para la unidad ${selectedApto}.`}
                    </p>
                    <button
                        disabled={loading}
                        onClick={handlePreviewRecibos}
                        className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loading && previewType === 'recibos' ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />}
                        VISUALIZAR Y GUARDAR
                    </button>
                    {error && previewType === 'recibos' && <p className="text-xs text-red-500 mt-2">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default ReportesAvanzados;
