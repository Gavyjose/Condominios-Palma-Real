import React, { useState } from 'react';
import { FileText, Download, Loader2, Calendar, DollarSign, Printer, Table } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { sortApartamentos } from '../utils/sorting';

const ReportesAvanzados = ({ config, API_URL, data: externalData }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedApto, setSelectedApto] = useState('todos');
    const [loadingSabana, setLoadingSabana] = useState(false);
    const [errorSabana, setErrorSabana] = useState(null);
    const [loadingRecibos, setLoadingRecibos] = useState(false);
    const [errorRecibos, setErrorRecibos] = useState(null);

    const handleGenerateSabana = async () => {
        setLoadingSabana(true);
        setErrorSabana(null);
        try {
            const [anio, mes] = selectedDate.split('-');
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/reportes/sabana?anio=${anio}&mes=${mes}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Error obteniendo datos del servidor");
            const data = await res.json();

            if (!data.data || data.data.length === 0) {
                alert("No hay datos para el mes seleccionado.");
                setLoading(false);
                return;
            }

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

            doc.save(`Sabana_Cobranzas_${anio}_${mes}.pdf`);
        } catch (err) {
            console.error(err);
            setErrorSabana(err.message);
        } finally {
            setLoadingSabana(false);
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

        const bodyGastos = data.gastos.map(g => [g.concepto, `$${g.monto_usd.toFixed(2)}`]);

        autoTable(doc, {
            startY: 60,
            head: [['CONCEPTO DE GASTO', 'MONTO ($)']],
            body: bodyGastos,
            theme: 'striped',
            headStyles: { fillColor: [52, 73, 94] },
            columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
        });

        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFillColor(241, 196, 15);
        doc.rect(14, finalY, 182, 20, 'F');
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.setFont(undefined, 'bold');
        doc.text(`TOTAL A RECAUDAR: $${data.total_gastos.toFixed(2)}`, 20, finalY + 8);
        doc.text(`ALÍCUOTA ESTIMADA POR APTO: $${data.alicuota_general.toFixed(2)}`, 20, finalY + 15);

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

    const handleGenerateRecibos = async () => {
        setLoadingRecibos(true);
        setErrorRecibos(null);
        try {
            const [anio, mes] = selectedDate.split('-');
            const token = sessionStorage.getItem('token');
            let url = `${API_URL}/reportes/recibo?anio=${anio}&mes=${mes}`;
            if (selectedApto !== 'todos' && selectedApto !== 'general') url += `&apto=${selectedApto}`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Error obteniendo datos del servidor");
            const data = await res.json();

            if (!data.recibos || data.recibos.length === 0) {
                alert("No hay datos para generar recibos.");
                setLoadingRecibos(false);
                return;
            }

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
            doc.save(fileName);
        } catch (err) {
            console.error(err);
            setErrorRecibos(err.message);
        } finally {
            setLoadingRecibos(false);
        }
    };

    return (
        <div className="space-y-6 pt-6 animate-fade-in-up">
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
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer" onClick={handleGenerateSabana}>
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform">
                        <Table size={32} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Sábana de Cobranzas</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wide leading-relaxed mb-8">
                        Reporte tabular detallado con la evolución de la deuda (Saldo Inicial, Pagos, Cuota y Saldo Final) para todos los apartamentos.
                    </p>
                    <button
                        disabled={loadingSabana}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loadingSabana ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                        DESCARGAR REPORTE (PDF)
                    </button>
                    {errorSabana && <p className="text-xs text-red-500 mt-2">{errorSabana}</p>}
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
                        disabled={loadingRecibos}
                        onClick={handleGenerateRecibos}
                        className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loadingRecibos ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />}
                        {selectedApto === 'todos' ? 'IMPRIMIR TODOS (PDF)' :
                            selectedApto === 'general' ? 'IMPRIMIR GENERAL (PDF)' :
                                'IMPRIMIR RECIBO (PDF)'}
                    </button>
                    {errorRecibos && <p className="text-xs text-red-500 mt-2">{errorRecibos}</p>}
                </div>
            </div>
        </div>
    );
};

export default ReportesAvanzados;
