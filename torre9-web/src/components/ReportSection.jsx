import React, { useState } from 'react';
import {
    FileText,
    Download,
    TrendingUp,
    Banknote,
    FileBarChart,
    Printer,
    ChevronRight,
    Info,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const formatNumber = (num) => {
    const val = parseFloat(num) || 0;
    return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// --- PDF GENERATION UTILITIES ---
const generatePDF = {
    header: (doc, title, config = null) => {
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        const nombreCondominio = config?.nombre_condominio || "CONDOMINIO RESIDENCIA PALMA REAL";
        const nombreTorre = config?.nombre_torre ? ` ${config.nombre_torre}` : "";
        doc.text(`${nombreCondominio}${nombreTorre}`, 105, 20, { align: "center" });
        doc.setFontSize(10);
        doc.text(`REPORTE: ${title}`, 105, 28, { align: "center" });
        doc.setFontSize(8);
        doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 105, 33, { align: "center" });
        doc.setDrawColor(226, 232, 240);
        doc.line(20, 36, 190, 36);
    },

    actaEntrega: (data, config = null) => {
        const doc = new jsPDF();
        generatePDF.header(doc, "ACTA DE ENTREGA DE FONDOS", config);
        doc.setFontSize(11);
        doc.text("Por medio de la presente se hace entrega de los fondos recaudados al cierre del mes:", 20, 50);

        const totalBs = (data.resumen?.efectivoCajaBs || 0);
        const totalUsd = (data.resumen?.totalCirculanteUSD || 0);

        const tableData = [
            ["Saldo cuotas recibidas (Condominio)", "0.00 Bs", `$${formatNumber(0)}`],
            ["Cuotas especiales recibidas", "0.00 Bs", `$${formatNumber(0)}`],
            ["Saldos de decimales (Cambio Divisas)", "0.00 Bs", `$${formatNumber(0)}`],
            [{ content: "TOTAL A ENTREGAR", styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: `${formatNumber(totalBs)} Bs`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: `$${formatNumber(totalUsd)}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]
        ];

        autoTable(doc, {
            startY: 55,
            head: [["CONCEPTOS", "BS", "DIVISAS"]],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59] },
        });

        doc.save("Acta_Entrega_Condominio.pdf");
    },

    gastosMensuales: (gastos, config = null) => {
        const doc = new jsPDF();
        generatePDF.header(doc, "RELACIÓN DE GASTOS MENSUAL", config);
        const body = [...gastos].reverse().map(g => [g.concepto, formatNumber(g.tasa_pago || g.tasa_bcv || 0), formatNumber(g.bs || g.monto_pagado_bs || 0), `$${formatNumber(g.usd || g.monto_pagado_usd || 0)}`]);
        const totalBs = gastos.reduce((sum, g) => sum + (g.bs || g.monto_pagado_bs || 0), 0);
        const totalUsd = gastos.reduce((sum, g) => sum + (g.usd || g.monto_pagado_usd || 0), 0);

        body.push([{ content: "TOTALES", styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, "",
        { content: formatNumber(totalBs), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: `$${formatNumber(totalUsd)}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);

        autoTable(doc, {
            startY: 45,
            head: [["CONCEPTO", "TASA BCV", "BOLIVARES (BS)", "PAGO ($)"]],
            body: body,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59] },
        });

        doc.save("Relacion_Gastos.pdf");
    },

    resumenCaja: (data, config = null) => {
        const doc = new jsPDF();
        generatePDF.header(doc, "RESUMEN DE CIERRE Y MOVIMIENTO DE CAJA", config);
        autoTable(doc, {
            startY: 45,
            head: [["RESUMEN DEL MES", "BS", "$ (USD)"]],
            body: [
                ["SALDO INICIAL", "0.00", `$${formatNumber(0)}`], // Fallback si no hay saldo inicial real
                ["MOVIMIENTOS DEL MES", "---", "---"],
                ["SALDO RESERVA FINAL", "0.00", `$${formatNumber(data.resumen?.fondoReserva || 0)}`],
                ["EFECTIVO EN CAJA", `${formatNumber(data.resumen?.efectivoCajaBs || 0)}`, "$0.00"],
                [{ content: "TOTAL CIRCULANTE", styles: { fontStyle: 'bold' } },
                formatNumber(data.resumen?.efectivoCajaBs || 0),
                `$${formatNumber(data.resumen?.totalCirculanteUSD || 0)}`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [71, 85, 105] },
        });
        doc.save("Resumen_Caja.pdf");
    },

    morosidadCartelera: (cobranzas, config = null) => {
        const doc = new jsPDF();
        generatePDF.header(doc, "LISTADO DE MOROSIDAD (PARA CARTELERA)", config);
        doc.setFontSize(10);
        doc.text("Se exhorta a los propietarios con saldos pendientes a ponerse al día con el condominio.", 20, 45);
        const body = (cobranzas || [])
            .filter(c => (c.deuda || 0) > 0)
            .sort((a, b) => b.deuda - a.deuda)
            .map(c => [c.apto, `$${formatNumber(c.deuda)}`, (c.deuda || 0) > 100 ? "CRÍTICO" : "PENDIENTE"]);

        autoTable(doc, {
            startY: 52,
            head: [["APARTAMENTO", "DEUDA PENDIENTE", "ESTADO"]],
            body: body,
            theme: 'striped',
            headStyles: { fillColor: [185, 28, 28] },
            columnStyles: {
                1: { fontStyle: 'bold', halign: 'right' },
                2: { halign: 'center' }
            }
        });
        doc.save("Morosidad_Cartelera.pdf");
    },

    solvencia: (apto, propietario, config = null) => {
        const doc = new jsPDF();
        generatePDF.header(doc, "CERTIFICADO DE SOLVENCIA", config);
        doc.setFontSize(12);
        doc.text(`Se hace constar que la unidad inmobiliaria:`, 20, 50);
        doc.setFont("helvetica", "bold");
        doc.text(`${apto} - ${propietario}`, 20, 60);
        doc.setFont("helvetica", "normal");
        doc.text(`Se encuentra TOTALMENTE SOLVENTE con sus obligaciones condominiales`, 20, 80);
        doc.text(`al cierre de la fecha de emisión de este documento.`, 20, 90);
        doc.line(20, 110, 190, 110);
        doc.setFontSize(10);
        doc.text(`Emitido el: ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`, 20, 120);
        doc.save(`Solvencia_${apto}.pdf`);
    }
};

const ReportCard = ({ title, description, icon, onAction }) => (
    <div className="ledger-card p-8 bg-white ledger-card-hover group border-l-4 border-l-ledger-ink shadow-sm">
        <div className="flex justify-between items-start mb-6">
            <div className="p-4 bg-ledger-audit rounded-2xl group-hover:bg-white group-hover:shadow-inner transition-all">{icon}</div>
            <button
                onClick={onAction}
                className="p-3 bg-ledger-ink text-white rounded-xl hover:bg-ledger-accent transition-all shadow-lg shadow-ledger-ink/20"
            >
                <Download size={22} />
            </button>
        </div>
        <h3 className="font-black text-ledger-ink text-lg mb-2 uppercase tracking-tighter">{title}</h3>
        <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest">{description}</p>
    </div>
);

const ReportPreviewModal = ({ type, data, config, onClose, onDownload }) => {
    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Info className="text-blue-600" /> Vista Previa de Reporte
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 font-bold">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                    <div className="bg-white p-8 shadow-sm border border-slate-200 min-h-[600px] text-slate-800 text-sm font-serif">
                        <div className="text-center mb-8 border-b border-slate-200 pb-4">
                            <h1 className="font-bold text-lg mb-1">
                                {config?.nombre_condominio || "CONDOMINIO RESIDENCIA PALMA REAL"}
                                {config?.nombre_torre ? ` ${config.nombre_torre}` : ""}
                            </h1>
                            <p className="text-xs text-slate-500 uppercase tracking-widest">
                                RIF: {config?.rif || "J-12345678-9"} | {config?.direccion || "Valencia, Carabobo"}
                            </p>
                            <h2 className="font-bold text-md mt-4 uppercase bg-slate-100 py-1 inline-block px-4 rounded-lg">
                                {type === 'acta' && 'Acta de Entrega de Fondos'}
                                {type === 'gastos' && 'Relación de Gastos Mensual'}
                                {type === 'caja' && 'Cierre de Movimiento de Efectivo'}
                                {type === 'morosidad' && 'Listado de Morosidad'}
                            </h2>
                            <p className="text-xs text-slate-400 mt-2">Emisión: {new Date().toLocaleDateString()}</p>
                        </div>

                        {type === 'acta' && <div className="space-y-4 text-center p-12 opacity-50 italic">Generando contenido del acta...</div>}
                        {type === 'gastos' && (
                            <table className="w-full border-collapse text-[10px]">
                                <thead className="bg-slate-800 text-white">
                                    <tr><th className="p-2 text-left">Concepto</th><th className="p-2 text-right">Bs</th><th className="p-2 text-right">$</th></tr>
                                </thead>
                                <tbody>
                                    {(data.gastos || []).slice(0, 10).map((g, i) => (
                                        <tr key={i} className="border-b"><td className="p-2">{g.concepto}</td><td className="p-2 text-right">{formatNumber(g.bs || g.monto_pagado_bs)}</td><td className="p-2 text-right">${formatNumber(g.usd || g.monto_pagado_usd)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {/* Otras simulaciones... */}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all">Cancelar</button>
                    <button onClick={onDownload} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2">
                        <Download size={20} /> Descargar PDF Oficial
                    </button>
                </div>
            </div>
        </div>
    );
};

const ReportSection = ({ data, config }) => {
    const [previewReport, setPreviewReport] = useState(null);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <header className="mb-8">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                    <FileBarChart className="text-blue-600" /> Centro de Reportes
                </h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Visualiza y descarga los documentos oficiales del condominio.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReportCard
                    title="Acta de Entrega de Fondos"
                    description="Formato oficial de entrega de recaudación mensual."
                    icon={<FileText className="text-purple-600" />}
                    onAction={() => setPreviewReport('acta')}
                />
                <ReportCard
                    title="Relación de Gastos Mensual"
                    description="Detalle de egresos con tasa BCV y conversión a divisas."
                    icon={<Banknote className="text-green-600" />}
                    onAction={() => setPreviewReport('gastos')}
                />
                <ReportCard
                    title="Cierre de Movimiento de Efectivo"
                    description="Resumen de saldo inicial, entradas, salidas y reserva."
                    icon={<TrendingUp className="text-blue-600" />}
                    onAction={() => setPreviewReport('caja')}
                />
                <ReportCard
                    title="Listado de Morosidad (Cartelera)"
                    description="Relación anónima por apto para incentivar la cobranza."
                    icon={<Printer className="text-red-600" />}
                    onAction={() => setPreviewReport('morosidad')}
                />
            </div>

            <div className="mt-12 p-10 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200"><CheckCircle2 /></div>
                    <div>
                        <h4 className="font-black text-blue-900 uppercase tracking-tighter">Descarga Global</h4>
                        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Genera todos los reportes del periodo actual en un solo paso.</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        generatePDF.actaEntrega(data, config);
                        generatePDF.gastosMensuales(data.gastos, config);
                        generatePDF.resumenCaja(data, config);
                        generatePDF.morosidadCartelera(data.cobranzas, config);
                    }}
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-3"
                >
                    Descargar Lote <ChevronRight size={18} />
                </button>
            </div>

            {previewReport && (
                <ReportPreviewModal
                    type={previewReport}
                    data={data}
                    config={config}
                    onClose={() => setPreviewReport(null)}
                    onDownload={() => {
                        try {
                            if (previewReport === 'acta') generatePDF.actaEntrega(data, config);
                            if (previewReport === 'gastos') generatePDF.gastosMensuales(data.gastos, config);
                            if (previewReport === 'caja') generatePDF.resumenCaja(data, config);
                            if (previewReport === 'morosidad') generatePDF.morosidadCartelera(data.cobranzas, config);
                        } catch (error) {
                            console.error("PDF Error:", error);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default ReportSection;
