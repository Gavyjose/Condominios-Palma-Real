const https = require('http');

const data = JSON.stringify({
    username: 'admin',
    password: 'admin123'
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('[INFO] Probando endpoint de login...\n');
console.log('URL:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('Datos:', data);
console.log('');

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
    console.log('');

    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        console.log('Respuesta:');
        try {
            const parsed = JSON.parse(responseData);
            console.log(JSON.stringify(parsed, null, 2));

            if (parsed.token) {
                console.log('\n✓ LOGIN EXITOSO - Token recibido');
            } else if (parsed.error) {
                console.log(`\n✗ LOGIN FALLIDO - Error: ${parsed.error}`);
            }
        } catch (e) {
            console.log(responseData);
        }
    });
});

req.on('error', (error) => {
    console.error('✗ Error de conexión:', error.message);
});

req.write(data);
req.end();
