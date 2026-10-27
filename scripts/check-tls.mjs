// Checks that Node trusts a PostgreSQL server's certificate, without logging in.
//   node scripts/check-tls.mjs <host> [port]
// Sends PostgreSQL's SSLRequest, upgrades to TLS and verifies the chain against
// Node's built-in CA list, which is what the app does by default.
import net from 'node:net';
import tls from 'node:tls';

const [host, port = '5432'] = process.argv.slice(2);
if (!host) {
    console.error('usage: node scripts/check-tls.mjs <host> [port]');
    process.exit(2);
}

const socket = net.connect({ host, port: Number(port), timeout: 8000 });
socket.once('error', (e) => { console.error(`connect failed: ${e.code || e.message}`); process.exit(1); });
socket.once('timeout', () => { console.error('timed out'); process.exit(1); });
socket.once('connect', () => {
    socket.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47])); // SSLRequest
    socket.once('data', (reply) => {
        if (reply[0] !== 0x53) { console.error('server does not offer SSL'); process.exit(1); }
        const secure = tls.connect({ socket, servername: host, rejectUnauthorized: true }, () => {
            const cert = secure.getPeerCertificate();
            console.log(`verified: issuer ${cert.issuer?.O}, subject ${cert.subject?.CN}`);
            secure.end();
        });
        secure.once('error', (e) => { console.error(`not verified: ${e.code || e.message}`); process.exit(1); });
    });
});
