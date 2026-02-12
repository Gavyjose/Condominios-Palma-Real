export const mockData = {
    resumen: {
        fondoReserva: 44.18,
        cuentasPorCobrar: 752.50,
        efectivoCajaBs: 86908.33,
        totalCirculanteUSD: 953.68, // Estimado
    },
    gastos: [
        { concepto: "Vigilancia", bs: 19523.36, usd: 60.00 },
        { concepto: "Agua", bs: 12483.66, usd: 38.37 },
        { concepto: "Piscina", bs: 4561.96, usd: 14.02 },
        { concepto: "Operador de Bomba PH", bs: 1952.34, usd: 6.00 },
        { concepto: "Aseo Sr. Tello", bs: 3253.89, usd: 10.00 },
        { concepto: "Administración", bs: 18365.35, usd: 50.00 },
        { concepto: "Limpieza Torre 9", bs: 19834.57, usd: 54.00 },
        { concepto: "Productos Limpieza", bs: 2441.00, usd: 7.50 },
        { concepto: "Jardinería", bs: 7229.82, usd: 20.00 },
        { concepto: "Riego", bs: 4407.68, usd: 12.00 },
    ],
    cobranzas: [
        { apto: "PB-A", propietario: "FABIANA FREITE", deuda: 42.36, solvente: false },
        { apto: "PB-B", propietario: "AYMARA", deuda: 21.73, solvente: false },
        { apto: "PB-C", propietario: "ROSALINDA MO", deuda: 0, solvente: true },
        { apto: "PB-D", propietario: "SR. CHUY", deuda: 292.42, solvente: false },
        { apto: "1-A", propietario: "ROSMER MADRI", deuda: 0, solvente: true },
        { apto: "1-B", propietario: "EMELYM CRUZ", deuda: 0, solvente: true },
        { apto: "1-C", propietario: "ALEJANDRO PES", deuda: 42.36, solvente: false },
        { apto: "1-D", propietario: "ALFONSO CECCA", deuda: 0, solvente: true },
        { apto: "2-A", propietario: "LUIS NIEVES", deuda: 42.72, solvente: false },
        { apto: "2-B", propietario: "DANIELA BLANC", deuda: 0, solvente: true },
        { apto: "2-C", propietario: "DALY", deuda: 0, solvente: true },
        { apto: "2-D", propietario: "PEDRO PEÑALOZA", deuda: 0, solvente: true },
        { apto: "3-A", propietario: "ELIMAR", deuda: 40.37, solvente: false },
        { apto: "3-B", propietario: "EDWIN RANGEL", deuda: 43.33, solvente: false },
        { apto: "3-C", propietario: "ESTEBAN CABAL", deuda: 0, solvente: true },
        { apto: "3-D", propietario: "NEILA MEJIAS", deuda: 0, solvente: true },
    ],
    terraza: [
        { apto: "PB-A", cuota1: true, cuota2: false },
        { apto: "PB-B", cuota1: true, cuota2: true },
        { apto: "PB-C", cuota1: false, cuota2: false },
        { apto: "PB-D", cuota1: false, cuota2: false },
    ]
};
