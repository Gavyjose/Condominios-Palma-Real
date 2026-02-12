/**
 * Ordena un array de objetos con propiedad 'codigo' (ej. PB-A, 1-B)
 * de forma lógica: PB primero, luego pisos numéricos, y luego letras.
 */
export const sortApartamentos = (array) => {
    if (!array || !Array.isArray(array)) return [];

    return [...array].sort((a, b) => {
        const getParts = (code) => {
            if (!code) return [999, ""];
            const parts = code.toUpperCase().split('-');
            let floor = parts[0];
            let letter = parts[1] || "";

            let floorVal;
            if (floor === 'PB') {
                floorVal = 0;
            } else {
                floorVal = parseInt(floor) || 999;
            }

            return [floorVal, letter];
        };

        const [floorA, letterA] = getParts(a.codigo || a.apto); // Soporta 'codigo' o 'apto'
        const [floorB, letterB] = getParts(b.codigo || b.apto);

        if (floorA !== floorB) {
            return floorA - floorB;
        }
        return letterA.localeCompare(letterB);
    });
};
