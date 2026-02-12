const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const phoneNumber = process.env.TELEGRAM_PHONE;

// Archivo para guardar la sesión
const SESSION_FILE = path.join(__dirname, '.telegram_session');
let sessionString = '';

if (fs.existsSync(SESSION_FILE)) {
    sessionString = fs.readFileSync(SESSION_FILE, 'utf-8');
}

const session = new StringSession(sessionString);
const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
});

async function connectTelegram() {
    if (!client.connected) {
        await client.start({
            phoneNumber: async () => phoneNumber,
            password: async () => "", // No 2FA por ahora
            phoneCode: async () => {
                throw new Error("Se requiere código SMS. Por favor, corre el script manualmente una vez.");
            },
            onError: (err) => console.error('Error de Telegram:', err),
        });

        const sessionStr = client.session.save();
        fs.writeFileSync(SESSION_FILE, sessionStr);
    }
}

async function extractTextFromImage(imagePath) {
    try {
        const { data: { text } } = await Tesseract.recognize(imagePath, 'spa');
        return text;
    } catch (error) {
        console.error('Error en OCR:', error);
        return null;
    }
}

function parseTextBCV(text) {
    try {
        // Regex más flexible para el valor Usd
        const valorMatch = text.match(/USD\s+([\d,.]+)/i) || text.match(/Bs\s*\/\s*USD\s+([\d,.]+)/i);
        let valor = null;
        if (valorMatch && valorMatch[1]) {
            valor = parseFloat(valorMatch[1].replace(',', '.'));
        }

        // Regex más flexible para la fecha: busca un número de 2 dígitos (día), luego 'de', luego texto (mes), luego 4 dígitos (año)
        const fechaMatch = text.match(/(\d{2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s+(\d{4})/i);
        let fecha = null;
        if (fechaMatch) {
            const dia = fechaMatch[1];
            const mesTexto = fechaMatch[2].toLowerCase();
            const anio = fechaMatch[3];

            const meses = {
                'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
                'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
                'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
            };

            const mesKey = Object.keys(meses).find(k => mesTexto.startsWith(k));
            const mes = mesKey ? meses[mesKey] : null;

            if (mes) {
                fecha = `${anio}-${mes}-${dia}`;
            }
        }

        if (!fecha || !valor) {
            console.log(`[BCV Debug] Fallo al parsear: fecha=${fecha}, valor=${valor}. Texto crudo: ${text.substring(0, 100).replace(/\n/g, ' ')}...`);
        }

        return { fecha, valor };
    } catch (error) {
        return { fecha: null, valor: null };
    }
}

async function downloadImage(message, index) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const imagePath = path.join(tempDir, `bcv_${index}_${Date.now()}.jpg`);
    const buffer = await client.downloadMedia(message, { workers: 1 });

    if (buffer) {
        fs.writeFileSync(imagePath, buffer);
        return imagePath;
    }
    return null;
}

async function readBCVFromTelegram(limit = 1) {
    await connectTelegram();
    const channelUsername = 'DolarOficialBCV';
    const results = [];

    try {
        const messages = await client.getMessages(channelUsername, { limit: limit * 2 });
        let processed = 0;
        for (const message of messages) {
            if (processed >= limit) break;
            if (message.photo) {
                const imagePath = await downloadImage(message, processed);
                if (!imagePath) continue;

                const text = await extractTextFromImage(imagePath);
                const { fecha, valor } = parseTextBCV(text);

                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

                if (fecha && valor) {
                    results.push({ fecha, valor });
                    processed++;
                }
            }
        }
        return results;
    } catch (error) {
        console.error('Error leyendo canal de Telegram:', error);
        throw error;
    }
}

module.exports = { readBCVFromTelegram };
