export const REVIEW_FIELDS = ['name', 'specialty', 'address', 'phone'];
export const FIELD_LABELS = { name: 'Nombre', specialty: 'Especialidad', address: 'Dirección', phone: 'Teléfono' };

export function validateReport(report) {
    if (report?.version !== 1 || !Number.isFinite(Date.parse(report.generatedAt)) || !Array.isArray(report.results) || report.results.length > 10000) {
        throw new Error('Elegí el archivo revision-profesionales.json generado por la revisión semanal.');
    }
    const validText = value => value == null || (typeof value === 'string' && value.length <= 2000);
    for (const row of report.results) {
        if (!row?.current || typeof row.current.name !== 'string' || !Array.isArray(row.candidates) || row.candidates.length > 1000 ||
            !['address', 'phone', 'city'].every(field => validText(row.current[field])) ||
            !validText(row.current.categorias?.nombre) || !row.candidates.every(candidate => candidate &&
                ['name', 'specialty', 'address', 'phone'].every(field => validText(candidate[field])))) {
            throw new Error('El informe contiene un caso con formato inválido.');
        }
    }
    return report;
}

export function caseKey(row) {
    return JSON.stringify([row.current.name, row.current.address ?? null, row.current.phone ?? null,
        row.current.city ?? null, row.current.categorias?.nombre ?? null, row.candidates]);
}

export function findLiveRecord(row, professionals) {
    const matches = professionals.filter(item => item.name === row.current.name &&
        ['address', 'phone', 'city'].every(field => (item[field] ?? null) === (row.current[field] ?? null)) &&
        (item.categorias?.nombre ?? null) === (row.current.categorias?.nombre ?? null));
    return matches.length === 1 ? matches[0] : null;
}

export function beforeRecord(record) {
    return Object.fromEntries(['name', 'address', 'phone', 'city', 'categoria_id'].map(field => [field, record[field] ?? null]));
}

export function proposedValues(candidate, categories) {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');
    const matchingCategories = categories.filter(item => normalize(item.nombre) === normalize(candidate?.specialty));
    return { name: candidate?.name || '', address: candidate?.address || '', phone: candidate?.phone || '',
        specialty: matchingCategories.length === 1 ? String(matchingCategories[0].id) : '' };
}

export function buildChanges(record, fields, values, categories) {
    const changes = {};
    for (const field of fields) {
        if (!REVIEW_FIELDS.includes(field)) throw new Error('Campo no permitido.');
        const value = String(values[field] ?? '').trim();
        if (!value) throw new Error(`Elegí un valor para ${FIELD_LABELS[field].toLowerCase()}.`);
        if (field === 'specialty') {
            const category = categories.find(item => String(item.id) === value);
            if (!category) throw new Error('Elegí una especialidad existente en tu cartilla.');
            if (String(record.categoria_id) !== value) changes.categoria_id = category.id;
        } else if (record[field] !== value) {
            changes[field] = value;
        }
    }
    return changes;
}
