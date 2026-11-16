// Optional real-browser check. Uses a local fake database; never writes to Supabase.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, extname } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import handler from '../api/admin.js';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const qa = resolve(root, '.qa');
await mkdir(qa, { recursive: true });
const records = [
    { id: 42, name: 'ALAMO JOSE ALEJANDRO', address: 'ESPAÑA 2727', phone: '442030', city: 'Olavarría', categoria_id: 3, categorias: { nombre: 'CLINICA QUIRURGICA' } },
    { id: 43, name: 'PEREZ ANA', address: 'PAZ 25', phone: '123456', city: 'Olavarría', categoria_id: 3, categorias: { nombre: 'CLINICA QUIRURGICA' } }
];
const categories = [{ id: 3, nombre: 'CLINICA QUIRURGICA' }, { id: 4, nombre: 'CARDIOLOGIA' }];
const fixture = { version: 1, generatedAt: new Date().toISOString(), results: records.map(current => ({
    current: { ...current }, status: 'posible_coincidencia', candidates: [{ name: current.id === 42 ? 'ALAMO ALEJANDRO JOSE' : 'PEREZ ANA',
        address: 'ESPAÑA Nº 2727', phone: '445100', specialty: 'CLINICA QUIRURGICA' }]
})) };
const reportPath = resolve(qa, 'test-report.json');
await writeFile(reportPath, JSON.stringify(fixture));
process.env.ADMIN_USER_IDS = 'test-admin';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-server-test-key';
const realFetch = globalThis.fetch;
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (!url.hostname.endsWith('.supabase.co')) return realFetch(input, options);
    if (url.pathname === '/auth/v1/user') return response({ id: 'test-admin', email: 'admin@example.test', email_confirmed_at: '2026-01-01' });
    const table = url.pathname.split('/').at(-1);
    if (options.method === 'PATCH') {
        const record = records.find(item => `eq.${item.id}` === url.searchParams.get('id'));
        assert(record);
        for (const field of ['name', 'address', 'phone', 'city', 'categoria_id']) {
            assert.equal(url.searchParams.get(field), `eq.${record[field]}`);
        }
        Object.assign(record, JSON.parse(options.body));
        return response([record]);
    }
    return response(Number(url.searchParams.get('offset')) > 0 ? [] : table === 'profesionales' ? records : categories);
};
let chrome;
let socket;
const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/auth/v1/token') {
            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ access_token: 'fake-browser-token' })); return;
        }
        if (url.pathname === '/auth/v1/logout') { res.end('{}'); return; }
        if (url.pathname === '/api/admin') {
            let body = ''; for await (const chunk of req) body += chunk;
            req.body = body || undefined;
            res.status = code => { res.statusCode = code; return res; };
            res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return res; };
            await handler(req, res); return;
        }
        if (url.pathname === '/js/env.js') {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(`export const ENV = { SUPABASE_URL: 'http://127.0.0.1:${server.address().port}', SUPABASE_ANON_KEY: 'fake-public-key' };`); return;
        }
        const path = resolve(root, '.' + decodeURIComponent(url.pathname));
        if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
        res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
        res.end(await readFile(path));
    } catch { res.writeHead(500).end('Test server error'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
    const binary = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    chrome = spawn(binary, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
        `--user-data-dir=${resolve(qa, 'chrome-profile')}`, '--window-size=1440,1100', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const debugging = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Chrome did not start: ' + stderr.slice(-500))), 15000);
        chrome.on('error', error => { clearTimeout(timer); reject(error); });
        chrome.stderr.on('data', chunk => {
            stderr += chunk;
            const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) { clearTimeout(timer); resolve(new URL(match[1]).origin.replace('ws:', 'http:')); }
        });
    });
    const pages = await (await realFetch(debugging + '/json')).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await once(socket, 'open');
    const pending = new Map(); let nextId = 1;
    socket.addEventListener('message', event => {
        const result = JSON.parse(event.data); if (!result.id) return;
        const callbacks = pending.get(result.id); if (!callbacks) return; pending.delete(result.id);
        result.error ? callbacks.reject(new Error(JSON.stringify(result.error))) : callbacks.resolve(result.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
        const id = nextId++; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.result.description);
        return result.result.value;
    };
    const waitFor = async expression => {
        const end = Date.now() + 10000;
        while (Date.now() < end) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
        throw new Error('Browser wait failed: ' + expression + '\n' + await evaluate("document.getElementById('message')?.innerText"));
    };
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/admin.html` });
    await waitFor("document.documentElement.dataset.adminReady === 'true'");
    await evaluate("document.getElementById('email').value='admin@example.test'; document.getElementById('password').value='fake-password'; document.getElementById('loginForm').requestSubmit();");
    await waitFor("!document.getElementById('workspace').hidden");
    const documentNode = await call('DOM.getDocument');
    const fileNode = await call('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#reportFile' });
    await call('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [reportPath] });
    await waitFor("!!document.getElementById('field-phone')");
    assert.equal(await evaluate("document.getElementById('field-name').checked"), false);
    await evaluate("document.getElementById('field-address').click();document.getElementById('field-phone').click();document.querySelector('#caseDetail .primary').click();");
    await waitFor("document.getElementById('confirmDialog').open");
    const confirmation = await evaluate("document.getElementById('confirmContent').innerText");
    assert(confirmation.includes('445100')); assert(!confirmation.includes('ALAMO ALEJANDRO JOSE'));
    await call('Page.captureScreenshot', { format: 'png' }).then(result => writeFile(resolve(qa, 'admin-review.png'), Buffer.from(result.data, 'base64')));
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    await call('Page.captureScreenshot', { format: 'png' }).then(result => writeFile(resolve(qa, 'admin-review-mobile.png'), Buffer.from(result.data, 'base64')));
    await call('Emulation.clearDeviceMetricsOverride');
    await evaluate("document.getElementById('confirmSave').click()");
    await waitFor("document.getElementById('message').innerText.includes('Cambios guardados')");
    assert.equal(records[0].name, 'ALAMO JOSE ALEJANDRO'); assert.equal(records[0].phone, '445100'); assert.equal(records[0].categoria_id, 3);
    assert.equal(records[1].phone, '123456');
    assert.equal(await evaluate("Object.values(localStorage).join('').includes('fake-browser-token')"), false);
    await evaluate("document.querySelector('#caseDetail .actions button:nth-child(2)').click()");
    await waitFor("document.getElementById('progress').innerText.includes('2 de 2')");
    await evaluate("document.getElementById('logout').click()");
    await waitFor("document.getElementById('workspace').hidden");
    console.log('PASS: browser login, report import, partial preview, API save, preserved fields, skip, and logout. No live database writes.');
} finally {
    socket?.close(); chrome?.kill(); server.closeAllConnections(); server.close(); globalThis.fetch = realFetch;
}
