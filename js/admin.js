import { ENV } from './env.js';
import { REVIEW_FIELDS, FIELD_LABELS, validateReport, caseKey, findLiveRecord, beforeRecord, proposedValues, buildChanges } from './review-model.js';

const $ = id => document.getElementById(id);
const storageKey = `cartilla-review-v1:${new URL(ENV.SUPABASE_URL).hostname}`;
let token = null;
let professionals = [];
let categories = [];
let report = null;
let activeIndex = null;
let pendingSave = null;
let busy = false;
let decisions = {};
try { decisions = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* Browsing still works without storage. */ }
if (!decisions || typeof decisions !== 'object' || Array.isArray(decisions)) decisions = {};

const labels = { diferencias: 'Diferencias de contacto', ambiguo: 'Nombre repetido: confirmar identidad',
    posible_coincidencia: 'Posible coincidencia', no_encontrado: 'Sin coincidencia', origen_incompleto: 'Origen incompleto', sin_diferencias: 'Sin diferencias de contacto' };
function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
function remember() {
    try { localStorage.setItem(storageKey, JSON.stringify(decisions)); }
    catch { message('No se pudieron recordar las decisiones en este navegador. Descargá el historial antes de salir.', true); }
}
function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
}
function button(text, action, className) {
    const node = element('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
}
function sessionEnded() {
    token = null; professionals = []; categories = []; pendingSave = null;
    $('workspace').hidden = true; $('loginPanel').hidden = false; $('logout').hidden = true;
    if ($('confirmDialog').open) $('confirmDialog').close();
}
async function api(options = {}) {
    const response = await fetch('/api/admin', { ...options, cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(60000) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) sessionEnded();
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
    return data;
}
async function reload() {
    const data = await api();
    professionals = data.professionals; categories = data.categories.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    $('workspace').hidden = false; $('loginPanel').hidden = true; $('logout').hidden = false;
    message(`Sesión iniciada: ${data.user.email}. ${professionals.length} registros disponibles.`);
    if (report) render();
}
$('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = event.submitter || $('loginForm').querySelector('button[type="submit"]'); submit.disabled = true;
    try {
        message('Verificando acceso…');
        const response = await fetch(new URL('/auth/v1/token?grant_type=password', ENV.SUPABASE_URL), {
            method: 'POST', headers: { apikey: ENV.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value }), signal: AbortSignal.timeout(20000)
        });
        const auth = await response.json();
        if (!response.ok || !auth.access_token) throw new Error('No se pudo iniciar sesión. Revisá el correo y la contraseña.');
        token = auth.access_token;
        await reload();
    } catch (error) { token = null; message(error.message, true); }
    finally { $('password').value = ''; submit.disabled = false; }
});
$('logout').addEventListener('click', async () => {
    const previous = token; sessionEnded(); message('Sesión cerrada.');
    try { await fetch(new URL('/auth/v1/logout', ENV.SUPABASE_URL), { method: 'POST', headers: { apikey: ENV.SUPABASE_ANON_KEY, Authorization: `Bearer ${previous}` }, signal: AbortSignal.timeout(10000) }); } catch { /* Token has been discarded locally. */ }
});
$('reload').addEventListener('click', async () => {
    if (busy) return;
    $('reload').disabled = true;
    try { await reload(); } catch (error) { message(error.message, true); }
    finally { $('reload').disabled = false; }
});
$('reportFile').addEventListener('change', async event => {
    if (busy) return;
    try {
        const file = event.target.files[0]; if (!file) return;
        if (file.size > 10000000) throw new Error('El informe supera el tamaño permitido (10 MB).');
        report = validateReport(JSON.parse(await file.text()));
        activeIndex = null;
        $('reportInfo').textContent = `Informe del ${new Date(report.generatedAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} · ${report.results.length} casos. ${report.snapshotDate ? 'La comparación original utilizó una copia JSON.' : ''}`;
        $('reviewArea').hidden = false;
        render();
    } catch (error) { message(error.message, true); }
});
function decision(row) { return decisions[caseKey(row)] || {}; }
function included(row) {
    const state = decision(row).status;
    const filter = $('caseFilter').value;
    if (filter === 'pending' && (state === 'saved' || state === 'kept')) return false;
    if (filter === 'saved' && state !== 'saved') return false;
    if (filter === 'kept' && state !== 'kept') return false;
    const query = $('caseSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return row.current.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query);
}
function render() {
    if (!report) return;
    const rows = report.results.map((row, index) => ({ row, index })).filter(({ row }) => included(row));
    if (!rows.some(item => item.index === activeIndex)) activeIndex = rows[0]?.index ?? null;
    const reviewed = report.results.filter(row => ['saved', 'kept'].includes(decision(row).status)).length;
    $('progress').textContent = `${reviewed} de ${report.results.length} casos revisados · ${rows.length} visibles`;
    $('caseList').replaceChildren();
    for (const { row, index } of rows) {
        const state = decision(row).status;
        const node = button(row.current.name, () => { activeIndex = index; render(); }, index === activeIndex ? 'active' : '');
        node.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
        node.append(element('small', state === 'saved' ? '✓ Actualizado' : state === 'kept' ? '✓ Conservar datos actuales' : labels[row.status] || 'Para revisar'));
        $('caseList').append(node);
    }
    if (activeIndex === null) { $('caseDetail').replaceChildren(element('p', 'No hay casos con estos filtros.', 'empty')); return; }
    renderCase(report.results[activeIndex]);
}
$('caseSearch').addEventListener('input', render);
$('caseFilter').addEventListener('change', render);

function renderCase(row) {
    const panel = $('caseDetail'); panel.replaceChildren();
    const state = decision(row);
    const live = findLiveRecord(row, professionals);
    panel.append(element('h2', row.current.name, 'case-name'), element('p', labels[row.status] || 'Para revisar', 'badge'));
    if (state.status === 'saved') {
        panel.append(element('p', 'Este caso ya fue actualizado desde este navegador. Podés ver los campos guardados en el historial.', 'saved-note'));
        return;
    }
    if (state.status === 'kept') panel.append(element('p', 'Elegiste conservar los datos actuales. Podés revisar nuevamente este caso.', 'saved-note'));
    if (!live) panel.append(element('p', 'No se encontró un único registro con los mismos datos del informe. Puede haber cambiado o estar duplicado. Generá una nueva revisión; este caso no se puede guardar.', 'warning'));
    panel.append(element('p', `Localidad: ${row.current.city || 'Sin informar'}. Confirmá que el candidato corresponda al mismo profesional y consultorio.`, 'muted'));
    const candidateLabel = element('label', 'Profesional del listado de origen'); candidateLabel.htmlFor = 'candidate';
    const candidateSelect = element('select'); candidateSelect.id = 'candidate';
    candidateSelect.append(new Option('Elegir coincidencia…', ''));
    row.candidates.forEach((candidate, index) => candidateSelect.add(new Option(`${candidate.name} · ${candidate.specialty || 'Sin especialidad'} · ${candidate.address || 'Sin dirección'}`, String(index))));
    candidateSelect.value = state.candidateIndex != null ? String(state.candidateIndex) : row.candidates.length === 1 ? '0' : '';
    panel.append(candidateLabel, candidateSelect);
    let selectedCandidate = candidateSelect.value === '' ? null : row.candidates[Number(candidateSelect.value)];
    let values = state.values ? { ...state.values } : proposedValues(selectedCandidate, categories);
    let fields = new Set(state.fields || []);
    const tableWrap = element('div', null, 'compare-wrap');
    const table = element('table', null, 'compare');
    const header = element('tr'); ['Actualizar', 'Tu cartilla', 'Valor a guardar'].forEach(label => header.append(element('th', label)));
    const head = element('thead'); head.append(header); table.append(head);
    const tbody = element('tbody'); table.append(tbody); tableWrap.append(table); panel.append(tableWrap);
    const controls = {};
    function storeDraft() {
        decisions[caseKey(row)] = { ...decision(row), status: 'draft', candidateIndex: candidateSelect.value === '' ? null : Number(candidateSelect.value), fields: [...fields], values: { ...values } };
        remember();
    }
    function paintFields() {
        tbody.replaceChildren();
        for (const field of REVIEW_FIELDS) {
            const tr = element('tr'); const labelCell = element('th'); const currentCell = element('td'); const proposedCell = element('td');
            const fieldLabel = element('label', null, 'field-label'); const check = element('input'); check.type = 'checkbox';
            check.id = `field-${field}`; check.checked = fields.has(field); check.disabled = !live || !selectedCandidate;
            fieldLabel.append(check, document.createTextNode(FIELD_LABELS[field])); labelCell.append(fieldLabel);
            currentCell.textContent = (field === 'specialty' ? row.current.categorias?.nombre : row.current[field]) || 'Sin informar';
            const input = element(field === 'specialty' ? 'select' : 'input'); input.setAttribute('aria-label', `Nuevo valor de ${FIELD_LABELS[field].toLowerCase()}`);
            if (field === 'specialty') {
                input.append(new Option('Elegir especialidad existente…', ''));
                categories.forEach(category => input.add(new Option(category.nombre, String(category.id))));
            } else input.type = 'text';
            input.value = values[field] || ''; input.disabled = !live || !selectedCandidate;
            const sourceText = selectedCandidate?.[field];
            proposedCell.append(input, element('span', `Origen: ${sourceText || 'Sin dato publicado'}`, 'source-value'));
            check.addEventListener('change', () => { check.checked ? fields.add(field) : fields.delete(field); storeDraft(); });
            input.addEventListener('input', () => { values[field] = input.value; storeDraft(); });
            controls[field] = { check, input }; tr.append(labelCell, currentCell, proposedCell); tbody.append(tr);
        }
    }
    candidateSelect.addEventListener('change', () => {
        selectedCandidate = candidateSelect.value === '' ? null : row.candidates[Number(candidateSelect.value)];
        values = proposedValues(selectedCandidate, categories); fields = new Set(); storeDraft(); paintFields();
    });
    paintFields();
    panel.append(element('p', 'Solo se guardan los campos marcados. La especialidad se elige entre las categorías existentes; no se modifica el nombre de una categoría compartida.', 'muted'));
    const actions = element('div', null, 'actions');
    const all = button('Marcar todos los valores disponibles', () => {
        fields = new Set(REVIEW_FIELDS.filter(field => String(values[field] || '').trim())); storeDraft(); paintFields();
    }); all.disabled = !live;
    const keep = button('Conservar datos actuales', () => {
        decisions[caseKey(row)] = { status: 'kept', at: new Date().toISOString() }; remember(); render();
    });
    const save = button('Revisar cambios seleccionados', () => {
        try {
            if (!live || !selectedCandidate) throw new Error('Primero elegí el profesional del origen.');
            const changes = buildChanges(live, [...fields], values, categories);
            if (!Object.keys(changes).length) throw new Error('No hay cambios seleccionados con valores distintos.');
            pendingSave = { key: caseKey(row), id: live.id, before: beforeRecord(live), changes };
            showConfirmation(live, changes);
        } catch (error) { message(error.message, true); }
    }, 'primary'); save.disabled = !live;
    actions.append(all, keep, save); panel.append(actions);
}

function showConfirmation(record, changes) {
    $('confirmContent').replaceChildren(element('p', record.name));
    const table = element('table'); const head = element('tr'); ['Campo', 'Actual', 'Nuevo'].forEach(text => head.append(element('th', text))); table.append(head);
    for (const [field, value] of Object.entries(changes)) {
        const row = element('tr'); const category = field === 'categoria_id';
        row.append(element('th', FIELD_LABELS[category ? 'specialty' : field]),
            element('td', category ? record.categorias?.nombre : record[field] || 'Sin informar'),
            element('td', category ? categories.find(item => String(item.id) === String(value))?.nombre : value));
        table.append(row);
    }
    $('confirmContent').append(table); $('saveError').textContent = ''; $('confirmDialog').showModal();
}
$('cancelSave').addEventListener('click', () => { pendingSave = null; $('confirmDialog').close(); });
$('confirmDialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); else pendingSave = null; });
$('confirmSave').addEventListener('click', async () => {
    if (!pendingSave || busy) return;
    busy = true; $('confirmSave').disabled = true; $('cancelSave').disabled = true;
    const selected = pendingSave;
    try {
        const { key, ...body } = selected;
        const receipt = await api({ method: 'POST', body: JSON.stringify(body) });
        decisions[key] = { status: 'saved', receipt }; remember();
        professionals = professionals.map(record => String(record.id) === String(receipt.id) ? receipt.after : record);
        $('confirmDialog').close(); pendingSave = null;
        message('Cambios guardados. La cartilla en línea ya usa los datos nuevos. El respaldo JSON se actualizará con la próxima tarea diaria.');
        render();
    } catch (error) { $('saveError').textContent = error.message; message(error.message, true); }
    finally { busy = false; $('confirmSave').disabled = false; $('cancelSave').disabled = false; }
});
$('downloadHistory').addEventListener('click', () => {
    if (!report) { message('Cargá una revisión antes de descargar el historial.', true); return; }
    const data = { exportedAt: new Date().toISOString(), reportDate: report.generatedAt,
        decisions: report.results.map(row => ({ name: row.current.name, ...decision(row) })).filter(row => row.status) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = element('a'); link.href = url; link.download = 'historial-revision.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
document.documentElement.dataset.adminReady = 'true';
