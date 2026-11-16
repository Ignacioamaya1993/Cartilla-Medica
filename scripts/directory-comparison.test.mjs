import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDirectory, compareDirectories, renderReport } from './directory-comparison.mjs';

const local = { name: 'PÉREZ, MARÍA ANA', address: 'Gral. Paz 2524', phone: '42-3213', city: 'Olavarría', categorias: { nombre: 'Cardiología' } };
const source = { name: 'PEREZ MARIA ANA', address: 'GENERAL PAZ Nº 2524', phone: '423213', specialty: 'CARDIOLOGIA' };

test('reads the expected table, line breaks, entities and blank cells', () => {
    const html = '<table><tr><th>APELLIDO Y NOMBRE</th><th>ESPECIALIDAD</th><th>DOMICILIO</th><th>TELÉFONO</th></tr><tr><td>P&Eacute;REZ MARIA</td><td>CLINICA<br>MEDICA</td><td>PAZ N&#186; 25 &amp; 26</td><td></td></tr></table>';
    assert.deepEqual(parseDirectory(html), [{ name: 'PÉREZ MARIA', specialty: 'CLINICA MEDICA', address: 'PAZ Nº 25 & 26', phone: '' }]);
    assert.throws(() => parseDirectory('<html>temporarily unavailable</html>'), /tabla esperada/);
});

test('normalizes accents, basic address abbreviations and phone punctuation', () => {
    assert.equal(compareDirectories([local], [source])[0].status, 'sin_diferencias');
});

test('reports changed contacts but never proposes deleting blank source fields', () => {
    const changed = compareDirectories([local], [{ ...source, address: 'MORENO 100', phone: '' }])[0];
    assert.equal(changed.status, 'diferencias');
    assert.deepEqual(changed.changes, [{ field: 'address', current: local.address, found: 'MORENO 100' }]);
    assert.deepEqual(changed.missingFields, ['phone']);
    assert.equal(compareDirectories([local], [{ ...source, address: '', phone: '' }])[0].status, 'origen_incompleto');
});

test('duplicate names in either directory are ambiguous', () => {
    assert.equal(compareDirectories([local], [source, { ...source, address: 'OTRA 50' }])[0].status, 'ambiguo');
    assert(compareDirectories([local, local], [source]).every(row => row.status === 'ambiguo'));
});

test('partial names are candidates only and absent names are not removals', () => {
    assert.equal(compareDirectories([local], [{ ...source, name: 'PEREZ MARIA' }])[0].status, 'posible_coincidencia');
    assert.equal(compareDirectories([local], [{ ...source, name: 'GOMEZ JUAN' }])[0].status, 'no_encontrado');
});

test('HTML escapes source data and does not mutate input', () => {
    const current = [{ ...local, name: '<img src=x onerror=alert(1)>' }];
    const before = JSON.stringify(current);
    const results = compareDirectories(current, []);
    const html = renderReport({ results, counts: { no_encontrado: 1 }, generatedAt: '2026-11-16', currentSource: 'Test' });
    assert(!html.includes('<img src=x'));
    assert(html.includes('&lt;img'));
    assert.equal(JSON.stringify(current), before);
});
