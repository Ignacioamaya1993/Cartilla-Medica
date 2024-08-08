let professionals = [];
let currentPage = 1;
let recordsPerPage = 10;

// Ruta del archivo Excel
const excelFilePath = 'profesionales.xlsx';

// Función para leer el archivo Excel
function loadExcelFile() {
    fetch(excelFilePath)
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            professionals = XLSX.utils.sheet_to_json(firstSheet);
            populateSpecialtyFilter();
            updateProfessionals();
        })
        .catch(error => console.error('Error al leer el archivo Excel:', error));
}

document.addEventListener('DOMContentLoaded', () => {
    loadExcelFile();

    const recordsPerPageSelect = document.getElementById('recordsPerPage');
    const searchInput = document.getElementById('search');
    const specialtyFilter = document.getElementById('specialtyFilter');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');

    recordsPerPageSelect.addEventListener('change', updateRecordsPerPage);
    searchInput.addEventListener('input', updateProfessionals);
    specialtyFilter.addEventListener('change', updateProfessionals);
    prevPageBtn.addEventListener('click', () => changePage(-1));
    nextPageBtn.addEventListener('click', () => changePage(1));
});

function updateRecordsPerPage() {
    recordsPerPage = parseInt(document.getElementById('recordsPerPage').value);
    currentPage = 1;
    updateProfessionals();
}

function populateSpecialtyFilter() {
    const specialties = [...new Set(professionals.map(p => p.specialty))];
    const specialtyFilter = document.getElementById('specialtyFilter');
    specialtyFilter.innerHTML = '<option value="all">Todas las especialidades</option>'; // Reset options

    specialties.forEach(specialty => {
        const option = document.createElement('option');
        option.value = specialty;
        option.textContent = specialty;
        specialtyFilter.appendChild(option);
    });
}

function updateProfessionals() {
    const searchQuery = document.getElementById('search').value.toLowerCase();
    const selectedSpecialty = document.getElementById('specialtyFilter').value;

    let filteredProfessionals = professionals.filter(p =>
        (p.name.toLowerCase().includes(searchQuery)) &&
        (selectedSpecialty === 'all' || p.specialty === selectedSpecialty)
    );

    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const paginatedProfessionals = filteredProfessionals.slice(startIndex, endIndex);

    renderProfessionals(paginatedProfessionals);
    updatePaginationInfo(filteredProfessionals.length);
}

function renderProfessionals(professionals) {
    const professionalList = document.getElementById('professionalList');
    professionalList.innerHTML = '';

    professionals.forEach(professional => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${professional.specialty || ''}</td>
            <td>${professional.name || ''}</td>
            <td>${professional.address || ''}</td>
            <td>${professional.city || ''}</td>
            <td>${professional.phone || ''}</td>
        `;

        professionalList.appendChild(row);
    });
}


function updatePaginationInfo(totalRecords) {
    const pageInfo = document.getElementById('pageInfo');
    pageInfo.textContent = `Página ${currentPage} de ${Math.ceil(totalRecords / recordsPerPage)}`;

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === Math.ceil(totalRecords / recordsPerPage);
}

function changePage(delta) {
    currentPage += delta;
    updateProfessionals();
}